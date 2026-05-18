/* ============================================================
   Заявка на замер — менеджер создаёт, замерщику в инбокс
   v20260518p — поиск по клиентам + передача менеджеру
   ============================================================ */

const MeasurementRequest = (function () {
  let root = null;
  let state = {
    // Клиент
    client_id:    null,   // ключ из списка (client_name+phone) — если выбрали
    client_name:  "",
    client_phone: "",
    address:      "",
    // Назначение
    assigned_to_tg_id:     "",
    target_manager_tg_id:  "",
    // Прочее
    preferred_note: "",
    urgent: false,
  };
  let allClients  = [];   // [{client_name, client_phone, address, client_tg_id}]
  let measurers   = [];
  let managers    = [];
  let clientMode  = "search"; // "search" | "selected" | "new"

  /* ── API ──────────────────────────────────────────────────── */
  async function _api(path, body = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(`${BACKEND_URL}/api/${path}`, {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: Platform.initData,
          initDataUnsafe: Platform.initDataUnsafe,
          ...body,
        }),
      });
      if (!res.ok) throw new Error(`Ошибка сервера (${res.status})`);
      return await res.json();
    } catch (e) {
      if (e.name === "AbortError") throw new Error("Сервер не отвечает");
      throw e;
    } finally { clearTimeout(t); }
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escAttr(s) { return escHtml(s); }

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function maskPhone(p) {
    const d = (p || "").replace(/\D/g, "");
    if (d.length < 4) return p;
    return d.slice(0, 1) + "**" + d.slice(-2);
  }

  /* ── Mount ───────────────────────────────────────────────── */
  function mount(container) {
    root = container;
    document.body.classList.remove("has-bottom-nav");
    const oldNav = document.getElementById("bottom-nav");
    if (oldNav) oldNav.remove();
    _resetState();

    // Prefill из sessionStorage (из карточки клиента)
    try {
      const raw = sessionStorage.getItem("prefillClient");
      if (raw) {
        const pre = JSON.parse(raw);
        if (pre.name)  state.client_name  = pre.name;
        if (pre.phone) state.client_phone = pre.phone;
        sessionStorage.removeItem("prefillClient");
        clientMode = "new"; // уже знаем имя — режим нового клиента
      }
    } catch (e) {}

    render();
    _loadAll();
  }

  function _resetState() {
    state = {
      client_id: null, client_name: "", client_phone: "", address: "",
      assigned_to_tg_id: "", target_manager_tg_id: "",
      preferred_note: "", urgent: false,
    };
    clientMode = "search";
  }

  /* ── Load: clients + measurers + managers ─────────────────── */
  async function _loadAll() {
    // Параллельно
    const [cRes, mRes, mgRes] = await Promise.allSettled([
      _api("clients"),
      _api("staff_list", { role: "measurer" }),
      _api("managers_list"),
    ]);

    if (cRes.status === "fulfilled" && !cRes.value.error) {
      allClients = cRes.value.clients || [];
    }
    if (mRes.status === "fulfilled" && !mRes.value.error) {
      measurers = mRes.value.staff || [];
    }
    if (mgRes.status === "fulfilled" && !mgRes.value.error) {
      managers = mgRes.value.managers || [];
    }

    _renderMeasurerSelect();
    _renderManagerSelect();
  }

  /* ── Render ──────────────────────────────────────────────── */
  function render() {
    if (!root) return;
    root.innerHTML = "";
    root.appendChild(_headerEl());

    const wrap = el(`<div class="podbor-screen" style="padding-bottom:24px;"></div>`);

    // ── Заголовок ────────────────────────────────────────────
    wrap.appendChild(el(`
      <div style="padding:16px 16px 0;">
        <h2 class="display-title">Заявка<br><span class="accent">на замер</span></h2>
        <p class="lede" style="margin-top:4px;">Замерщик получит уведомление в Telegram и согласует дату с клиентом.</p>
      </div>
    `));

    // ── Блок клиента ─────────────────────────────────────────
    const clientBlock = el(`<div id="rq-client-block" style="padding:0 16px;"></div>`);
    wrap.appendChild(clientBlock);
    _renderClientBlock(clientBlock);

    // ── Замерщик ─────────────────────────────────────────────
    const assignBlock = el(`
      <div style="padding:0 16px;margin-top:14px;">
        <label class="field">
          <span class="field-label">Замерщик</span>
          <select id="rq-measurer" style="width:100%;">
            <option value="">— Загружаем список...</option>
          </select>
          <span class="field-hint" id="rq-measurer-hint">Замерщик получит уведомление в Telegram</span>
        </label>
      </div>
    `);
    wrap.appendChild(assignBlock);

    // ── Передать менеджеру ────────────────────────────────────
    const mgrBlock = el(`
      <div style="padding:0 16px;margin-top:14px;">
        <label class="field">
          <span class="field-label">Передать менеджеру</span>
          <select id="rq-manager" style="width:100%;">
            <option value="">— Оставить себе —</option>
          </select>
          <span class="field-hint">Заявка появится в списке выбранного менеджера</span>
        </label>
      </div>
    `);
    wrap.appendChild(mgrBlock);

    // ── Примечание ───────────────────────────────────────────
    wrap.appendChild(el(`
      <div style="padding:0 16px;margin-top:14px;">
        <label class="field">
          <span class="field-label">Примечание для замерщика</span>
          <textarea id="rq-note" rows="3"
            placeholder="удобная дата, особенности доступа, газ/электро, парковка..."
            style="width:100%;box-sizing:border-box;"></textarea>
          <span class="field-hint">Точную дату согласует замерщик с клиентом напрямую</span>
        </label>
      </div>
    `));

    // ── CTA ───────────────────────────────────────────────────
    wrap.appendChild(el(`
      <div style="padding:16px 16px 0;">
        <button class="btn-primary" id="rq-submit" style="width:100%;font-size:15px;padding:14px;">
          Создать заявку
        </button>
        <div id="rq-result" style="margin-top:12px;"></div>
      </div>
    `));

    root.appendChild(wrap);
    _bindWrap(wrap);
  }

  /* ── Client block ────────────────────────────────────────── */
  function _renderClientBlock(container) {
    container.innerHTML = "";

    if (clientMode === "selected") {
      // Карточка выбранного клиента
      container.appendChild(el(`
        <div style="margin-top:14px;">
          <div class="field-label" style="margin-bottom:6px;">Клиент</div>
          <div style="display:flex;align-items:center;gap:10px;padding:12px;
                      background:var(--surface);border:1.5px solid var(--accent,#003E7E);
                      border-radius:10px;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:14px;font-weight:700;color:var(--ink);">${escHtml(state.client_name)}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:1px;">${escHtml(maskPhone(state.client_phone))}</div>
            </div>
            <button id="rq-clear-client" style="background:none;border:none;cursor:pointer;
                    font-size:18px;color:var(--muted);padding:4px 8px;">✕</button>
          </div>
          <div style="margin-top:8px;">
            <label class="field">
              <span class="field-label">Адрес замера</span>
              <input id="rq-address" type="text" value="${escAttr(state.address)}"
                     placeholder="СПб, Просвещения 87, кв. 12">
            </label>
          </div>
        </div>
      `));
      container.querySelector("#rq-clear-client").addEventListener("click", () => {
        state.client_id = null; state.client_name = ""; state.client_phone = ""; state.address = "";
        clientMode = "search";
        _renderClientBlock(container);
      });
      container.querySelector("#rq-address").addEventListener("input", e => {
        state.address = e.target.value;
      });

    } else if (clientMode === "new") {
      // Форма нового клиента
      container.appendChild(el(`
        <div style="margin-top:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span class="field-label">Новый клиент</span>
            <button id="rq-back-search" style="background:none;border:none;cursor:pointer;
                    font-size:12px;color:var(--accent,#003E7E);padding:0;">← к поиску</button>
          </div>
          <div class="form-row" style="margin-bottom:8px;">
            <label class="field">
              <span class="field-label">ФИО *</span>
              <input id="rq-new-name" type="text" value="${escAttr(state.client_name)}"
                     placeholder="Иванов Иван Иванович" autocomplete="name">
              <span class="field-error" id="rq-err-name"></span>
            </label>
          </div>
          <div class="form-row" style="margin-bottom:8px;">
            <label class="field">
              <span class="field-label">Телефон *</span>
              <input id="rq-new-phone" type="tel" value="${escAttr(state.client_phone)}"
                     placeholder="+7 921 555-12-34" autocomplete="tel">
              <span class="field-error" id="rq-err-phone"></span>
            </label>
          </div>
          <div class="form-row">
            <label class="field">
              <span class="field-label">Адрес замера</span>
              <input id="rq-new-address" type="text" value="${escAttr(state.address)}"
                     placeholder="СПб, Просвещения 87, кв. 12">
            </label>
          </div>
        </div>
      `));
      container.querySelector("#rq-new-name").addEventListener("input", e => { state.client_name = e.target.value; });
      container.querySelector("#rq-new-phone").addEventListener("input", e => { state.client_phone = e.target.value; });
      container.querySelector("#rq-new-address").addEventListener("input", e => { state.address = e.target.value; });
      container.querySelector("#rq-back-search").addEventListener("click", () => {
        state.client_name = ""; state.client_phone = ""; state.address = "";
        clientMode = "search";
        _renderClientBlock(container);
      });

    } else {
      // Режим поиска (default)
      const searchWrap = el(`
        <div style="margin-top:14px;position:relative;">
          <label class="field">
            <span class="field-label">Клиент</span>
            <div style="position:relative;">
              <input id="rq-search" type="text" placeholder="🔍 Найти по имени или телефону..."
                     autocomplete="off" style="width:100%;box-sizing:border-box;padding-right:36px;">
              <span id="rq-search-spinner" style="display:none;position:absolute;right:10px;top:50%;
                    transform:translateY(-50%);font-size:14px;">⏳</span>
            </div>
          </label>
          <div id="rq-dropdown" style="display:none;position:absolute;left:0;right:0;
               background:var(--surface);border:1px solid var(--border);border-radius:10px;
               box-shadow:0 4px 16px rgba(0,0,0,.12);z-index:100;max-height:220px;overflow-y:auto;
               margin-top:4px;"></div>
        </div>
      `);
      container.appendChild(searchWrap);

      const input = searchWrap.querySelector("#rq-search");
      const dropdown = searchWrap.querySelector("#rq-dropdown");

      input.addEventListener("input", () => _filterClients(input.value, dropdown, container));
      input.addEventListener("focus", () => {
        if (input.value.trim() || !allClients.length) return;
        _showDropdown(allClients.slice(0, 6), dropdown, container, input);
      });
      document.addEventListener("click", function _outsideClick(e) {
        if (!searchWrap.contains(e.target)) {
          dropdown.style.display = "none";
          document.removeEventListener("click", _outsideClick);
        }
      });
    }
  }

  function _filterClients(query, dropdown, container) {
    const q = query.trim().toLowerCase();
    if (!q) { dropdown.style.display = "none"; return; }
    const matches = allClients.filter(c =>
      (c.client_name || "").toLowerCase().includes(q) ||
      (c.client_phone || "").replace(/\D/g, "").includes(q.replace(/\D/g, ""))
    ).slice(0, 6);
    _showDropdown(matches, dropdown, container, document.getElementById("rq-search"), q);
  }

  function _showDropdown(list, dropdown, container, input, query = "") {
    dropdown.innerHTML = "";
    dropdown.style.display = "";

    list.forEach(c => {
      const item = el(`
        <div style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);
                    display:flex;gap:10px;align-items:center;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:var(--ink);">${escHtml(c.client_name || "—")}</div>
            <div style="font-size:11px;color:var(--muted);">
              ${escHtml(maskPhone(c.client_phone))}
              ${c.address ? " · " + escHtml(c.address.slice(0, 30)) : ""}
            </div>
          </div>
          <div style="font-size:18px;color:var(--accent,#003E7E);">›</div>
        </div>
      `);
      item.addEventListener("mousedown", e => e.preventDefault()); // не теряем focus
      item.addEventListener("click", () => {
        state.client_id    = c.client_name + "|" + c.client_phone;
        state.client_name  = c.client_name  || "";
        state.client_phone = c.client_phone || "";
        state.address      = c.address      || "";
        clientMode = "selected";
        dropdown.style.display = "none";
        _renderClientBlock(container);
      });
      dropdown.appendChild(item);
    });

    // «Создать нового клиента»
    const newBtn = el(`
      <div style="padding:10px 14px;cursor:pointer;color:var(--accent,#003E7E);
                  font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;">
        <span style="font-size:18px;">＋</span> Создать нового клиента
      </div>
    `);
    newBtn.addEventListener("mousedown", e => e.preventDefault());
    newBtn.addEventListener("click", () => {
      if (input) state.client_name = input.value.trim();
      clientMode = "new";
      dropdown.style.display = "none";
      _renderClientBlock(container);
    });
    dropdown.appendChild(newBtn);
  }

  /* ── Measurer & Manager selects ──────────────────────────── */
  function _renderMeasurerSelect() {
    const sel = document.getElementById("rq-measurer");
    const hint = document.getElementById("rq-measurer-hint");
    if (!sel) return;
    if (!measurers.length) {
      sel.innerHTML = `<option value="">— Замерщиков нет —</option>`;
      sel.disabled = true;
      if (hint) hint.textContent = "Выдайте кому-нибудь роль measurer через /grant_role";
      return;
    }
    sel.disabled = false;
    sel.innerHTML =
      `<option value="">— Не назначать —</option>` +
      measurers.map(m =>
        `<option value="${m.tg_id}">${escHtml(m.full_name || "?")}${m.tg_username ? " (@" + m.tg_username + ")" : ""}</option>`
      ).join("");
  }

  function _renderManagerSelect() {
    const sel = document.getElementById("rq-manager");
    if (!sel) return;
    if (!managers.length) {
      sel.innerHTML = `<option value="">— Оставить себе —</option>`;
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    sel.innerHTML =
      `<option value="">— Оставить себе —</option>` +
      managers.map(m =>
        `<option value="${m.tg_id}">${escHtml(m.full_name || "?")}${m.tg_username ? " (@" + m.tg_username + ")" : ""}</option>`
      ).join("");
  }

  /* ── Bind ─────────────────────────────────────────────────── */
  function _bindWrap(wrap) {
    wrap.querySelector("#rq-measurer")?.addEventListener("change", e => {
      state.assigned_to_tg_id = e.target.value;
    });
    wrap.querySelector("#rq-manager")?.addEventListener("change", e => {
      state.target_manager_tg_id = e.target.value;
    });
    wrap.querySelector("#rq-note")?.addEventListener("input", e => {
      state.preferred_note = e.target.value;
    });
    wrap.querySelector("#rq-submit")?.addEventListener("click", () => _onSubmit(wrap));
  }

  /* ── Submit ──────────────────────────────────────────────── */
  async function _onSubmit(wrap) {
    // Валидация
    const container = wrap.querySelector("#rq-client-block");
    const errName  = container?.querySelector("#rq-err-name");
    const errPhone = container?.querySelector("#rq-err-phone");
    if (errName)  errName.textContent  = "";
    if (errPhone) errPhone.textContent = "";

    const name  = state.client_name.trim();
    const phone = state.client_phone.trim();

    if (!name) {
      if (errName) errName.textContent = "Укажите имя клиента";
      else Platform.showAlert("Укажите имя клиента");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      if (errPhone) errPhone.textContent = "Слишком короткий номер";
      else Platform.showAlert("Укажите телефон клиента");
      return;
    }

    const btn    = wrap.querySelector("#rq-submit");
    const result = wrap.querySelector("#rq-result");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-inline"></span> создаём...';
    result.innerHTML = "";

    try {
      const data = await _api("measurement_request", {
        client_name:           name,
        client_phone:          phone,
        address:               state.address || "",
        assigned_to_tg_id:     state.assigned_to_tg_id || "",
        target_manager_tg_id:  state.target_manager_tg_id || "",
        preferred_note:        state.preferred_note || "",
        preferred_type:        "tbd",
      });

      if (data.error) {
        result.innerHTML = `<div class="error">Ошибка: ${escHtml(data.error)}</div>`;
        btn.disabled = false; btn.textContent = "Попробовать снова";
        return;
      }

      haptic && haptic("success");

      const assignedTo = state.assigned_to_tg_id
        ? measurers.find(m => String(m.tg_id) === String(state.assigned_to_tg_id))
        : null;
      const handedTo = state.target_manager_tg_id
        ? managers.find(m => String(m.tg_id) === String(state.target_manager_tg_id))
        : null;

      result.innerHTML = `
        <div class="success">
          <div class="success-icon">✅</div>
          <div>
            <div class="success-title">Заявка создана</div>
            <div class="success-sub">
              #${(data.id || "").slice(0, 6)}
              ${assignedTo ? " · Замерщик уведомлён" : ""}
              ${handedTo ? ` · Передана ${escHtml(handedTo.full_name || "менеджеру")}` : ""}
            </div>
          </div>
        </div>
        <div class="podbor-cta-row" style="margin-top:16px;">
          <button class="btn-secondary" id="rq-new">Ещё заявка</button>
          <button class="btn-primary" id="rq-home">На главную</button>
        </div>
      `;
      result.querySelector("#rq-new")?.addEventListener("click", () => mount(root));
      result.querySelector("#rq-home")?.addEventListener("click", () => {
        location.hash = "";
        if (typeof routeByHash === "function") routeByHash();
      });
    } catch (e) {
      result.innerHTML = `<div class="error">Сеть: ${escHtml(e.message)}</div>`;
      btn.disabled = false; btn.textContent = "Попробовать снова";
    }
  }

  /* ── Header ──────────────────────────────────────────────── */
  function _headerEl() {
    const h = el(`
      <header class="podbor-header">
        <button class="podbor-back" aria-label="Назад">${(window.ICONS || {}).arrow_left || "‹"}</button>
        <div class="podbor-title">Новая заявка на замер</div>
        <div style="width:28px"></div>
      </header>
    `);
    h.querySelector(".podbor-back").addEventListener("click", () => {
      location.hash = "";
      if (typeof routeByHash === "function") routeByHash();
    });
    return h;
  }

  return { mount };
})();
