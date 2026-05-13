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
      // Fallback для Telegram Desktop side-panel где initData может приходить пустым.
      // Backend проверит подпись initData первым; если её нет — упадёт сюда. UNSAFE!
      initDataUnsafe: tg?.initDataUnsafe || null,
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
    { icon: "user",    title: "Клиенты",       subtitle: "История подборов",   href: "#/clients" },
    { icon: "package", title: "Подбор техники", subtitle: "Встройка + AI",      href: "#/podbor" },
    { icon: "ruler",   title: "Заказать замер", subtitle: "Назначить замерщика", href: "#/request" },
    { icon: "camera",  title: "Замер сейчас",  subtitle: "Заполнить вручную",  href: "#/measure" },
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

/* ----------------- Role chooser — первый экран MiniApp ----------------- */
function renderRoleChooser() {
  app.innerHTML = "";
  document.body.classList.remove("has-bottom-nav");
  const oldNav = document.getElementById("bottom-nav");
  if (oldNav) oldNav.remove();

  app.appendChild(el(`
    <div class="role-chooser">
      <div class="role-chooser-head">
        <div class="tagline">Сделано с душой!</div>
        <h1 class="display-title">Кто <span class="accent">вы?</span></h1>
        <p class="lede">Выберите роль — кабинет откроется одним тапом.</p>
      </div>
      <div class="role-cards">
        <button class="role-card" data-role="manager">
          <div class="role-icon">👤</div>
          <div class="role-text">
            <div class="role-title">Я менеджер</div>
            <div class="role-sub">Веду клиентов и заказы</div>
          </div>
          <div class="role-arrow">${ICONS.chevron || "›"}</div>
        </button>
        <button class="role-card" data-role="client">
          <div class="role-icon">🏠</div>
          <div class="role-text">
            <div class="role-title">Я клиент</div>
            <div class="role-sub">Заказал кухню ЗОВ</div>
          </div>
          <div class="role-arrow">${ICONS.chevron || "›"}</div>
        </button>
        <button class="role-card" data-role="staff">
          <div class="role-icon">🔧</div>
          <div class="role-text">
            <div class="role-title">Я сотрудник</div>
            <div class="role-sub">Замерщик или сборщик ЗОВ</div>
          </div>
          <div class="role-arrow">${ICONS.chevron || "›"}</div>
        </button>
      </div>
      <p class="muted" style="text-align:center;margin-top:24px;font-size:12px;">
        Свой выбор можно изменить позже в профиле.
      </p>
    </div>
  `));
  app.querySelectorAll(".role-card").forEach(card => {
    card.addEventListener("click", () => {
      const role = card.dataset.role;
      haptic && haptic("impact");
      // Меняем URL и перезапускаем init() — fetchMe пойдёт с правильной ролью
      const qp = new URLSearchParams(window.location.search);
      qp.set("role", role);
      history.replaceState(null, "", `?${qp.toString()}${location.hash || ""}`);
      // Показываем splash снова — на время загрузки
      const splashEl = document.createElement("div");
      splashEl.id = "splash";
      splashEl.className = "loader splash";
      splashEl.innerHTML = `<div class="loader-bar"></div><div class="loader-caption">Открываем кабинет</div>`;
      document.body.appendChild(splashEl);
      init();
    });
  });
}

