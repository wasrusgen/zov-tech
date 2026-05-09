// ЗОВ MiniApp — главный скрипт.
// На входе: подписанный initData от Telegram.
// Ходим на backend → получаем профиль (роль, статус) → рендерим меню.

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbyxSwfD4hi5Y176nKV3tmnQq21kCQM3BBm34WGgObgAuybsAW7WPEuxlrPZ1a16viK3/exec";

const app = document.getElementById("app");

/* ----------------- Telegram WebApp setup ----------------- */
function setupTelegram() {
  const scheme = tg?.colorScheme || (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", scheme);
  // Зафиксирован вариант A — Editorial Calm
  document.documentElement.setAttribute("data-variant", "a");

  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    if (tg.onEvent) tg.onEvent("themeChanged", () => {
      document.documentElement.setAttribute("data-theme", tg.colorScheme || "light");
    });
    if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
  } catch (e) { console.warn(e); }
}

function haptic(type = "selection") {
  try {
    if (!tg?.HapticFeedback) return;
    if (type === "impact") tg.HapticFeedback.impactOccurred("light");
    else if (type === "success") tg.HapticFeedback.notificationOccurred("success");
    else tg.HapticFeedback.selectionChanged();
  } catch (e) {}
}

/* ----------------- Data ----------------- */
async function fetchMe() {
  if (!BACKEND_URL) {
    // dev-режим без backend — мок для просмотра вёрстки
    return {
      role: "manager",
      user: {
        full_name: "Руслан Васильев",
        salon: "ЗОВ Москва",
        avatar_initial: "Р",
      },
      status: "active",
      status_until: "12.08.2026",
    };
  }
  // Apps Script Web App: путь через query-параметр.
  // Заголовок Content-Type НЕ ставим — иначе браузер шлёт CORS preflight,
  // который Apps Script не обрабатывает. Без заголовка fetch использует
  // text/plain — Apps Script всё равно парсит body как JSON.
  const res = await fetch(`${BACKEND_URL}?path=me`, {
    method: "POST",
    body: JSON.stringify({
      initData: tg?.initData || "",
      startParam: tg?.initDataUnsafe?.start_param || null,
    }),
  });
  if (!res.ok) throw new Error("backend HTTP " + res.status);
  return res.json();
}

/* ----------------- Helpers ----------------- */
function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstChild;
}

function statusLabel(s) {
  return ({
    active: "Активен",
    lapsed: "Ограничен",
    grace:  "Грейс",
  })[s] || s;
}

function getInitial(name) {
  return (name || "").trim().slice(0, 1).toUpperCase() || "?";
}

/* ----------------- Renders ----------------- */
function renderManager(me) {
  const status = me.status || "active";
  const statusUntil = me.status_until ? `до ${me.status_until}` : "";
  const initial = me.user?.avatar_initial || getInitial(me.user?.full_name);
  const tgId = me.user?.tg_id ? `ID ${me.user.tg_id}` : "";

  app.innerHTML = "";

  app.appendChild(el(`
    <header class="profile-card">
      <div class="role-tag">Менеджер</div>
      <div class="head-row">
        <div class="info">
          <div class="name">${me.user?.full_name || ""}</div>
          <div class="meta">${me.user?.salon || ""}</div>
        </div>
        <div class="avatar">${initial}</div>
      </div>
      <div class="meta-row">
        <span class="status-row">
          <span class="status-dot ${status}"></span>
          <span>${statusLabel(status)}</span>
        </span>
        ${statusUntil ? `<span class="sep">·</span><span>${statusUntil}</span>` : ""}
        ${tgId ? `<span class="sep">·</span><span>${tgId}</span>` : ""}
      </div>
    </header>
  `));

  const sections = [
    {
      label: "Работа с клиентами",
      items: [
        { icon: "wrench",    color: "green", label: "Подбор техники для клиента", href: "#/m/podbor" },
        { icon: "ruler",     color: "blue",  label: "Замеры",                     href: "#/m/measurements" },
        { icon: "clipboard", color: "gold",  label: "Заявки клиентов", soon: true },
        { icon: "briefcase", color: "gray",  label: "Сделки",          soon: true },
      ],
    },
    {
      label: "Аккаунт",
      items: [
        { icon: "wallet", color: "gold", label: "Мой статус и доступ", href: "#/m/status" },
        { icon: "help",   color: "blue", label: "Связь с куратором",   href: "#/m/help"   },
      ],
    },
  ];

  sections.forEach(section => {
    app.appendChild(el(`<div class="section-label">${section.label}</div>`));
    app.appendChild(buildMenu(section.items));
  });

  app.appendChild(el(`
    <div class="footer-hint">
      <div class="signature">Куратор партнёрской сети — Руслан Васильев</div>
      <div class="meta">
        <a href="https://t.me/wasrusgen">@wasrusgen</a> · ЗОВ
      </div>
    </div>
  `));
}

