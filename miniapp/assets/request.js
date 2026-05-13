/* ============================================================
   Заявка на замер — менеджер создаёт, замерщику в инбокс
   ============================================================ */

const MeasurementRequest = (function () {
  let root = null;
  let state = {
    client_name: "",
    client_phone: "",
    address: "",
    assigned_to_tg_id: "",
    notes: "",
    // Приблизительная дата визита
    preferred_type: "tbd",   // specific | this_week | next_week | tbd
    preferred_date: "",
    preferred_time_of_day: "",  // morning | day | evening | ""
    preferred_note: "",
  };
  let measurers = [];

  function mount(container) {
    root = container;
    document.body.classList.remove("has-bottom-nav");
    const oldNav = document.getElementById("bottom-nav");
    if (oldNav) oldNav.remove();
    state = {
      client_name: "", client_phone: "", address: "", assigned_to_tg_id: "", notes: "",
      preferred_type: "tbd", preferred_date: "", preferred_time_of_day: "", preferred_note: "",
    };
    render();
    loadMeasurers();
  }

  function render() {
    if (!root) return;
    root.innerHTML = "";
    root.appendChild(headerEl("Новая заявка на замер", "#/"));

    const form = el(`
      <section class="podbor-step">
        <h2 class="display-title">Заявка<br><span class="accent">на замер</span></h2>
        <p class="lede">Заполните данные клиента — замерщик получит уведомление в Telegram и согласует дату.</p>

        <div class="form-row">
          <label class="field">
            <span class="field-label">ФИО клиента *</span>
            <input type="text" data-bind="client_name" placeholder="Иванов Иван Иванович" autocomplete="name">
            <span class="field-error" id="errName"></span>
          </label>
        </div>

        <div class="form-row">
          <label class="field">
            <span class="field-label">Телефон *</span>
            <input type="tel" data-bind="client_phone" placeholder="+7 921 555-12-34" autocomplete="tel">
            <span class="field-hint">Минимум 10 цифр</span>
            <span class="field-error" id="errPhone"></span>
          </label>
        </div>

        <div class="form-row">
          <label class="field">
            <span class="field-label">Адрес замера</span>
            <input type="text" data-bind="address" placeholder="СПб, Просвещения 87, кв. 12">
          </label>
        </div>

        <div class="form-row">
          <label class="field">
            <span class="field-label">Кому назначить</span>
            <select data-bind="assigned_to_tg_id" id="measurerSelect">
              <option value="">— Загрузка списка...</option>
            </select>
            <span class="field-hint" id="measurerHint">Замерщик получит DM с реквизитами заявки</span>
          </label>
        </div>

        <div class="section-head" style="margin-top:18px;"><span class="label">⏰ Когда удобно клиенту</span></div>
        <div class="preferred-options">
          <label class="pref-opt">
            <input type="radio" name="prefType" value="specific" data-pref="type">
            <span class="pref-label">Конкретная дата</span>
          </label>
          <label class="pref-opt">
            <input type="radio" name="prefType" value="this_week" data-pref="type">
            <span class="pref-label">Эта неделя</span>
          </label>
          <label class="pref-opt">
            <input type="radio" name="prefType" value="next_week" data-pref="type">
            <span class="pref-label">Следующая неделя</span>
          </label>
          <label class="pref-opt">
            <input type="radio" name="prefType" value="tbd" data-pref="type" checked>
            <span class="pref-label">Согласовать с клиентом</span>
          </label>
        </div>

        <div class="form-row two-col" id="prefSpecificBox" style="display:none;">
          <label class="field">
            <span class="field-label">Дата</span>
            <input type="date" data-pref="date">
          </label>
          <label class="field">
            <span class="field-label">Время дня</span>
            <select data-pref="time_of_day">
              <option value="">не важно</option>
              <option value="morning">утром</option>
              <option value="day">днём</option>
              <option value="evening">вечером</option>
            </select>
          </label>
        </div>

        <div class="form-row">
          <label class="field">
            <span class="field-label">Уточнение по времени</span>
            <input type="text" data-pref="note" placeholder="например: после звонка, не раньше вторника">
          </label>
        </div>

        <div class="form-row">
          <label class="field">
            <span class="field-label">Заметки для замерщика</span>
            <textarea data-bind="notes" rows="3" placeholder="газ/электро, особые условия доступа, ниши под технику, ..."></textarea>
          </label>
        </div>

        <div class="podbor-cta-row">
          <button class="btn-primary" id="submit">Создать заявку</button>
        </div>

        <div id="submitResult" class="submit-result"></div>
      </section>
    `);
    root.appendChild(form);

    bindInputs(form);
    form.querySelector("#submit").addEventListener("click", () => onSubmit(form));
  }

  function bindInputs(node) {
    node.querySelectorAll("[data-bind]").forEach(inp => {
      inp.addEventListener("input", e => {
        state[e.target.dataset.bind] = e.target.value;
      });
      inp.addEventListener("change", e => {
        state[e.target.dataset.bind] = e.target.value;
      });
    });
    // Радио-кнопки + поля приблизительной даты
    node.querySelectorAll("[data-pref]").forEach(inp => {
      const key = inp.dataset.pref;
      const mapKey = "preferred_" + key;
      inp.addEventListener("change", e => {
        const val = e.target.type === "radio" ? e.target.value : e.target.value;
        state[mapKey] = val;
        if (key === "type") togglePrefSpecific(node);
      });
    });
    togglePrefSpecific(node);
  }

  function togglePrefSpecific(node) {
    const box = node.querySelector("#prefSpecificBox");
    if (!box) return;
    box.style.display = state.preferred_type === "specific" ? "" : "none";
  }

  async function loadMeasurers() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/staff_list`, {
        method: "POST",
        body: JSON.stringify({ initData: tg?.initData || "", role: "measurer" }),
      });
      const data = await res.json();
      measurers = data.staff || [];
      const sel = document.getElementById("measurerSelect");
      const hint = document.getElementById("measurerHint");
      if (!sel) return;
      if (!measurers.length) {
        sel.innerHTML = `<option value="">— Замерщиков пока нет —</option>`;
        sel.disabled = true;
        if (hint) hint.textContent = "Сначала выдайте кому-нибудь роль measurer через /grant_role";
        return;
      }
      sel.disabled = false;
      sel.innerHTML = `<option value="">— Не назначать (заберу сам)</option>` +
        measurers.map(m => `<option value="${m.tg_id}">${escHtml(m.full_name || "?")} ${m.tg_username ? "(@" + m.tg_username + ")" : ""}</option>`).join("");
    } catch (e) {
      const sel = document.getElementById("measurerSelect");
      if (sel) sel.innerHTML = `<option value="">— ошибка загрузки —</option>`;
    }
  }

  async function onSubmit(form) {
    const btn = form.querySelector("#submit");
    const result = form.querySelector("#submitResult");

    // Валидация
    form.querySelector("#errName").textContent = "";
    form.querySelector("#errPhone").textContent = "";
    const name = (state.client_name || "").trim();
    const phone = (state.client_phone || "").trim();
    if (!name) {
      form.querySelector("#errName").textContent = "Укажите имя клиента";
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      form.querySelector("#errPhone").textContent = "Слишком короткий номер";
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-inline"></span> создаём...';
    result.innerHTML = "";

    try {
      const res = await fetch(`${BACKEND_URL}/api/measurement_request`, {
        method: "POST",
        body: JSON.stringify({
          initData: tg?.initData || "",
          initDataUnsafe: tg?.initDataUnsafe || null,
          client_name: name,
          client_phone: phone,
          address: state.address || "",
          assigned_to_tg_id: state.assigned_to_tg_id || "",
          notes: state.notes || "",
          // Приблизительная дата визита
          preferred_type: state.preferred_type || "tbd",
          preferred_date: state.preferred_date || "",
          preferred_time_of_day: state.preferred_time_of_day || "",
          preferred_note: state.preferred_note || "",
        }),
      });
      const data = await res.json();
      if (data.error) {
        result.innerHTML = `<div class="error">Ошибка: ${data.error}</div>`;
        btn.disabled = false;
        btn.textContent = "Попробовать снова";
        return;
      }

      haptic && haptic("success");
      const assignedTo = state.assigned_to_tg_id
        ? measurers.find(m => String(m.tg_id) === String(state.assigned_to_tg_id))
        : null;

      result.innerHTML = `
        <div class="success">
          <div class="success-icon">${ICONS.check}</div>
          <div>
            <div class="success-title">Заявка создана</div>
            <div class="success-sub">
              ID #${(data.id || "").slice(0, 6)}${assignedTo ? " · Замерщик уведомлён в Telegram" : " · Без назначения"}
            </div>
          </div>
        </div>
        <div class="podbor-cta-row" style="margin-top:16px;">
          <button class="btn-secondary" id="newOne">Ещё заявка</button>
          <button class="btn-primary" id="toHome">На главную</button>
        </div>
      `;
      form.querySelector("#newOne")?.addEventListener("click", () => mount(root));
      form.querySelector("#toHome")?.addEventListener("click", () => {
        location.hash = "";
        location.reload();
      });
    } catch (e) {
      result.innerHTML = `<div class="error">Сеть: ${e.message}</div>`;
      btn.disabled = false;
      btn.textContent = "Попробовать снова";
    }
  }

  function headerEl(title, backHref) {
    const h = el(`
      <header class="podbor-header">
        <button class="podbor-back" aria-label="Назад">${ICONS.arrow_left || "‹"}</button>
        <div class="podbor-title">${escHtml(title)}</div>
        <div style="width:28px"></div>
      </header>
    `);
    h.querySelector(".podbor-back").addEventListener("click", () => {
      if (backHref) location.hash = backHref;
      else location.hash = "";
      if (!location.hash) location.reload();
    });
    return h;
  }

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  return { mount };
})();