/* ----------------- Staff (замерщик / сборщик) ----------------- */
async function renderStaff(me) {
  app.innerHTML = "";

  if (me.error === "no_staff_role") {
    app.appendChild(el(`
      <div class="staff-no-role">
        <div class="staff-no-role-ico">🔒</div>
        <h2 class="display-title">У вас нет<br><span class="accent">прав сотрудника</span></h2>
        <p class="lede">Чтобы получить роль замерщика или сборщика — отправьте куратору ваш Telegram ID.</p>
        <div class="block">
          <div class="kv"><span>Ваш ID</span>&nbsp;<strong><code>${me.user?.tg_id || "—"}</code></strong></div>
          <div class="kv"><span>Имя</span>&nbsp;<strong>${me.user?.full_name || "—"}</strong></div>
        </div>
        <p class="muted" style="text-align:center;margin-top:16px;">
          В боте отправьте <code>/whoami</code> и перешлите ответ
          <a href="https://t.me/wasrusgen" target="_blank">@wasrusgen</a>.
        </p>
      </div>
    `));
    return;
  }

  const caps = me.capabilities || {};
  const labels = [];
  if (caps.measurer) labels.push("замерщик");
  if (caps.assembler) labels.push("сборщик");
  const subtitle = labels.length ? labels.join(" · ") : "сотрудник";

  app.appendChild(el(`
    <div class="staff-head">
      <div class="staff-avatar">${me.user?.avatar_initial || "?"}</div>
      <div>
        <div class="kicker">${subtitle}</div>
        <h2 class="display-title">${me.user?.full_name || "Сотрудник"}</h2>
      </div>
    </div>
  `));

  // Реальный инбокс — загружаем из /api/measurement_inbox
  const inboxSection = el(`
    <section class="block">
      <div class="block-head">📥 Входящие заявки на замер</div>
      <div id="inboxList"><div class="loader-inline"><div class="spinner"></div></div></div>
    </section>
  `);
  app.appendChild(inboxSection);

  if (caps.measurer) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/measurement_inbox`, {
        method: "POST",
        body: JSON.stringify({ initData: tg?.initData || "" }),
      });
      const data = await res.json();
      const list = document.getElementById("inboxList");
      if (!list) return;
      if (data.error) {
        list.innerHTML = `<div class="error">Ошибка: ${data.error}</div>`;
      } else if (!data.measurements || !data.measurements.length) {
        list.innerHTML = `
          <div class="empty" style="padding:18px 12px;text-align:center;color:var(--muted);">
            Заявок пока нет. Когда менеджер назначит замер — увидите здесь.
          </div>
        `;
      } else {
        list.innerHTML = "";
        data.measurements.forEach(m => list.appendChild(renderInboxItem(m)));
      }
    } catch (e) {
      const list = document.getElementById("inboxList");
      if (list) list.innerHTML = `<div class="error">Сеть: ${e.message}</div>`;
    }
  } else {
    document.getElementById("inboxList").innerHTML = `
      <div class="empty" style="padding:18px 12px;text-align:center;color:var(--muted);">
        У вас только роль «сборщик» — инбокс заявок на сборку появится позже.
      </div>
    `;
  }

  // Quick action — заполнить замер без заявки (вне очереди)
  if (caps.measurer) {
    const quick = el(`
      <div class="podbor-cta-row" style="margin-top:16px;">
        <button class="btn-secondary" id="newMeasure">📐 Замер без заявки (вручную)</button>
      </div>
    `);
    quick.querySelector("#newMeasure").addEventListener("click", () => {
      haptic && haptic("impact");
      location.hash = "#/measure";
    });
    app.appendChild(quick);
  }
}

function renderInboxItem(m) {
  const statusLabel = ({
    requested:   "🟡 ждёт даты",
    scheduled:   "📅 назначен",
    in_progress: "🔵 в работе",
  })[m.status] || m.status;
  const sched = m.scheduled_at ? formatDateHuman(m.scheduled_at) : "дата не назначена";

  const item = el(`
    <button class="lead-item" style="text-align:left;">
      <div style="flex:1; min-width:0;">
        <div class="lead-date" style="font-weight:600; color:var(--ink);">${escHtml(m.client_name || "—")}</div>
        <div class="lead-id" style="font-size:12px; color:var(--muted); margin-top:2px;">
          ${escHtml(m.address || "адрес не указан")}
        </div>
        <div class="lead-id" style="font-size:11px; color:var(--muted); margin-top:2px;">
          ${escHtml(sched)} · ${statusLabel}
        </div>
      </div>
      <div class="lead-arrow">${ICONS.chevron || "›"}</div>
    </button>
  `);
  item.addEventListener("click", () => {
    haptic && haptic("impact");
    location.hash = `#/inbox/${m.id}`;
  });
  return item;
}