function renderClient(me) {
  const initial = me.user?.avatar_initial || getInitial(me.user?.full_name) || "?";
  const greetName = me.user?.full_name || "Здравствуйте";

  app.innerHTML = "";

  app.appendChild(el(`
    <header class="profile-card">
      <div class="role-tag">Клиент</div>
      <div class="head-row">
        <div class="info">
          <div class="name">${greetName}</div>
          <div class="meta">${me.manager ? "Менеджер: " + me.manager.full_name + (me.manager.salon ? ", " + me.manager.salon : "") : "ЗОВ — кухонная мебель"}</div>
        </div>
        <div class="avatar">${initial}</div>
      </div>
    </header>
  `));

  const sections = [
    {
      label: "Подобрать кухню",
      items: [
        { icon: "ruler",     color: "blue",  label: "Замер кухни",         href: "#/c/measure"  },
        { icon: "wrench",    color: "green", label: "Подобрать технику",   soon: true },
        { icon: "wallet",    color: "gold",  label: "Калькулятор бюджета", soon: true },
      ],
    },
    {
      label: "Помощь",
      items: [
        { icon: "lightbulb", color: "gold",  label: "Идеи и кейсы",        soon: true },
        { icon: "phone",     color: "blue",  label: "Связаться с менеджером", href: "#/c/contact" },
        { icon: "pin",       color: "green", label: "Записаться в салон",  soon: true },
      ],
    },
  ];

  sections.forEach(section => {
    app.appendChild(el(`<div class="section-label">${section.label}</div>`));
    app.appendChild(buildMenu(section.items));
  });

  app.appendChild(el(`
    <div class="footer-hint">
      <div class="signature">Фабрика кухонной мебели «ЗОВ»</div>
      <div class="meta">
        <a href="https://t.me/wasrusgen1">канал @wasrusgen1</a>
      </div>
    </div>
  `));
}

function buildMenu(items) {
  const menu = el(`<nav class="menu"></nav>`);
  items.forEach(item => {
    const cls = item.soon ? "menu-item disabled" : "menu-item";
    const node = el(`
      <a class="${cls}" ${item.href && !item.soon ? `href="${item.href}"` : ""}>
        <div class="icon ${item.color}">${ICONS[item.icon] || ""}</div>
        <div class="text">
          <div class="label">
            ${item.label}
            ${item.soon ? '<span class="badge">скоро</span>' : ""}
          </div>
          ${item.sub ? `<div class="sub">${item.sub}</div>` : ""}
        </div>
        ${item.soon ? "" : `<div class="chevron">${ICONS.chevron}</div>`}
      </a>
    `);
    if (!item.soon) node.addEventListener("click", () => haptic("impact"));
    menu.appendChild(node);
  });
  return menu;
}

function renderError() {
  app.innerHTML = "";
  app.appendChild(el(`
    <div class="error">
      <h3>Не удалось загрузить кабинет</h3>
      <div>Проверьте подключение и попробуйте позже.</div>
    </div>
  `));
}

/* ----------------- Init ----------------- */
async function init() {
  setupTelegram();
  try {
    const me = await fetchMe();
    if (me.role === "manager") renderManager(me);
    else renderClient(me);
  } catch (e) {
    console.error(e);
    renderError();
  }
}

init();
