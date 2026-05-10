// ЗОВ MiniApp — главный скрипт.
// На входе: подписанный initData от Telegram.
// Ходим на backend → получаем профиль (роль, статус) → рендерим меню.

const tg = window.Telegram?.WebApp;
// Cloudflare Quick Tunnel → VPS FastAPI backend (GigaChat).
// Временный URL — пока wasrusgen1.pro в verification-hold; затем переключим на https://api.wasrusgen1.pro
const BACKEND_URL = "https://prepared-alfred-story-dale.trycloudflare.com";

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
  // Роль приходит в URL (?role=manager|client) — её бот подставляет в WebApp-кнопку
  const urlParams = new URLSearchParams(window.location.search);
  const explicitRole = urlParams.get("role");

  const res = await fetch(`${BACKEND_URL}/api/me`, {
    method: "POST",
    body: JSON.stringify({
      initData: tg?.initData || "",
      startParam: tg?.initDataUnsafe?.start_param || null,
      role: explicitRole,
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
  // Новый главный экран — «утро менеджера»
  return renderManagerHome(me);
}

function timeOfDay(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12)  return "Доброе утро";
  if (h >= 12 && h < 18) return "Добрый день";
  if (h >= 18 && h < 23) return "Добрый вечер";
  return "Доброй ночи";
}

function pluralRu(n, forms) {
  // forms = ["замер", "замера", "замеров"]
  const mod10 = n % 10, mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

function renderManagerHome(me) {
  // === MOCK DATA (Этап 1 — визуал, без реального backend) ===
  const firstName = (me.user?.full_name || "").split(/\s+/)[0] || "Артём";
  const todayTask = {
    time: "15:30",
    tag: "ЗАМЕР",
    client: "А. Пестова",
    address: "ЖК Сады Пекина, корп. 3",
    phone: "+7 999 000-00-00",
  };
  const projects = [
    { name: "Семья Иваниковых", address: "ул. Орджоникидзе, 14 — 47", stage: "Согласование", date: "14 мая", progress: 0.40, statusLabel: "Ожидает клиента", statusKind: "waiting" },
    { name: "Кабанова И. С.",   address: "Никольская набережная, 20", stage: "Производство", date: "21 мая", progress: 0.60, statusLabel: "В работе", statusKind: "active" },
    { name: "Карелин А.",       address: "посёлок Сосновый, дом 4",   stage: "Замер",        date: "сегодня", progress: 0.10, statusLabel: "Срочно", statusKind: "urgent" },
    { name: "Петросян Г.",      address: "ул. Лесная, 18 — 12",       stage: "Доставка",     date: "16 мая", progress: 0.85, statusLabel: "В работе", statusKind: "active" },
    { name: "Тимирясов И.",     address: "пос. Барвиха, дом 8",       stage: "Монтаж",       date: "11 мая", progress: 0.95, statusLabel: "Завершается", statusKind: "active" },
  ];
  const unreadChats = 2;
  const tasksTodayCount = todayTask ? 1 : 0;
  const taskWord = pluralRu(tasksTodayCount, ["замер", "замера", "замеров"]);
  const phraseTail = tasksTodayCount === 0 ? "ничего на сегодня" : `${tasksTodayCount === 1 ? "один" : tasksTodayCount} ${taskWord} сегодня`;

  // === RENDER ===
  app.innerHTML = "";
  document.body.classList.add("has-bottom-nav");

  // Greeting
  app.appendChild(el(`
    <header class="greeting">
      <div class="greeting-text">
        <div class="greeting-kicker">${timeOfDay()}</div>
        <div class="greeting-headline">${firstName},<br>
          <span class="accent">${phraseTail}</span>
        </div>
      </div>
      <button class="bell-btn" aria-label="Уведомления">
        ${ICONS.bell}
        <span class="dot"></span>
      </button>
    </header>
  `));

  // Hero task
  if (todayTask) {
    app.appendChild(el(`
      <section class="hero">
        <div class="hero-meta">
          <span class="left">
            <span>На сегодня</span><span class="sep">—</span><span>${todayTask.time}</span>
          </span>
          <span class="hero-tag">${todayTask.tag}</span>
        </div>
        <div class="hero-client">${todayTask.client}</div>
        <div class="hero-address">${todayTask.address}</div>
        <div class="hero-actions">
          <button class="btn-gold">${ICONS.ruler}<span>Начать замер</span></button>
          <a class="btn-icon-dark" href="tel:${todayTask.phone}" aria-label="Позвонить">${ICONS.phone}</a>
        </div>
      </section>
    `));
  }

  // Quick actions
  const quickActions = [
    { icon: "camera",  title: "Новый замер",   subtitle: "С фото",      href: null },
    { icon: "cube",    title: "3D просмотр",   subtitle: "Проекты",     href: null },
    { icon: "bolt",    title: "Коммуникации",  subtitle: "Чек-лист",    href: null },
    { icon: "package", title: "Подбор техники", subtitle: "Встройка + AI", href: "#/podbor" },
  ];
  app.appendChild(el(`<div class="section-head"><span class="label">Быстрые действия</span></div>`));
  const grid = el(`<div class="quick-grid"></div>`);
  quickActions.forEach(qa => {
    const card = el(`
      <button class="quick-card">
        <div class="icon">${ICONS[qa.icon] || ""}</div>
        <div class="title">${qa.title}</div>
        <div class="subtitle">${qa.subtitle}</div>
      </button>
    `);
    card.addEventListener("click", () => {
      haptic("impact");
      if (qa.href) location.hash = qa.href;
      else tg?.showAlert?.(`«${qa.title}» — скоро`);
    });
    grid.appendChild(card);
  });
  app.appendChild(grid);

  // Active projects
  app.appendChild(el(`
    <div class="section-head">
      <span class="label">Активные проекты <span class="count">· ${projects.length}</span></span>
      <span class="more">Все</span>
    </div>
  `));
  const list = el(`<div class="project-list"></div>`);
  projects.forEach(p => {
    const card = el(`
      <article class="project-card">
        <div class="project-head">
          <div class="project-title">${p.name}</div>
          <span class="project-pill ${p.statusKind}">${p.statusLabel}</span>
        </div>
        <div class="project-address">${p.address}</div>
        <div class="project-progress"><div class="bar" style="width:${Math.round(p.progress * 100)}%"></div></div>
        <div class="project-foot">
          <span class="stage">${p.stage}</span>
          <span>${p.date}</span>
        </div>
      </article>
    `);
    card.addEventListener("click", () => { haptic("impact"); tg?.showAlert?.(`Проект «${p.name}» — скоро`); });
    list.appendChild(card);
  });
  app.appendChild(list);

  // Bottom nav (fixed, outside #app)
  renderBottomNav("home", { unreadChats });
}

function renderBottomNav(active, opts = {}) {
  // Удаляем предыдущий, если есть
  const old = document.getElementById("bottom-nav");
  if (old) old.remove();
  const tabs = [
    { key: "home",     icon: "home",   label: "Главная" },
    { key: "projects", icon: "folder", label: "Проекты" },
    { key: "fab",      icon: "plus",   label: "" },
    { key: "chat",     icon: "chat",   label: "Чат",    badge: opts.unreadChats || 0 },
    { key: "profile",  icon: "user",   label: "Профиль" },
  ];
  const nav = el(`<nav class="bottom-nav" id="bottom-nav" role="tablist"></nav>`);
  tabs.forEach(t => {
    const isFab = t.key === "fab";
    const isActive = t.key === active;
    const btn = el(`
      <button class="${isFab ? "fab" : ""} ${isActive && !isFab ? "active" : ""}" aria-label="${t.label || "Создать"}">
        ${ICONS[t.icon] || ""}
        ${isFab || !t.label ? "" : `<span>${t.label}</span>`}
        ${t.badge ? `<span class="badge">${t.badge}</span>` : ""}
      </button>
    `);
    btn.addEventListener("click", () => {
      haptic("impact");
      if (t.key !== active) tg?.showAlert?.(`«${t.label || "Новое"}» — скоро`);
    });
    nav.appendChild(btn);
  });
  document.body.appendChild(nav);
}

function renderClient(me) {
  const initial = me.user?.avatar_initial || getInitial(me.user?.full_name) || "?";
  const greetName = me.user?.full_name || "Здравствуйте";

  app.innerHTML = "";
  document.body.classList.remove("has-bottom-nav");
  const oldNav = document.getElementById("bottom-nav");
  if (oldNav) oldNav.remove();

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
  // Hash-роутер: позволяет открывать подэкраны (например подбор) напрямую
  window.addEventListener("hashchange", routeByHash);

  try {
    const me = await fetchMe();
    window.__zovMe = me; // кешируем профиль для подэкранов
    if (location.hash.startsWith("#/podbor")) {
      Podbor.mount(app);
      return;
    }
    if (me.role === "manager") renderManager(me);
    else renderClient(me);
  } catch (e) {
    console.error(e);
    renderError();
  }
}

function routeByHash() {
  if (location.hash.startsWith("#/podbor")) {
    Podbor.mount(app);
  } else {
    // Главный экран по роли
    const me = window.__zovMe;
    if (!me) { init(); return; }
    if (me.role === "manager") renderManager(me);
    else renderClient(me);
  }
}

init();