function formatDateHuman(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}.${yy} ${hh}:${mi}`;
  } catch (e) { return iso; }
}

function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ----------------- Карточка заявки для замерщика ----------------- */
async function renderInboxDetail(measurementId) {
  app.innerHTML = "";
  document.body.classList.remove("has-bottom-nav");
  const oldNav = document.getElementById("bottom-nav");
  if (oldNav) oldNav.remove();

  // header
  const header = el(`
    <header class="podbor-header">
      <button class="podbor-back" aria-label="Назад">${ICONS.arrow_left || "‹"}</button>
      <div class="podbor-title">Заявка на замер</div>
      <div style="width:28px"></div>
    </header>
  `);
  header.querySelector(".podbor-back").addEventListener("click", () => {
    location.hash = "";
    if (!location.hash) location.reload();
  });
  app.appendChild(header);

  const loading = el(`<div class="loader-inline"><div class="spinner"></div></div>`);
  app.appendChild(loading);

  let m;
  try {
    const res = await fetch(`${BACKEND_URL}/api/measurement_detail`, {
      method: "POST",
      body: JSON.stringify({ initData: tg?.initData || "", measurement_id: measurementId }),
    });
    m = await res.json();
  } catch (e) {
    loading.remove();
    app.appendChild(el(`<div class="error">Сеть: ${e.message}</div>`));
    return;
  }
  loading.remove();
  if (m.error) {
    app.appendChild(el(`<div class="error">${m.error}</div>`));
    return;
  }

  // Шапка
  app.appendChild(el(`
    <div class="measurement-detail-head">
      <div class="kicker">Заявка #${(m.id || "").slice(0, 8)}</div>
      <h2 class="display-title">${escHtml(m.client_name || "Без имени")}</h2>
      <div class="measurement-detail-meta">
        <span>📞 ${escHtml(m.client_phone || "—")}</span>
        <span>📍 ${escHtml(m.address || "адрес не указан")}</span>
      </div>
    </div>
  `));

  // Заметки от менеджера
  if (m.notes) {
    app.appendChild(el(`
      <section class="block">
        <div class="block-head">Заметки от менеджера</div>
        <div style="padding:12px 4px;color:var(--ink-2);font-size:14px;">${escHtml(m.notes).replace(/\n/g, "<br>")}</div>
      </section>
    `));
  }

  // Блок «назначить дату» (если ещё requested) или «изменить дату» (если scheduled)
  const isScheduled = m.status === "scheduled";
  const schedSection = el(`
    <section class="block">
      <div class="block-head">${isScheduled ? "Дата замера" : "Назначить дату"}</div>
      <div style="padding:6px 0 0;">
        <div class="form-row">
          <label class="field">
            <span class="field-label">Дата и время визита</span>
            <input type="datetime-local" id="schedInput" value="${m.scheduled_at ? toDatetimeLocalValue(m.scheduled_at) : ""}">
            <span class="field-hint" id="schedHint">${isScheduled ? "Согласовано — можно изменить" : "Согласуйте с клиентом, потом выберите тут"}</span>
            <span class="field-error" id="schedError"></span>
          </label>
        </div>
        <div class="podbor-cta-row">
          <button class="btn-primary" id="saveSched">${isScheduled ? "Изменить дату" : "Назначить"}</button>
        </div>
      </div>
    </section>
  `);
  app.appendChild(schedSection);

  schedSection.querySelector("#saveSched").addEventListener("click", async () => {
    const input = schedSection.querySelector("#schedInput");
    const errorEl = schedSection.querySelector("#schedError");
    errorEl.textContent = "";
    const val = input.value;
    if (!val) {
      errorEl.textContent = "Укажите дату и время";
      return;
    }
    const iso = new Date(val).toISOString();
    try {
      const res = await fetch(`${BACKEND_URL}/api/measurement_schedule`, {
        method: "POST",
        body: JSON.stringify({
          initData: tg?.initData || "",
          measurement_id: measurementId,
          scheduled_at: iso,
        }),
      });
      const data = await res.json();
      if (data.error) {
        errorEl.textContent = "Ошибка: " + data.error;
        return;
      }
      haptic && haptic("success");
      tg?.showAlert?.("Дата назначена — менеджер уведомлён.");
      renderInboxDetail(measurementId); // перерисовать
    } catch (e) {
      errorEl.textContent = "Сеть: " + e.message;
    }
  });

  // Кнопка «Сделать замер» (только если назначено или прямо сейчас)
  const measureBtn = el(`
    <div class="podbor-cta-row" style="margin-top:16px;">
      <button class="btn-primary" id="goMeasure">📐 Сделать замер сейчас</button>
    </div>
  `);
  measureBtn.querySelector("#goMeasure").addEventListener("click", () => {
    haptic && haptic("impact");
    // Передаём measurement_id чтобы wizard работал в update-mode
    location.hash = `#/measure?id=${measurementId}`;
  });
  app.appendChild(measureBtn);
}

