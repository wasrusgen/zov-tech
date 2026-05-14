/* ============================================================
   Сборка (Phase 4) — менеджер создаёт заявку на сборку,
   мастер исполняет, клиент подписывает приёмку.
   Этап 1: создание + список + детальная.
   ============================================================ */

const Assembly = (function () {
  let root = null;
  let state = {
    client_name: "",
    client_phone: "",
    address: "",
    scope_of_work: "",
    measurement_id: "",
    lead_id: "",
    scheduled_at: "",
    manager_note: "",
  };

  function mount(container) {
    root = container;
    document.body.classList.remove("has-bottom-nav");
    const oldNav = document.getElementById("bottom-nav");
    if (oldNav) oldNav.remove();

    const hash = location.hash || "";
    // #/assembly/new — форма создания
    // #/assembly/<id> — детальная карточка
    if (hash === "#/assembly/new" || hash.startsWith("#/assembly/new?")) {
      resetState();
      prefillFromSession();
      renderForm();
    } else if (hash.startsWith("#/assembly/")) {
      const id = hash.replace("#/assembly/", "").split("?")[0];
      renderDetail(id);
    } else {
      // Список (для мастера)
      renderList();
    }
  }

  function resetState() {
    state = {
      client_name: "",
      client_phone: "",
      address: "",
      scope_of_work: "",
      measurement_id: "",
      lead_id: "",
      scheduled_at: "",
      manager_note: "",
    };
  }

  function prefillFromSession() {
    try {
      const raw = sessionStorage.getItem("prefillAssembly");
      if (raw) {
        const pre = JSON.parse(raw);
        if (pre.name) state.client_name = pre.name;
        if (pre.phone) state.client_phone = pre.phone;
        if (pre.address) state.address = pre.address;
        if (pre.measurement_id) state.measurement_id = pre.measurement_id;
        if (pre.lead_id) state.lead_id = pre.lead_id;
        sessionStorage.removeItem("prefillAssembly");
      }
    } catch (e) {}
  }

  function headerEl(title, backHash) {
    const h = el(`
      <header class="podbor-header">
        <button class="podbor-back" aria-label="Назад">${ICONS.arrow_left || "‹"}</button>
        <div class="podbor-title">${escHtml(title)}</div>
        <div style="width:28px"></div>
      </header>
    `);
    h.querySelector(".podbor-back").addEventListener("click", () => {
      if (backHash) location.hash = backHash;
      else history.back();
    });
    return h;
  }

  /* ===================== Форма создания ===================== */

  function renderForm() {
    if (!root) return;
    root.innerHTML = "";
    root.appendChild(headerEl("Заказать сборку", ""));

    const form = el(`
      <section class="podbor-step">
        <h2 class="display-title">Новая<br><span class="accent">сборка</span></h2>
        <p class="lede">Опишите состав работ — мастер получит карточку с адресом и датой.</p>

        <div class="form-row">
          <label class="field">
            <span class="field-label">ФИО клиента *</span>
            <input type="text" data-bind="client_name" value="${escAttr(state.client_name)}" placeholder="Иванов Иван Иванович">
            <span class="field-error" id="errName"></span>
          </label>
        </div>

        <div class="form-row">
          <label class="field">
            <span class="field-label">Телефон</span>
            <input type="tel" data-bind="client_phone" value="${escAttr(state.client_phone)}" placeholder="+7 921 555-12-34">
          </label>
        </div>

        <div class="form-row">
          <label class="field">
            <span class="field-label">Адрес сборки *</span>
            <input type="text" data-bind="address" value="${escAttr(state.address)}" placeholder="СПб, Просвещения 87, кв. 12">
            <span class="field-error" id="errAddress"></span>
          </label>
        </div>

        <div class="form-row">
          <label class="field">
            <span class="field-label">Состав работ *</span>
            <textarea data-bind="scope_of_work" rows="4" placeholder="Кухня по проекту, корпус по чертежу, столешница из камня (отдельный замер), 8 фасадов, варочная Bosch, духовка Bosch, вытяжка Faber, посудомойка Bosch встроенная.">${escHtml(state.scope_of_work)}</textarea>
            <span class="field-error" id="errScope"></span>
          </label>
        </div>

        <div class="form-row">
          <label class="field">
            <span class="field-label">Дата и время (можно позже)</span>
            <input type="datetime-local" data-bind="scheduled_at" value="${state.scheduled_at}">
            <span class="field-hint">Если оставите пустым — назначите позже на главной</span>
          </label>
        </div>

        <div class="form-row">
          <label class="field">
            <span class="field-label">Заметка мастеру</span>
            <textarea data-bind="manager_note" rows="2" placeholder="код домофона, особенности заезда, ключевой контакт на месте">${escHtml(state.manager_note)}</textarea>
          </label>
        </div>

        <div class="podbor-cta-row" style="margin-top:18px;">
          <button class="btn-primary" id="submitBtn">Заказать сборку</button>
        </div>
        <div id="submitResult" class="submit-result"></div>
      </section>
    `);

    bindInputs(form);
    form.querySelector("#submitBtn").addEventListener("click", () => onSubmit(form));
    root.appendChild(form);
  }

  function bindInputs(node) {
    node.querySelectorAll("[data-bind]").forEach(input => {
      input.addEventListener("input", () => {
        state[input.dataset.bind] = input.value;
      });
    });
  }

  async function onSubmit(form) {
    const btn = form.querySelector("#submitBtn");
    const result = form.querySelector("#submitResult");
    result.innerHTML = "";
    form.querySelectorAll(".field-error").forEach(e => e.textContent = "");

    let ok = true;
    if (!state.client_name.trim()) {
      form.querySelector("#errName").textContent = "Укажите имя клиента";
      ok = false;
    }
    if (!state.address.trim()) {
      form.querySelector("#errAddress").textContent = "Укажите адрес сборки";
      ok = false;
    }
    if (!state.scope_of_work.trim()) {
      form.querySelector("#errScope").textContent = "Опишите состав работ";
      ok = false;
    }
    if (!ok) return;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-inline"></span> сохраняем...';

    const body = {
      initData: tg?.initData || "",
      initDataUnsafe: tg?.initDataUnsafe || null,
      client_name: state.client_name.trim(),
      client_phone: state.client_phone.trim(),
      address: state.address.trim(),
      scope_of_work: state.scope_of_work.trim(),
      measurement_id: state.measurement_id,
      lead_id: state.lead_id,
      scheduled_at: state.scheduled_at ? new Date(state.scheduled_at).toISOString() : "",
      manager_note: state.manager_note.trim(),
    };

    try {
      const res = await fetch(`${BACKEND_URL}/api/assembly_create`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) {
        result.innerHTML = `<div class="error">Ошибка: ${escHtml(data.error)}</div>`;
        btn.disabled = false;
        btn.textContent = "Заказать сборку";
        return;
      }
      haptic && haptic("success");
      result.innerHTML = `
        <div class="success">
          <div class="success-icon">${ICONS.check || "✓"}</div>
          <div>
            <div class="success-title">Сборка заведена</div>
            <div class="success-sub">ID #${(data.id || "").slice(0, 6)} · ${data.status === "scheduled" ? "дата назначена" : "без даты"}</div>
          </div>
        </div>
        <div class="podbor-cta-row" style="margin-top:16px;">
          <button class="btn-secondary" id="toHome">На главную</button>
          <button class="btn-primary" id="toDetail">Открыть карточку</button>
        </div>
      `;
      btn.style.display = "none";
      result.querySelector("#toHome")?.addEventListener("click", () => {
        location.hash = "";
        location.reload();
      });
      result.querySelector("#toDetail")?.addEventListener("click", () => {
        location.hash = `#/assembly/${data.id}`;
      });
    } catch (e) {
      result.innerHTML = `<div class="error">Сеть: ${escHtml(e.message)}</div>`;
      btn.disabled = false;
      btn.textContent = "Заказать сборку";
    }
  }

  /* ===================== Список сборок ===================== */

  async function renderList() {
    if (!root) return;
    root.innerHTML = "";
    root.appendChild(headerEl("Сборки", ""));
    const loading = el(`<div class="loader-inline"><div class="spinner"></div></div>`);
    root.appendChild(loading);
    try {
      const res = await fetch(`${BACKEND_URL}/api/assembly_list`, {
        method: "POST",
        body: JSON.stringify({
          initData: tg?.initData || "",
          initDataUnsafe: tg?.initDataUnsafe || null,
        }),
      });
      const data = await res.json();
      loading.remove();
      if (data.error) {
        root.appendChild(el(`<div class="error">${escHtml(data.error)}</div>`));
        return;
      }
      const items = data.assemblies || [];
      if (!items.length) {
        root.appendChild(el(`<div class="empty" style="padding:32px;text-align:center;color:var(--muted);">Сборок пока нет</div>`));
        return;
      }
      const list = el(`<div class="assembly-list"></div>`);
      for (const a of items) {
        const dateStr = a.scheduled_at ? formatDateHuman(a.scheduled_at) : "—";
        const statusLabel = {
          created: "📝 создана",
          scheduled: "📅 назначена",
          in_progress: "🔧 в работе",
          completed: "✅ завершена",
          cancelled: "❌ отменена",
        }[a.status] || a.status;
        const card = el(`
          <article class="assembly-card" data-id="${a.id}">
            <div class="assembly-card-head">
              <span class="assembly-card-status">${statusLabel}</span>
              <span class="assembly-card-date">${escHtml(dateStr)}</span>
            </div>
            <div class="assembly-card-name">${escHtml(a.client_name || "Без имени")}</div>
            <div class="assembly-card-address">${escHtml(a.address || "адрес не указан")}</div>
            ${a.scope_of_work ? `<div class="assembly-card-scope">${escHtml(a.scope_of_work.slice(0, 120))}${a.scope_of_work.length > 120 ? "…" : ""}</div>` : ""}
          </article>
        `);
        card.addEventListener("click", () => {
          haptic && haptic("impact");
          location.hash = `#/assembly/${a.id}`;
        });
        list.appendChild(card);
      }
      root.appendChild(list);
    } catch (e) {
      loading.remove();
      root.appendChild(el(`<div class="error">Сеть: ${escHtml(e.message)}</div>`));
    }
  }

  /* ===================== Детальная карточка ===================== */

  async function renderDetail(id) {
    if (!root) return;
    root.innerHTML = "";
    root.appendChild(headerEl("Сборка", ""));
    const loading = el(`<div class="loader-inline"><div class="spinner"></div></div>`);
    root.appendChild(loading);
    let a;
    try {
      const res = await fetch(`${BACKEND_URL}/api/assembly_detail`, {
        method: "POST",
        body: JSON.stringify({
          initData: tg?.initData || "",
          initDataUnsafe: tg?.initDataUnsafe || null,
          assembly_id: id,
        }),
      });
      a = await res.json();
    } catch (e) {
      loading.remove();
      root.appendChild(el(`<div class="error">Сеть: ${escHtml(e.message)}</div>`));
      return;
    }
    loading.remove();
    if (a.error) {
      root.appendChild(el(`<div class="error">${escHtml(a.error)}</div>`));
      return;
    }

    const dateStr = a.scheduled_at ? formatDateHuman(a.scheduled_at) : "Не назначена";
    const statusLabel = {
      created: "📝 создана",
      scheduled: "📅 назначена",
      in_progress: "🔧 в работе",
      completed: "✅ завершена",
      cancelled: "❌ отменена",
    }[a.status] || a.status;

    root.appendChild(el(`
      <div class="measurement-detail-head">
        <div class="kicker">Сборка #${(a.id || "").slice(0, 8)} · ${statusLabel}</div>
        <h2 class="display-title">${escHtml(a.client_name || "Без имени")}</h2>
        <div class="measurement-detail-meta">
          ${a.client_phone ? `<span>📞 ${escHtml(a.client_phone)}</span>` : ""}
          <span>📍 ${escHtml(a.address || "адрес не указан")}</span>
          <span>📅 ${escHtml(dateStr)}</span>
        </div>
      </div>
    `));

    if (a.gcal_event_url) {
      root.appendChild(el(`
        <div style="padding:4px 16px 8px;">
          <a href="${a.gcal_event_url}" target="_blank" rel="noopener" style="color:var(--accent-1, #003E7E);font-size:13px;">📅 Открыть в Google Calendar</a>
        </div>
      `));
    }

    root.appendChild(el(`
      <section class="block">
        <div class="block-head">🛠 Состав работ</div>
        <div style="padding:12px 4px;color:var(--ink);font-size:14.5px;line-height:1.5;white-space:pre-wrap;">${escHtml(a.scope_of_work || "—")}</div>
      </section>
    `));

    if (a.manager_note) {
      root.appendChild(el(`
        <section class="block">
          <div class="block-head">📝 Заметка от менеджера</div>
          <div style="padding:12px 4px;color:var(--ink);font-size:14px;line-height:1.4;white-space:pre-wrap;">${escHtml(a.manager_note)}</div>
        </section>
      `));
    }

    // Этапы 2-3 (фото / подпись) — добавим в следующем коммите
    root.appendChild(el(`
      <div style="padding:18px 16px;text-align:center;color:var(--muted);font-size:13px;">
        Фото-отчёт и приёмка появятся в следующем обновлении.
      </div>
    `));
  }

  /* ===================== Helpers ===================== */

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escAttr(s) { return escHtml(s); }

  return { mount };
})();
