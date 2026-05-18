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
      const res = await fetch(url, { method: "POST", signal: ctrl.signal, body: JSON.stringify(body) });
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

  function renderStaffMe(container, me) {
    const u = me.user || {};
    const caps = me.capabilities || {};
    const chips = [
      caps.measurer && roleChip("замерщик", "blue"),
      caps.assembler && roleChip("сборщик", "green"),
    ].filter(Boolean).join("");

    const screen = document.createElement("div");
    screen.className = "podbor-screen";
    screen.innerHTML = `
      ${avatarBlock(u.avatar_initial || "?", u.full_name || "Сотрудник", "")}

      <div style="padding:4px 16px 12px;">${chips}</div>

      <div class="block" style="margin:0 16px;">
        <div class="block-head">Мои задачи</div>
        <div class="podbor-cta-row" style="flex-wrap:wrap;gap:8px;padding-top:4px;">
          ${caps.measurer ? `<button class="btn-secondary" data-href="#/master">📥 Входящие заявки</button>` : ""}
          ${caps.measurer ? `<button class="btn-secondary" data-href="#/measure">📐 Новый замер</button>` : ""}
          ${caps.assembler ? `<button class="btn-secondary" data-href="#/assembly">🔨 Мои сборки</button>` : ""}
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
          <button class="btn-secondary" data-href="#/picker">🛒 Подбор</button>
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
