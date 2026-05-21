/* ============================================================
   Экран «Мой профиль» — #/me
   Работает для всех ролей: manager, staff, client
   ============================================================ */

const MeScreen = (function () {

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  async function _fetchWithTimeout(url, body, ms = 15000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return await res.json();
    } catch (e) {
      if (e.name === "AbortError") throw new Error("Сервер не отвечает");
      throw e;
    } finally { clearTimeout(t); }
  }

  function header(container) {
    const h = document.createElement("header");
    h.className = "podbor-header";
    h.innerHTML = `
      <button class="podbor-back" aria-label="Назад">${(window.ICONS || {}).arrow_left || "‹"}</button>
      <div class="podbor-title">Мой профиль</div>
      <div style="width:36px"></div>
    `;
    h.querySelector(".podbor-back").addEventListener("click", () => {
      haptic && haptic("impact");
      history.back();
    });
    container.appendChild(h);
  }

  function avatarBlock(initial, name, subtitle) {
    return `
      <div style="display:flex;align-items:center;gap:14px;padding:20px 16px 8px">
        <div style="width:52px;height:52px;border-radius:50%;background:var(--accent);
                    display:flex;align-items:center;justify-content:center;
                    font-size:22px;font-weight:700;color:#fff;flex-shrink:0;">
          ${escHtml(initial)}
        </div>
        <div>
          <div style="font-weight:600;font-size:16px;color:var(--ink);">${escHtml(name)}</div>
          ${subtitle ? `<div style="font-size:12px;color:var(--muted);margin-top:2px;">${escHtml(subtitle)}</div>` : ""}
        </div>
      </div>
    `;
  }

  function roleChip(label, color) {
    const colors = { gold: "#C5A55E", blue: "#3D7AB5", green: "#4A9E6A", muted: "var(--muted)" };
    const c = colors[color] || colors.gold;
    return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;
                         font-size:11px;font-weight:600;letter-spacing:.04em;
                         background:${c}22;color:${c};margin-right:6px;margin-bottom:4px;">
              ${escHtml(label)}
            </span>`;
  }

  function renderManager(container, me) {
    const u = me.user || {};
    const statusLabel = me.status === "active" ? "✅ Активен" :
                        me.status === "trial"  ? "🟡 Пробный" : "🔴 Неактивен";
    const statusColor = me.status === "active" ? "green" :
                        me.status === "trial"  ? "gold"  : "muted";

    const screen = document.createElement("div");
    screen.className = "podbor-screen";
    screen.innerHTML = `
      ${avatarBlock(u.avatar_initial || "?", u.full_name || "Менеджер", u.salon || "")}

      <div class="block" style="margin:12px 16px 0;">
        <div class="block-head">Статус доступа</div>
        <div class="kv">
          <span>Статус</span>
          <strong>${roleChip(statusLabel, statusColor)}</strong>
        </div>
        ${me.status_until ? `<div class="kv"><span>Активен до</span><strong>${escHtml(me.status_until)}</strong></div>` : ""}
        ${u.salon ? `<div class="kv"><span>Салон</span><strong>${escHtml(u.salon)}</strong></div>` : ""}
      </div>

      <div class="block" style="margin:12px 16px 0;">
        <div class="block-head">Быстрый переход</div>
        <div class="podbor-cta-row" style="flex-wrap:wrap;gap:8px;padding-top:4px;">
          <button class="btn-secondary" data-href="#/clients">👥 Клиенты</button>
          <button class="btn-secondary" data-href="#/measurements">📐 Замеры</button>
          <button class="btn-secondary" data-href="#/assembly">🔨 Сборки</button>
          <button class="btn-secondary" data-href="#/request">📋 Заявка</button>
        </div>
      </div>
    `;
    screen.querySelectorAll("[data-href]").forEach(btn => {
      btn.addEventListener("click", () => {
        haptic && haptic("impact");
        location.hash = btn.dataset.href;
      });
    });
    container.appendChild(screen);
  }

  const EQUIPMENT_ITEMS = [
    { key: "tablet",       label: "Планшет с ПО для замеров",              icon: "📱" },
    { key: "laser_tape",   label: "Лазерная рулетка (интеграция с ПО)",    icon: "📡" },
    { key: "angle_meter",  label: "Угломер",                               icon: "📐" },
    { key: "tape",         label: "Обычная рулетка",                       icon: "📏" },
    { key: "laser_level",  label: "Лазерный уровень",                      icon: "🔴" },
  ];

  function renderStaffMe(container, me) {
    const u = me.user || {};
    const caps = me.capabilities || {};
    const eqList = me.equipment || [];
    const eqOk = me.equipment_ok !== false;

    const chips = [
      caps.measurer && roleChip("замерщик", "blue"),
      caps.assembler && roleChip("сборщик", "green"),
    ].filter(Boolean).join("");

    // Бейдж укомплектованности
    const eqBadge = caps.measurer ? `
      <div style="margin:0 16px 12px;padding:10px 14px;border-radius:10px;
                  background:${eqOk ? "#27AE6015" : "#E74C3C15"};
                  border:1px solid ${eqOk ? "#27AE60" : "#E74C3C"};">
        <div style="font-size:13px;font-weight:700;color:${eqOk ? "#27AE60" : "#E74C3C"};">
          ${eqOk ? "✅ Укомплектован — допуск к замерам открыт" : "⚠️ Не укомплектован — допуск ограничен"}
        </div>
        ${!eqOk ? `<div style="font-size:12px;color:var(--muted);margin-top:4px;">
          Заполните список оборудования ниже
        </div>` : ""}
      </div>` : "";

    const screen = document.createElement("div");
    screen.className = "podbor-screen";
    screen.innerHTML = `
      ${avatarBlock(u.avatar_initial || "?", u.full_name || "Сотрудник", "")}
      <div style="padding:4px 16px 10px;">${chips}</div>
      ${eqBadge}

      <div class="block" style="margin:0 16px;">
        <div class="block-head">Мои задачи</div>
        <div class="podbor-cta-row" style="flex-wrap:wrap;gap:8px;padding-top:4px;">
          ${caps.measurer ? `<button class="btn-secondary" data-href="#/master">📥 Входящие заявки</button>` : ""}
          ${caps.measurer ? `<button class="btn-secondary" data-href="#/measure">📐 Новый замер</button>` : ""}
          ${caps.assembler ? `<button class="btn-secondary" data-href="#/assembly">🔨 Мои сборки</button>` : ""}
        </div>
      </div>

      ${caps.measurer ? `
      <div class="block" style="margin:12px 16px 0;" id="equipment-block">
        <div class="block-head">Оборудование</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:10px;">
          Все 5 пунктов обязательны для допуска к замерам
        </div>
        <div id="eq-checklist"></div>
        <button id="eq-save-btn" class="btn-primary"
                style="width:100%;padding:12px;font-size:14px;margin-top:12px;">
          Сохранить оборудование
        </button>
        <div id="eq-status" style="font-size:12px;text-align:center;margin-top:8px;color:var(--muted);"></div>
      </div>` : ""}
    `;

    screen.querySelectorAll("[data-href]").forEach(btn => {
      btn.addEventListener("click", () => {
        haptic && haptic("impact");
        location.hash = btn.dataset.href;
      });
    });

    container.appendChild(screen);

    // Чеклист оборудования
    if (caps.measurer) {
      const checklist = screen.querySelector("#eq-checklist");
      EQUIPMENT_ITEMS.forEach(item => {
        const checked = eqList.includes(item.key);
        const row = document.createElement("label");
        row.style.cssText = `display:flex;align-items:center;gap:10px;padding:10px 0;
          border-bottom:1px solid var(--border);cursor:pointer;`;
        row.innerHTML = `
          <input type="checkbox" data-key="${item.key}" ${checked ? "checked" : ""}
                 style="width:18px;height:18px;accent-color:var(--accent);flex-shrink:0;">
          <span style="font-size:14px;">${item.icon}</span>
          <span style="font-size:13px;color:var(--ink);">${escHtml(item.label)}</span>
        `;
        checklist.appendChild(row);
      });

      // Кнопка сохранить
      const saveBtn = screen.querySelector("#eq-save-btn");
      const statusEl = screen.querySelector("#eq-status");
      saveBtn.addEventListener("click", async () => {
        haptic && haptic("impact");
        saveBtn.disabled = true;
        saveBtn.textContent = "Сохраняем…";
        const selected = Array.from(checklist.querySelectorAll("input[data-key]:checked"))
          .map(cb => cb.dataset.key);
        try {
          const res = await _fetchWithTimeout(`${BACKEND_URL}/api/equipment_save`, {
            initData: typeof Platform !== "undefined" ? Platform.initData : (window.tg?.initData || ""),
            initDataUnsafe: typeof Platform !== "undefined" ? Platform.initDataUnsafe : null,
            equipment: selected,
          });
          if (res.ok) {
            statusEl.style.color = res.equipment_ok ? "#27AE60" : "#E74C3C";
            statusEl.textContent = res.equipment_ok
              ? "✅ Сохранено. Допуск открыт."
              : "⚠️ Сохранено. Заполните все пункты для допуска.";
            // Обновить бейдж
            const badge = container.querySelector("#equipment-block")?.closest(".podbor-screen")?.querySelector("[style*='Укомплектован']") ||
              container.querySelector("[style*='допуск']");
          } else {
            statusEl.style.color = "#E74C3C";
            statusEl.textContent = "Ошибка: " + (res.error || "неизвестно");
          }
        } catch (e) {
          statusEl.style.color = "#E74C3C";
          statusEl.textContent = "Ошибка: " + e.message;
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = "Сохранить оборудование";
        }
      });
    }
  }

  function renderClientMe(container, me) {
    const u = me.user || {};
    const mgr = me.manager || {};

    const screen = document.createElement("div");
    screen.className = "podbor-screen";
    screen.innerHTML = `
      ${avatarBlock(u.avatar_initial || "?", u.full_name || "Клиент", "Личный кабинет")}

      ${mgr.full_name ? `
        <div class="block" style="margin:12px 16px 0;">
          <div class="block-head">Мой менеджер</div>
          <div class="kv"><span>Имя</span><strong>${escHtml(mgr.full_name)}</strong></div>
          ${mgr.salon ? `<div class="kv"><span>Салон</span><strong>${escHtml(mgr.salon)}</strong></div>` : ""}
        </div>
      ` : ""}

      <div class="block" style="margin:12px 16px 0;">
        <div class="podbor-cta-row" style="flex-wrap:wrap;gap:8px;padding-top:4px;">
          <button class="btn-primary" data-href="#/c/cabinet">🏠 Мой кабинет</button>
          <button class="btn-secondary" data-href="#/c/proposal">🛒 Подбор</button>
        </div>
      </div>
    `;
    screen.querySelectorAll("[data-href]").forEach(btn => {
      btn.addEventListener("click", () => {
        haptic && haptic("impact");
        location.hash = btn.dataset.href;
      });
    });
    container.appendChild(screen);
  }

  async function mount(container) {
    container.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    const oldNav = document.getElementById("bottom-nav");
    if (oldNav) oldNav.remove();

    header(container);

    const loading = document.createElement("div");
    loading.className = "loader-inline";
    loading.innerHTML = `<div class="spinner"></div>`;
    container.appendChild(loading);

    try {
      const me = await _fetchWithTimeout(`${BACKEND_URL}/api/me`, {
        initData: tg?.initData || "",
        initDataUnsafe: tg?.initDataUnsafe || null,
      });
      loading.remove();

      if (me.error) {
        container.appendChild(el(`<div class="error" style="margin:16px;">${escHtml(me.error)}</div>`));
        return;
      }

      const role = me.role;
      if (role === "manager" || me.roles?.includes("manager")) {
        renderManager(container, me);
      } else if (role === "staff") {
        renderStaffMe(container, me);
      } else {
        renderClientMe(container, me);
      }
    } catch (e) {
      loading.remove();
      container.appendChild(el(`<div class="error" style="margin:16px;">Ошибка: ${escHtml(e.message)}</div>`));
    }
  }

  return { mount };
})();