function toDatetimeLocalValue(iso) {
  // ISO → YYYY-MM-DDTHH:MM для <input type="datetime-local">
  try {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch (e) { return ""; }
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
// Засекаем когда стартовали — чтобы splash висел минимум ~700мс
const _splashStart = Date.now();
function hideSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  const elapsed = Date.now() - _splashStart;
  const minShow = 1200; // минимум показа, мс — 1.2 сек хватает чтобы рассмотреть лого и не блокировать UI
  const wait = Math.max(0, minShow - elapsed);
  setTimeout(() => {
    splash.classList.add("hide");
    setTimeout(() => splash.remove(), 450);
  }, wait);
}

async function init() {
  setupTelegram();
  window.addEventListener("hashchange", routeByHash);

  const qp = new URLSearchParams(window.location.search);
  // Telegram ставит #tgWebAppData=... в hash при открытии — это НЕ наш роут.
  // Считаем «есть навигационный hash» только если он начинается с #/
  const hasAppRoute = location.hash.startsWith("#/");

  const goScreen = qp.get("go");
  if (goScreen && !hasAppRoute) {
    const map = {
      podbor:  "#/podbor",
      clients: "#/clients",
      measure: "#/measure",
      request: "#/request",
    };
    if (map[goScreen]) {
      history.replaceState(null, "", location.pathname + location.search + map[goScreen]);
    }
  }

  // Если нет ?role= в URL — показываем выбор роли (универсально для всех клиентов)
  const explicitRole = qp.get("role");
  if (!explicitRole && !hasAppRoute) {
    renderRoleChooser();
    hideSplash();
    return;
  }

  try {
    const me = await fetchMe();
    window.__zovMe = me; // кешируем профиль для подэкранов
    if (location.hash.startsWith("#/podbor")) {
      Podbor.mount(app);
      hideSplash();
      return;
    }
    if (location.hash.startsWith("#/clients")) {
      Clients.mount(app);
      hideSplash();
      return;
    }
    if (location.hash.startsWith("#/measure")) {
      Measurements.mount(app);
      hideSplash();
      return;
    }
    if (location.hash.startsWith("#/request")) {
      MeasurementRequest.mount(app);
      hideSplash();
      return;
    }
    if (location.hash.startsWith("#/inbox/")) {
      const id = location.hash.replace("#/inbox/", "");
      renderInboxDetail(id);
      hideSplash();
      return;
    }
    if (me.role === "staff") {
      renderStaff(me);
    } else if (me.role === "manager") {
      renderManager(me);
    } else {
      renderClient(me);
    }
    hideSplash();
  } catch (e) {
    console.error(e);
    renderError();
    hideSplash();
  }
}

function routeByHash() {
  if (location.hash.startsWith("#/podbor")) {
    Podbor.mount(app);
  } else if (location.hash.startsWith("#/clients")) {
    Clients.mount(app);
  } else if (location.hash.startsWith("#/measure")) {
    Measurements.mount(app);
  } else if (location.hash.startsWith("#/request")) {
    MeasurementRequest.mount(app);
  } else if (location.hash.startsWith("#/inbox/")) {
    renderInboxDetail(location.hash.replace("#/inbox/", ""));
  } else {
    // Главный экран по роли
    const me = window.__zovMe;
    if (!me) { init(); return; }
    if (me.role === "staff") renderStaff(me);
    else if (me.role === "manager") renderManager(me);
    else renderClient(me);
  }
}

init();
