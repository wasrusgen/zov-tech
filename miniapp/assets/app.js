// ЗОВ MiniApp — главный скрипт.
// На входе: подписанный initData от Telegram.
// Ходим на backend → получаем профиль (роль, статус) → рендерим меню.

const tg = window.Telegram?.WebApp;
// Cloudflare Quick Tunnel → VPS FastAPI backend (GigaChat).
// Временный URL — пока wasrusgen1.pro в verification-hold; затем переключим на https://api.wasrusgen1.pro
const BACKEND_URL = "https://api.wasrusgen1.pro";

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

async function renderManagerHome(me) {
  const firstName = (me.user?.full_name || "").split(/\s+/)[0] || "Менеджер";

  app.innerHTML = "";
  document.body.classList.add("has-bottom-nav");

  // Greeting + bell (placeholder)
  const greetingEl = el(`
    <header class="greeting">
      <div class="greeting-text">
        <div class="greeting-kicker">${timeOfDay()}</div>
        <div class="greeting-headline" id="greetingHeadline">${firstName},<br>
          <span class="accent">смотрим день…</span>
        </div>
      </div>
    </header>
  `);
  app.appendChild(greetingEl);

  // Контейнер для «Сегодня» — наполнится после загрузки
  const todayContainer = el(`<div id="todayContainer"></div>`);
  app.appendChild(todayContainer);

  // Quick actions
  const quickActions = [
    { icon: "user",    title: "Клиенты",        subtitle: "История + хронология", href: "#/clients" },
    { icon: "plus",    title: "Новый клиент",   subtitle: "Завести карточку",     href: "#/clients/new" },
    { icon: "package", title: "Подбор техники", subtitle: "Встройка + AI",        href: "#/podbor" },
    { icon: "ruler",   title: "Заказать замер", subtitle: "Назначить замерщика",  href: "#/request" },
    { icon: "wrench",  title: "Сборки",         subtitle: "Заявки на сборку",     href: "#/assembly" },
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

  // Активные проекты — будет наполняться позже из реальных данных
  const projectsContainer = el(`<div id="projectsContainer"></div>`);
  app.appendChild(projectsContainer);

  // Контейнер для отгрузок с завода (под активными проектами)
  const shipmentsContainer = el(`<div id="shipmentsContainer"></div>`);
  app.appendChild(shipmentsContainer);

  // Контейнер для поступлений на склад СПб
  const arrivalsContainer = el(`<div id="arrivalsContainer"></div>`);
  app.appendChild(arrivalsContainer);

  renderBottomNav("home", { unreadChats: 0 });

  // Контейнер для карточек «Замер готов — что делать с подбором?»
  const pendingContainer = el(`<div id="pendingContainer"></div>`);
  app.insertBefore(pendingContainer, todayContainer);

  // Параллельно грузим реальные данные (измерения + pending — критичные)
  // Складские данные грузим отдельно, чтобы ошибка Drive не ломала весь дашборд
  try {
    const authBody = { initData: tg?.initData || "", initDataUnsafe: tg?.initDataUnsafe || null };
    const [resM, resP] = await Promise.all([
      fetch(`${BACKEND_URL}/api/measurements`, { method: "POST", body: JSON.stringify(authBody) }),
      fetch(`${BACKEND_URL}/api/manager_pending`, { method: "POST", body: JSON.stringify(authBody) }),
    ]);
    const data        = await resM.json();
    const pendingData = await resP.json();

    renderManagerPending(pendingContainer, pendingData.pending || []);
    renderManagerToday(todayContainer, data.measurements || [], firstName, greetingEl);
    renderManagerProjects(projectsContainer, data.measurements || []);

    // Складские данные — не критичны; грузим после, ошибка не ломает дашборд
    const authBodyStr = JSON.stringify(authBody);
    Promise.all([
      fetch(`${BACKEND_URL}/api/shipments`, { method: "POST", body: authBodyStr }).then(r => r.json()).catch(() => ({})),
      fetch(`${BACKEND_URL}/api/arrivals`,  { method: "POST", body: authBodyStr }).then(r => r.json()).catch(() => ({})),
    ]).then(([shipmentsData, arrivalsData]) => {
      renderManagerShipments(shipmentsContainer, shipmentsData.shipments || [], "📦 Отгрузки с завода");
      renderManagerShipments(arrivalsContainer,  arrivalsData.shipments  || [], "📥 Поступление в СПб");
    }).catch(() => { /* тихо — дашборд уже отрисован */ });
  } catch (e) {
    todayContainer.innerHTML = `<div class="error">Не удалось загрузить данные: ${escHtml(e.message)}</div>`;
  }
}

/* ----------------- Менеджер: карточки «Замер готов — подбор?» ----------------- */
function renderManagerPending(container, pending) {
  container.innerHTML = "";
  if (!pending.length) return;

  container.appendChild(el(`
    <div class="section-head"><span class="label">✅ Замеры готовы · ${pending.length}</span></div>
  `));

  for (const p of pending) {
    const isLater = p.decision === "later";
    const card = el(`
      <section class="pending-card${isLater ? " later" : ""}">
        <div class="pending-head">
          <span class="pending-icon">✅</span>
          <div>
            <div class="pending-title">${escHtml(p.client_name || "Без имени")}</div>
            <div class="pending-sub">Замер выполнен · ${escHtml(p.address || "адрес не указан")}</div>
          </div>
        </div>
        <div class="pending-question">${isLater ? "Снова: " : ""}Клиенту потребуется помощь с подбором техники?</div>
        <div class="pending-actions">
          <button class="btn-primary" data-act="yes" type="button">Да, поможем</button>
          <button class="btn-secondary" data-act="no" type="button">Нет</button>
          <button class="btn-secondary" data-act="later" type="button">Позже</button>
        </div>
        <div class="pending-result" data-id="${p.id}"></div>
      </section>
    `);
    card.querySelectorAll("button[data-act]").forEach(btn => {
      btn.addEventListener("click", () => handlePodborDecision(p, btn.dataset.act, card));
    });
    container.appendChild(card);
  }
}

async function handlePodborDecision(item, act, card) {
  const decisionMap = { yes: "needed", no: "not_needed", later: "later" };
  const decision = decisionMap[act];
  if (!decision) return;
  const resultEl = card.querySelector(".pending-result");
  if (resultEl) resultEl.textContent = "Сохраняем...";
  card.querySelectorAll("button").forEach(b => b.disabled = true);
  try {
    const res = await fetch(`${BACKEND_URL}/api/measurement_decision`, {
      method: "POST",
      body: JSON.stringify({
        initData: tg?.initData || "",
        initDataUnsafe: tg?.initDataUnsafe || null,
        measurement_id: item.id,
        decision,
      }),
    });
    const data = await res.json();
    if (data.error) {
      if (resultEl) resultEl.innerHTML = `<span style="color:#C0392B;">Ошибка: ${escHtml(data.error)}</span>`;
      card.querySelectorAll("button").forEach(b => b.disabled = false);
      return;
    }
    haptic && haptic("success");
    if (decision === "needed") {
      // Переходим в подбор техники с pre-fill из клиента
      sessionStorage.setItem("prefillClient", JSON.stringify({
        name: item.client_name, phone: item.client_phone,
      }));
      location.hash = `#/podbor?client_name=${encodeURIComponent(item.client_name || "")}&client_phone=${encodeURIComponent(item.client_phone || "")}`;
    } else {
      // Анимируем удаление карточки
      card.style.transition = "opacity 0.25s, transform 0.25s";
      card.style.opacity = "0";
      card.style.transform = "translateX(20px)";
      setTimeout(() => card.remove(), 250);
    }
  } catch (e) {
    if (resultEl) resultEl.innerHTML = `<span style="color:#C0392B;">Сеть: ${escHtml(e.message)}</span>`;
    card.querySelectorAll("button").forEach(b => b.disabled = false);
  }
}

function renderManagerToday(container, measurements, firstName, greetingEl) {
  const today = _startOfDay(new Date());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  // Сегодня = scheduled_at сегодня и не completed
  const todayEvents = [];
  const overdueEvents = [];
  const noDateEvents = [];

  for (const m of measurements) {
    if (m.status === "completed") continue;
    if (m.scheduled_at) {
      const d = new Date(m.scheduled_at);
      if (_startOfDay(d).getTime() === today.getTime()) {
        todayEvents.push(m);
      } else if (d < new Date()) {
        overdueEvents.push(m);
      }
    } else if (m.status === "requested") {
      // Заявка без даты — нужно подсказать замерщику
      noDateEvents.push(m);
    }
  }
  todayEvents.sort((a, b) => (a.scheduled_at || "").localeCompare(b.scheduled_at || ""));

  // Обновляем приветствие
  const cnt = todayEvents.length;
  let tail;
  if (cnt === 0) {
    tail = overdueEvents.length
      ? `${overdueEvents.length} ${pluralRu(overdueEvents.length, ["просрочка", "просрочки", "просрочек"])}`
      : "ничего на сегодня";
  } else {
    const word = pluralRu(cnt, ["замер", "замера", "замеров"]);
    tail = `${cnt === 1 ? "один" : cnt} ${word} сегодня`;
  }
  const headline = greetingEl.querySelector("#greetingHeadline");
  if (headline) headline.innerHTML = `${escHtml(firstName)},<br><span class="accent">${escHtml(tail)}</span>`;

  container.innerHTML = "";

  // HERO — первое событие сегодня
  if (todayEvents.length > 0) {
    const m = todayEvents[0];
    const d = new Date(m.scheduled_at);
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const phoneClean = (m.client_phone || "").replace(/[^\d+]/g, "");
    const hero = el(`
      <section class="hero">
        <div class="hero-meta">
          <span class="left"><span>На сегодня</span><span class="sep">—</span><span>${hh}:${mi}</span></span>
          <span class="hero-tag">ЗАМЕР</span>
        </div>
        <div class="hero-client">${escHtml(m.client_name || "Без имени")}</div>
        <div class="hero-address">${escHtml(m.address || "адрес не указан")}</div>
        <div class="hero-actions">
          <button class="btn-gold" id="heroOpen">${ICONS.ruler || "📐"}<span>Открыть заявку</span></button>
          ${phoneClean ? `<a class="btn-icon-dark" href="tel:${phoneClean}" aria-label="Позвонить">${ICONS.phone || "📞"}</a>` : ""}
        </div>
      </section>
    `);
    hero.querySelector("#heroOpen").addEventListener("click", () => {
      haptic("impact");
      location.hash = `#/clients/measurement/${m.id}`;
    });
    container.appendChild(hero);
  }

  // Срочно: просрочки
  if (overdueEvents.length > 0) {
    container.appendChild(el(`<div class="section-head"><span class="label" style="color:#C0392B;">⚠️ Срочно · ${overdueEvents.length}</span></div>`));
    const list = el(`<div class="today-list"></div>`);
    overdueEvents.slice(0, 5).forEach(m => list.appendChild(renderTodayItem(m, "overdue")));
    container.appendChild(list);
  }

  // Остальные на сегодня (кроме первого, который в hero)
  if (todayEvents.length > 1) {
    container.appendChild(el(`<div class="section-head" style="margin-top:18px;"><span class="label">📅 Ещё сегодня · ${todayEvents.length - 1}</span></div>`));
    const list = el(`<div class="today-list"></div>`);
    todayEvents.slice(1).forEach(m => list.appendChild(renderTodayItem(m, "today")));
    container.appendChild(list);
  }

  // Заявки без даты — напомнить созвониться с замерщиком
  if (noDateEvents.length > 0) {
    container.appendChild(el(`<div class="section-head" style="margin-top:18px;"><span class="label">📞 Без даты · ${noDateEvents.length}</span></div>`));
    const list = el(`<div class="today-list"></div>`);
    noDateEvents.slice(0, 5).forEach(m => list.appendChild(renderTodayItem(m, "no_date")));
    container.appendChild(list);
  }

  if (todayEvents.length === 0 && overdueEvents.length === 0 && noDateEvents.length === 0) {
    container.appendChild(el(`
      <section class="hero" style="background:var(--card,#fff);border:1px dashed rgba(107,74,43,0.25);">
        <div class="hero-meta"><span class="left">Свободный день</span></div>
        <div class="hero-address" style="margin-top:8px;">Замеров на сегодня нет.<br>Можно поработать с клиентами или заказать новые замеры.</div>
      </section>
    `));
  }
}

function renderTodayItem(m, kind) {
  const phoneClean = (m.client_phone || "").replace(/[^\d+]/g, "");
  const callHref = phoneClean ? `tel:${phoneClean}` : "";
  let timeText = "—";
  if (m.scheduled_at) {
    const d = new Date(m.scheduled_at);
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    if (kind === "overdue") {
      timeText = `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")} ${hh}:${mi}`;
    } else {
      timeText = `${hh}:${mi}`;
    }
  } else if (kind === "no_date") {
    timeText = "?";
  }
  const row = el(`
    <div class="inbox-row ${kind === "overdue" ? "overdue" : ""}">
      <button class="inbox-row-main" type="button">
        <div class="inbox-time">${escHtml(timeText)}</div>
        <div class="inbox-row-body">
          <div class="inbox-client">${escHtml(m.client_name || "—")}</div>
          <div class="inbox-addr">${escHtml(m.address || "адрес не указан")}</div>
        </div>
        <div class="inbox-arrow">${ICONS.chevron || "›"}</div>
      </button>
      ${callHref ? `<a class="inbox-call" href="${callHref}" aria-label="Позвонить">📞</a>` : ""}
    </div>
  `);
  row.querySelector(".inbox-row-main").addEventListener("click", () => {
    haptic && haptic("impact");
    location.hash = `#/clients/measurement/${m.id}`;
  });
  return row;
}

function renderManagerProjects(container, measurements) {
  // Активные проекты = все замеры менеджера с любым статусом кроме completed/archived в обозримой перспективе.
  // Берём последние 5 по дате создания.
  const active = (measurements || [])
    .filter(m => m.status !== "archived")
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 5);

  container.innerHTML = "";
  if (!active.length) return;

  container.appendChild(el(`
    <div class="section-head" style="margin-top:24px;">
      <span class="label">Активные проекты <span class="count">· ${active.length}</span></span>
    </div>
  `));
  const list = el(`<div class="project-list"></div>`);
  for (const m of active) {
    const stage = ({
      requested: "Заявка на замер",
      scheduled: "Замер назначен",
      in_progress: "Замер в работе",
      completed: "Замер выполнен",
    })[m.status] || m.status;
    const statusKind = m.status === "completed" ? "active"
      : m.status === "requested" ? "waiting"
      : m.status === "scheduled" ? "active"
      : "waiting";
    const dateLabel = m.scheduled_at
      ? new Date(m.scheduled_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
      : (m.created_at ? formatDateHuman(m.created_at).slice(0, 10) : "—");
    const progress = ({
      requested: 0.15,
      scheduled: 0.35,
      in_progress: 0.55,
      completed: 0.75,
    })[m.status] || 0.10;
    const card = el(`
      <article class="project-card">
        <div class="project-head">
          <div class="project-title">${escHtml(m.client_name || "Без имени")}</div>
          <span class="project-pill ${statusKind}">${statusKind === "waiting" ? "Ожидает" : "В работе"}</span>
        </div>
        <div class="project-address">${escHtml(m.address || "адрес не указан")}</div>
        <div class="project-progress"><div class="bar" style="width:${Math.round(progress * 100)}%"></div></div>
        <div class="project-foot">
          <span class="stage">${stage}</span>
          <span>${dateLabel}</span>
        </div>
      </article>
    `);
    card.addEventListener("click", () => {
      haptic("impact");
      location.hash = `#/clients/measurement/${m.id}`;
    });
    list.appendChild(card);
  }
  container.appendChild(list);
}

/* ----------------- Менеджер: секция отгрузок / поступлений на склад ----------------- */
function renderManagerShipments(container, groups, label = "📦 Отгрузки") {
  container.innerHTML = "";
  if (!groups || !groups.length) return;

  // Показываем последние 3 партии (ближайшие по дате отгрузки с завода)
  const visible = groups.slice(-3);

  const totalItems = visible.reduce((s, g) => s + g.count, 0);
  container.appendChild(el(`
    <div class="section-head" style="margin-top:24px;">
      <span class="label">${escHtml(label)} <span class="count">· ${totalItems} поз.</span></span>
    </div>
  `));

  for (const group of visible) {
    const zakazBadge = group.count_zakazov
      ? `<span class="ship-badge order">Заказов&nbsp;${group.count_zakazov}</span>` : "";
    const dozBadge = group.count_dozakazov
      ? `<span class="ship-badge resupply">Дозаказов&nbsp;${group.count_dozakazov}</span>` : "";

    const groupEl = el(`
      <section class="ship-group">
        <div class="ship-group-head">
          <span class="ship-factory-date">${escHtml(group.factory_date)}</span>
          <span class="ship-badges">${zakazBadge}${dozBadge}</span>
        </div>
        <div class="ship-rows"></div>
      </section>
    `);

    const rowsEl = groupEl.querySelector(".ship-rows");
    for (const item of group.items) {
      const typeClass = item.tovar.startsWith("Доз") ? "dozakaz" : "zakaz";
      const typeMark  = item.tovar.startsWith("Доз") ? "Дозаказ" : "Заказ";

      const delivStr  = item.delivery_date ? `📬&nbsp;${escHtml(item.delivery_date)}` : "";
      const assembler = item.assembler      ? `🔧&nbsp;${escHtml(item.assembler)}`      : "";
      const places    = item.places         ? `📦&nbsp;${escHtml(item.places)} м.`       : "";
      const meta = [delivStr, assembler, places].filter(Boolean).join("&ensp;·&ensp;");

      const furn = item.furn_spb    ? `<span class="ship-check ${item.furn_spb  === "+" ? "yes" : "no"}">Фурн: ${escHtml(item.furn_spb)}</span>`   : "";
      const pan  = item.panels_spb  ? `<span class="ship-check ${item.panels_spb === "+" ? "yes" : "no"}">Пан: ${escHtml(item.panels_spb)}</span>`   : "";

      const numStr      = item.num      ? `#${escHtml(item.num)}&ensp;` : "";
      const contractStr = item.contract ? `Дог&nbsp;${escHtml(item.contract)}` : "";
      const noteStr     = item.note     ? `<div class="ship-note">${escHtml(item.note)}</div>` : "";

      rowsEl.appendChild(el(`
        <div class="ship-row">
          <div class="ship-row-top">
            <span class="ship-type ${typeClass}">${typeMark}</span>
            <span class="ship-id">${numStr}${contractStr}</span>
          </div>
          ${meta ? `<div class="ship-meta">${meta}</div>` : ""}
          ${furn || pan ? `<div class="ship-supply">${furn}${pan}</div>` : ""}
          ${noteStr}
        </div>
      `));
    }

    container.appendChild(groupEl);
  }
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
          <div class="meta">${me.manager ? "Менеджер: " + me.manager.full_name + (me.manager.salon ? ", " + me.manager.salon : "") : "@wasrusgen1 · CRM"}</div>
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
        { icon: "wrench",    color: "green", label: "Подобрать технику",   href: "#/c/proposal" },
        { icon: "wallet",    color: "gold",  label: "Проверить договор",   href: "#/c/contract" },
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
      <div class="signature">@wasrusgen1 · CRM</div>
      <div class="meta">
        Кабинет от Руслана Васильева ·
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
        <h1 class="display-title">Кто <span class="accent">вы?</span></h1>
        <p class="lede">Выберите роль — кабинет откроется одним тапом.</p>
      </div>
      <div class="role-cards">
        <button class="role-card" data-role="manager">
          <div class="role-icon">
            <svg viewBox="0 0 44 44" width="40" height="40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs><filter id="sk-m" x="-6%" y="-6%" width="112%" height="112%">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="7" result="n"/>
                <feDisplacementMap in="SourceGraphic" in2="n" scale="1.4" xChannelSelector="R" yChannelSelector="G"/>
              </filter></defs>
              <g filter="url(#sk-m)" stroke="#6B4A2B" stroke-linecap="round" stroke-linejoin="round">
                <!-- голова — вытянутый овал -->
                <path d="M15 14 Q15 7 22 7 Q29 7 29 14 Q29 20 22 20.5 Q15 20 15 14Z" fill="#FBF7F0" stroke-width="1.5"/>
                <!-- волосы -->
                <path d="M15 12 Q16 8 19.5 7.2 Q22 6.5 24.5 7.2 Q28 8 29 12" fill="#5A3D24" stroke="none"/>
                <!-- ухо -->
                <path d="M29 14 Q31 13 31 15 Q31 17 29 16.5" fill="none" stroke-width="1.1"/>
                <!-- глаза + блики -->
                <ellipse cx="19.5" cy="14" rx="1.4" ry="1.1" fill="#6B4A2B" stroke="none"/>
                <ellipse cx="24.5" cy="14" rx="1.4" ry="1.1" fill="#6B4A2B" stroke="none"/>
                <circle cx="20" cy="13.5" r="0.45" fill="#FBF7F0" stroke="none"/>
                <circle cx="25" cy="13.5" r="0.45" fill="#FBF7F0" stroke="none"/>
                <!-- нос -->
                <path d="M22 15 Q21.2 17.2 21.5 17.8 Q22 18.3 22.5 17.8" fill="none" stroke-width="1"/>
                <!-- рот — лёгкая улыбка -->
                <path d="M19.8 19 Q22 20.5 24.2 19" fill="none" stroke-width="1.2"/>
                <!-- шея -->
                <path d="M20 20.5 L20 23 M24 20.5 L24 23" stroke-width="1.3"/>
                <!-- штриховка под подбородком -->
                <path d="M17.5 20 L20 18.5" stroke-width="0.8" opacity="0.45"/>
                <path d="M18 21.5 L21 19.5" stroke-width="0.8" opacity="0.45"/>
                <!-- тело пиджака -->
                <path d="M10 44 Q10 34 14 28 L20.5 23 L22 24 L23.5 23 L30 28 Q34 34 34 44" fill="#FBF7F0" stroke-width="1.7"/>
                <!-- воротник рубашки -->
                <path d="M20.5 23 L18 26.5 L22 25.5" fill="none" stroke-width="1.2"/>
                <path d="M23.5 23 L26 26.5 L22 25.5" fill="none" stroke-width="1.2"/>
                <!-- галстук: узел + полотно -->
                <path d="M21 26 L22 24.8 L23 26 L22 27.5Z" fill="#6B4A2B"/>
                <path d="M21.4 27.5 L20.5 33.5 L22 41 L23.5 33.5 L22.6 27.5Z" fill="#6B4A2B" opacity="0.88"/>
                <!-- лацканы -->
                <path d="M20.5 23 L16 28.5" stroke-width="1.3"/>
                <path d="M23.5 23 L28 28.5" stroke-width="1.3"/>
                <!-- борт пиджака -->
                <path d="M19 29 L19 42" stroke-width="1"/>
                <path d="M25 29 L25 42" stroke-width="1"/>
                <!-- пуговица -->
                <circle cx="22" cy="33" r="0.9" fill="none" stroke-width="0.9"/>
                <!-- нагрудный карман + платочек -->
                <path d="M13 30.5 L16 30.5 L16.5 34.5 L12.5 34.5Z" fill="none" stroke-width="0.9"/>
                <path d="M13.5 30.5 L14.2 28.8 L15 30.5" stroke-width="0.85"/>
                <!-- штриховка тень правый бок -->
                <path d="M29 30 L31.5 27.5" stroke-width="0.75" opacity="0.35"/>
                <path d="M29.5 33.5 L32 31" stroke-width="0.75" opacity="0.35"/>
                <path d="M30 37 L32.5 34.5" stroke-width="0.75" opacity="0.35"/>
              </g>
            </svg>
          </div>
          <div class="role-text">
            <div class="role-title">Я менеджер</div>
            <div class="role-sub">Веду клиентов и заказы</div>
          </div>
          <div class="role-arrow">${ICONS.chevron || "›"}</div>
        </button>
        <button class="role-card" data-role="client">
          <div class="role-icon">
            <svg viewBox="0 0 44 44" width="40" height="40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs><filter id="sk-c" x="-6%" y="-6%" width="112%" height="112%">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="13" result="n"/>
                <feDisplacementMap in="SourceGraphic" in2="n" scale="1.4" xChannelSelector="R" yChannelSelector="G"/>
              </filter></defs>
              <g filter="url(#sk-c)" stroke="#6B4A2B" stroke-linecap="round" stroke-linejoin="round">
                <!-- стены дома -->
                <rect x="5.5" y="22" width="33" height="19.5" fill="#FBF7F0" stroke-width="1.7"/>
                <!-- крыша -->
                <path d="M2.5 23 L22 4.5 L41.5 23" fill="#FBF7F0" stroke-width="2" stroke-linejoin="round"/>
                <!-- карниз крыши -->
                <path d="M4 23.8 L22 7.5 L40 23.8" fill="none" stroke-width="0.85" opacity="0.4"/>
                <!-- труба -->
                <rect x="27" y="10" width="4.5" height="7.5" fill="#FBF7F0" stroke-width="1.4"/>
                <!-- дымок из трубы -->
                <path d="M29 10 Q30 8 29 6.5 Q28 5 29.5 3.5" fill="none" stroke-width="1" opacity="0.55"/>
                <!-- штриховка правый скат крыши (тень) -->
                <path d="M24 10 L26 8" stroke-width="0.8" opacity="0.4"/>
                <path d="M27 13 L29.5 11" stroke-width="0.8" opacity="0.4"/>
                <path d="M30 16.5 L32.5 14.5" stroke-width="0.8" opacity="0.4"/>
                <path d="M33 20 L35.5 18" stroke-width="0.8" opacity="0.4"/>
                <!-- сайдинг — намёк -->
                <path d="M5.5 28 L38.5 28" stroke-width="0.65" opacity="0.3"/>
                <path d="M5.5 33.5 L38.5 33.5" stroke-width="0.65" opacity="0.3"/>
                <!-- окно левое: рама + переплёт + подоконник -->
                <rect x="7" y="24.5" width="7.5" height="7" rx="0.5" fill="#D6EFF5" stroke-width="1.4"/>
                <line x1="10.75" y1="24.5" x2="10.75" y2="31.5" stroke-width="0.9"/>
                <line x1="7" y1="28" x2="14.5" y2="28" stroke-width="0.9"/>
                <line x1="5.5" y1="31.7" x2="16" y2="31.7" stroke-width="1.3"/>
                <!-- окно правое: рама + переплёт + подоконник -->
                <rect x="29.5" y="24.5" width="7.5" height="7" rx="0.5" fill="#D6EFF5" stroke-width="1.4"/>
                <line x1="33.25" y1="24.5" x2="33.25" y2="31.5" stroke-width="0.9"/>
                <line x1="29.5" y1="28" x2="37" y2="28" stroke-width="0.9"/>
                <line x1="28" y1="31.7" x2="38.5" y2="31.7" stroke-width="1.3"/>
                <!-- дверь: полотно + горизонтальная и вертикальная планки -->
                <path d="M17 41.5 L17 30 Q17 27.5 22 27.5 Q27 27.5 27 30 L27 41.5" fill="#EDE0C8" stroke-width="1.5"/>
                <line x1="17" y1="34" x2="27" y2="34" stroke-width="1"/>
                <line x1="22" y1="28" x2="22" y2="34" stroke-width="0.9"/>
                <!-- ручка двери -->
                <circle cx="25.5" cy="35.8" r="1.2" fill="#6B4A2B" stroke="none"/>
                <!-- ступенька -->
                <path d="M14.5 41.5 L14.5 43 L29.5 43 L29.5 41.5" fill="none" stroke-width="1.3"/>
                <!-- куст слева у входа -->
                <path d="M4 41 Q5 39 6 40.5 Q7 39 8 40.5 Q9 39 10 41" fill="none" stroke-width="1.1"/>
              </g>
            </svg>
          </div>
          <div class="role-text">
            <div class="role-title">Я клиент</div>
            <div class="role-sub">Заказал кухню ЗОВ</div>
          </div>
          <div class="role-arrow">${ICONS.chevron || "›"}</div>
        </button>
        <button class="role-card" data-role="staff">
          <div class="role-icon">
            <svg viewBox="0 0 44 44" width="40" height="40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs><filter id="sk-s" x="-6%" y="-6%" width="112%" height="112%">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="5" result="n"/>
                <feDisplacementMap in="SourceGraphic" in2="n" scale="1.4" xChannelSelector="R" yChannelSelector="G"/>
              </filter></defs>
              <g filter="url(#sk-s)" stroke="#6B4A2B" stroke-linecap="round" stroke-linejoin="round">
                <!-- каска — купол (тёмный) -->
                <path d="M10.5 19 Q11 8.5 22 8.5 Q33 8.5 33.5 19" fill="#6B4A2B" stroke-width="1.5"/>
                <!-- рёбра жёсткости каски -->
                <path d="M13 16 Q22 13.5 31 16" fill="none" stroke="#FBF7F0" stroke-width="0.9" opacity="0.6"/>
                <path d="M14 18.5 Q22 16.5 30 18.5" fill="none" stroke="#FBF7F0" stroke-width="0.7" opacity="0.45"/>
                <!-- козырёк каски -->
                <path d="M8 20.5 Q8 22.5 10.5 22.5 L33.5 22.5 Q36 22.5 36 20.5 Q36 19 33.5 19.5 L10.5 19.5 Q8 19 8 20.5Z" fill="#5A3D24" stroke-width="1.5"/>
                <!-- бирка на каске -->
                <rect x="18.5" y="11.5" width="7" height="4.5" rx="1" fill="none" stroke="#FBF7F0" stroke-width="0.85"/>
                <!-- штриховка тень купол каски -->
                <path d="M26 12 L28.5 10" stroke-width="0.75" opacity="0.4"/>
                <path d="M28.5 15.5 L31 13.5" stroke-width="0.75" opacity="0.4"/>
                <path d="M31 19 L33 17.5" stroke-width="0.75" opacity="0.4"/>
                <!-- голова / лицо -->
                <path d="M15.5 28.5 Q15 22.5 22 22.5 Q29 22.5 28.5 28.5 Q28.5 35 22 35 Q15.5 35 15.5 28.5Z" fill="#FBF7F0" stroke-width="1.5"/>
                <!-- ухо -->
                <path d="M15.5 26.5 Q13.5 26 13.5 28 Q13.5 30 15.5 29.5" fill="none" stroke-width="1.1"/>
                <!-- брови (нахмурены) -->
                <path d="M18.5 26 Q20 25 21.2 25.7" stroke-width="1.2"/>
                <path d="M22.8 25.7 Q24 25 25.5 26" stroke-width="1.2"/>
                <!-- глаза -->
                <ellipse cx="19.5" cy="27.5" rx="1.4" ry="1.1" fill="#6B4A2B" stroke="none"/>
                <ellipse cx="24.5" cy="27.5" rx="1.4" ry="1.1" fill="#6B4A2B" stroke="none"/>
                <!-- нос -->
                <path d="M21.5 28.5 Q21 30 21.5 30.5 Q22 31 22.5 30.5" fill="none" stroke-width="1"/>
                <!-- щетина — намёк -->
                <path d="M19 32.5 L19.3 33 M21.3 32.8 L21.5 33.5 M23.5 32.8 L23.2 33.5" stroke-width="0.7" opacity="0.55"/>
                <!-- рот -->
                <path d="M19.5 32.5 Q22 34 24.5 32.5" fill="none" stroke-width="1.1"/>
                <!-- штриховка тень правая щека -->
                <path d="M26 26 L28 24.5" stroke-width="0.75" opacity="0.35"/>
                <path d="M26.5 28.5 L28.5 27" stroke-width="0.75" opacity="0.35"/>
                <!-- шея -->
                <line x1="20.5" y1="35" x2="20" y2="37.5" stroke-width="1.3"/>
                <line x1="23.5" y1="35" x2="24" y2="37.5" stroke-width="1.3"/>
                <!-- спецовка -->
                <path d="M8 44 Q8 36 12 30 L19.5 37.5 L22 36.5 L24.5 37.5 L32 30 Q36 36 36 44" fill="#FBF7F0" stroke-width="1.7"/>
                <!-- воротник спецовки -->
                <path d="M19.5 37.5 L17.5 40" stroke-width="1.2"/>
                <path d="M24.5 37.5 L26.5 40" stroke-width="1.2"/>
                <!-- нагрудный карман -->
                <rect x="23" y="40.5" width="5.5" height="3.5" rx="0.5" fill="none" stroke-width="1"/>
                <!-- пуговицы / молния -->
                <circle cx="22" cy="39" r="0.8" fill="#6B4A2B" stroke="none"/>
                <circle cx="22" cy="42" r="0.8" fill="#6B4A2B" stroke="none"/>
                <!-- правая рука — тянется к инструменту -->
                <path d="M32 30 Q36 32.5 37.5 36.5" fill="none" stroke-width="1.5"/>
                <!-- гаечный ключ: рукоятка -->
                <line x1="36" y1="35" x2="41.5" y2="41" stroke-width="2.3" stroke-linecap="round"/>
                <!-- гаечный ключ: головка -->
                <circle cx="36" cy="35" r="3" fill="#FBF7F0" stroke-width="1.4"/>
                <circle cx="36" cy="35" r="1.2" fill="#6B4A2B" stroke="none"/>
              </g>
            </svg>
          </div>
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

  // Загружаем заявки и рендерим: week strip + сгруппированный инбокс
  const stripPlaceholder = el(`<div id="weekStrip"></div>`);
  const inboxSection = el(`
    <section class="block">
      <div class="block-head">📥 Заявки</div>
      <div id="inboxList"><div class="loader-inline"><div class="spinner"></div></div></div>
    </section>
  `);
  app.appendChild(stripPlaceholder);
  app.appendChild(inboxSection);

  if (caps.measurer) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/measurement_inbox`, {
        method: "POST",
        body: JSON.stringify({
          initData: tg?.initData || "",
          initDataUnsafe: tg?.initDataUnsafe || null,
        }),
      });
      const data = await res.json();
      const list = document.getElementById("inboxList");
      if (!list) return;
      if (data.error) {
        list.innerHTML = `<div class="error">Ошибка: ${data.error}</div>`;
      } else {
        const measurements = data.measurements || [];
        // Week strip — заменяет placeholder
        document.getElementById("weekStrip").replaceWith(renderWeekStrip(measurements));
        // Группированный инбокс
        renderGroupedInbox(list, measurements);
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

  // Сборки — отдельный блок, доступен мастеру (measurer ∨ assembler)
  if (caps.measurer || caps.assembler) {
    const assemblySection = el(`
      <section class="block" style="margin-top:18px;">
        <div class="block-head">🔨 Сборки</div>
        <div id="assemblyList"><div class="loader-inline"><div class="spinner"></div></div></div>
      </section>
    `);
    app.appendChild(assemblySection);
    renderStaffAssemblies(assemblySection.querySelector("#assemblyList"));
  }
}

async function renderStaffAssemblies(container) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/assembly_list`, {
      method: "POST",
      body: JSON.stringify({
        initData: tg?.initData || "",
        initDataUnsafe: tg?.initDataUnsafe || null,
      }),
    });
    const data = await res.json();
    if (data.error) {
      container.innerHTML = `<div class="error">Ошибка: ${escHtml(data.error)}</div>`;
      return;
    }
    const items = (data.assemblies || []).filter(a => a.status !== "completed" && a.status !== "cancelled");
    if (!items.length) {
      container.innerHTML = `<div class="empty" style="padding:12px;text-align:center;color:var(--muted);font-size:13px;">Сборок нет</div>`;
      return;
    }
    container.innerHTML = "";
    for (const a of items) {
      const dateStr = a.scheduled_at ? formatDateHuman(a.scheduled_at) : "— дата не назначена";
      const statusLabel = {
        created: "📝 создана",
        scheduled: "📅 назначена",
        in_progress: "🔧 в работе",
      }[a.status] || a.status;
      const card = el(`
        <article class="assembly-card" data-id="${a.id}">
          <div class="assembly-card-head">
            <span class="assembly-card-status">${statusLabel}</span>
            <span class="assembly-card-date">${escHtml(dateStr)}</span>
          </div>
          <div class="assembly-card-name">${escHtml(a.client_name || "Без имени")}</div>
          <div class="assembly-card-address">${escHtml(a.address || "адрес не указан")}</div>
          ${a.scope_of_work ? `<div class="assembly-card-scope">${escHtml(a.scope_of_work.slice(0, 100))}${a.scope_of_work.length > 100 ? "…" : ""}</div>` : ""}
        </article>
      `);
      card.addEventListener("click", () => {
        haptic && haptic("impact");
        location.hash = `#/assembly/${a.id}`;
      });
      container.appendChild(card);
    }
  } catch (e) {
    container.innerHTML = `<div class="error">Сеть: ${escHtml(e.message)}</div>`;
  }
}

/* ----------------- Группировка инбокса замерщика по дням ----------------- */

function _startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function _daysBetween(a, b) {
  return Math.round((_startOfDay(b) - _startOfDay(a)) / 86400000);
}

function _groupForMeasurement(m, today, weekEnd) {
  if (!m.scheduled_at) {
    // Без даты — отделяем requested от scheduled (по идее scheduled без даты быть не должно)
    return { key: "no_date", title: "📞 Без даты — нужно согласовать", order: 5 };
  }
  const d = new Date(m.scheduled_at);
  const diff = _daysBetween(today, d);
  if (diff < 0) return { key: "overdue", title: "⚠️ Просрочено", order: 0 };
  if (diff === 0) return { key: "today", title: "🔥 Сегодня", order: 1 };
  if (diff === 1) return { key: "tomorrow", title: "📅 Завтра", order: 2 };
  if (d <= weekEnd) return { key: "this_week", title: "🗓️ На неделе", order: 3 };
  return { key: "later", title: "📆 Позже", order: 4 };
}

function renderGroupedInbox(container, measurements) {
  container.innerHTML = "";
  if (!measurements.length) {
    container.innerHTML = `
      <div class="empty" style="padding:18px 12px;text-align:center;color:var(--muted);">
        Заявок пока нет. Когда менеджер назначит замер — увидите здесь.
      </div>
    `;
    return;
  }

  const today = _startOfDay(new Date());
  // Конец этой недели: воскресенье вечером
  const weekEnd = new Date(today);
  const dayIdx = (today.getDay() + 6) % 7; // 0 = Пн, 6 = Вс
  weekEnd.setDate(today.getDate() + (6 - dayIdx));
  weekEnd.setHours(23, 59, 59, 999);

  // Группируем
  const groups = new Map();
  for (const m of measurements) {
    const g = _groupForMeasurement(m, today, weekEnd);
    if (!groups.has(g.key)) groups.set(g.key, { ...g, items: [] });
    groups.get(g.key).items.push(m);
  }
  // Сортируем группы и внутри — по дате
  const sortedGroups = [...groups.values()].sort((a, b) => a.order - b.order);
  for (const g of sortedGroups) {
    g.items.sort((a, b) => (a.scheduled_at || "").localeCompare(b.scheduled_at || ""));
    const groupEl = el(`
      <div class="inbox-group">
        <div class="inbox-group-head">${g.title}<span class="count">${g.items.length}</span></div>
        <div class="inbox-group-list"></div>
      </div>
    `);
    const list = groupEl.querySelector(".inbox-group-list");
    g.items.forEach(m => list.appendChild(renderInboxItem(m, g.key)));
    container.appendChild(groupEl);
  }
}

/* ----------------- Week strip — загрузка по дням ----------------- */

function renderWeekStrip(measurements) {
  const today = _startOfDay(new Date());
  const dayIdx = (today.getDay() + 6) % 7; // Пн = 0
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayIdx);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  // Считаем сколько замеров на каждый день
  const countByDay = days.map(d => {
    const start = _startOfDay(d).getTime();
    const end = start + 86400000;
    return measurements.filter(m => {
      if (!m.scheduled_at) return false;
      const t = new Date(m.scheduled_at).getTime();
      return t >= start && t < end;
    }).length;
  });
  const maxCount = Math.max(1, ...countByDay);

  const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const section = el(`
    <section class="cal-strip-block">
      <div class="cal-strip-head">
        ${monday.getDate()}–${days[6].getDate()} ${monday.toLocaleString("ru-RU", { month: "long" })}
      </div>
      <div class="cal-strip">
        ${days.map((d, i) => {
          const cnt = countByDay[i];
          const heightPct = cnt ? Math.round((cnt / maxCount) * 100) : 0;
          const isToday = _startOfDay(d).getTime() === today.getTime();
          const isPast = _startOfDay(d).getTime() < today.getTime();
          const loadClass = cnt >= 5 ? "load-hot" : cnt >= 3 ? "load-mid" : cnt > 0 ? "load-low" : "load-zero";
          return `
            <div class="cal-day ${isToday ? "today" : ""} ${isPast ? "past" : ""}">
              <div class="cal-day-name">${dayNames[i]}</div>
              <div class="cal-day-num">${d.getDate()}</div>
              <div class="cal-day-bar"><div class="bar ${loadClass}" style="height:${heightPct}%"></div></div>
              <div class="cal-day-count">${cnt || "—"}</div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `);
  return section;
}

/* ----------------- Карточка заявки в инбоксе ----------------- */

function renderInboxItem(m, groupKey) {
  // Когда: точное время если назначено + день недели для не-today
  let timeLine;
  if (m.scheduled_at) {
    const d = new Date(m.scheduled_at);
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    if (groupKey === "today" || groupKey === "tomorrow") {
      timeLine = `${hh}:${mi}`;
    } else if (groupKey === "overdue") {
      timeLine = `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")} ${hh}:${mi}`;
    } else {
      const dayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
      timeLine = `${dayNames[d.getDay()]} ${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")} ${hh}:${mi}`;
    }
  } else {
    timeLine = formatPreferredHuman(m);
  }

  const phoneClean = (m.client_phone || "").replace(/[^\d+]/g, "");
  const callHref = phoneClean ? `tel:${phoneClean}` : "";

  const item = el(`
    <div class="inbox-row">
      <button class="inbox-row-main" type="button">
        <div class="inbox-time">${escHtml(timeLine)}</div>
        <div class="inbox-row-body">
          <div class="inbox-client">${escHtml(m.client_name || "—")}</div>
          <div class="inbox-addr">${escHtml(m.address || "адрес не указан")}</div>
        </div>
        <div class="inbox-arrow">${ICONS.chevron || "›"}</div>
      </button>
      ${callHref
        ? `<a class="inbox-call" href="${callHref}" aria-label="Позвонить" title="${escHtml(m.client_phone || "")}">📞</a>`
        : ""}
    </div>
  `);
  item.querySelector(".inbox-row-main").addEventListener("click", () => {
    haptic && haptic("impact");
    location.hash = `#/inbox/${m.id}`;
  });
  return item;
}

function formatPreferredHuman(m) {
  // Теперь приоритет — текст из preferred_note (свободная форма).
  // Старые записи с preferred_type/date/time_of_day выводятся как fallback.
  if (m.preferred_note) return m.preferred_note;
  const todMap = { morning: "утром", day: "днём", evening: "вечером" };
  const t = m.preferred_type || "tbd";
  const parts = [];
  if (t === "specific") {
    if (m.preferred_date) {
      try {
        const d = new Date(m.preferred_date);
        parts.push(`${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}`);
      } catch (e) { parts.push(m.preferred_date); }
    }
    if (m.preferred_time_of_day && todMap[m.preferred_time_of_day]) {
      parts.push(todMap[m.preferred_time_of_day]);
    }
    if (!parts.length) parts.push("конкретная дата");
  } else if (t === "this_week") {
    parts.push("эта неделя");
  } else if (t === "next_week") {
    parts.push("следующая неделя");
  } else {
    parts.push("согласовать с клиентом");
  }
  return parts.join(" ");
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

  // Примечание от менеджера (рекомендации по дате, особенности доступа)
  if (m.preferred_note) {
    app.appendChild(el(`
      <section class="block preferred-block">
        <div class="block-head">📝 Примечание менеджера</div>
        <div style="padding:12px 4px;color:var(--ink);font-size:14.5px;line-height:1.5;">${escHtml(m.preferred_note).replace(/\n/g, "<br>")}</div>
      </section>
    `));
  }

  // Блок логистики (подъезд, GPS, парковка) — заполняется на месте
  app.appendChild(renderLogisticsBlock(m));

  // Блок даты замера — две версии в зависимости от статуса
  const isScheduled = m.status === "scheduled" && m.scheduled_at;
  if (isScheduled) {
    // Дата назначена — показываем её крупно + кнопка «Изменить»
    const dateSection = el(`
      <section class="block date-set-block">
        <div class="block-head">📅 Замер назначен</div>
        <div class="date-set-value">${escHtml(formatDateHuman(m.scheduled_at))}</div>
        ${m.gcal_event_url ? `<div style="padding:4px 4px 8px;"><a href="${m.gcal_event_url}" target="_blank" rel="noopener" style="color:var(--accent-1, #003E7E);font-size:13px;">📅 Открыть в Google Calendar</a></div>` : ""}
        <div class="podbor-cta-row">
          <button class="btn-secondary" id="changeDate" type="button">Изменить дату</button>
        </div>
        <div class="date-set-form" id="changeDateForm" style="display:none;">
          <div class="form-row">
            <label class="field">
              <span class="field-label">Новая дата и время</span>
              <input type="datetime-local" id="schedInput" value="${toDatetimeLocalValue(m.scheduled_at)}">
              <span class="field-error" id="schedError"></span>
            </label>
          </div>
          <div class="podbor-cta-row">
            <button class="btn-secondary" id="cancelChange" type="button">Отмена</button>
            <button class="btn-primary" id="saveSched" type="button">Сохранить</button>
          </div>
        </div>
      </section>
    `);
    app.appendChild(dateSection);
    dateSection.querySelector("#changeDate").addEventListener("click", () => {
      dateSection.querySelector("#changeDateForm").style.display = "";
      dateSection.querySelector("#changeDate").style.display = "none";
    });
    dateSection.querySelector("#cancelChange").addEventListener("click", () => {
      dateSection.querySelector("#changeDateForm").style.display = "none";
      dateSection.querySelector("#changeDate").style.display = "";
    });
    dateSection.querySelector("#saveSched").addEventListener("click", () => saveScheduleDate(measurementId, dateSection));

    // ОСНОВНАЯ кнопка — начать замер (открывает мастер с чек-листом)
    const startSection = el(`
      <div class="podbor-cta-row" style="margin-top:20px;">
        <button class="btn-primary" id="startMeasure" style="font-size:16px;padding:14px 20px;">📐 Начать замер</button>
      </div>
      <div class="muted" style="text-align:center;font-size:12px;margin-top:8px;">
        Чек-лист, фото и заметки откроются после нажатия.
      </div>
    `);
    app.appendChild(startSection);
    startSection.querySelector("#startMeasure").addEventListener("click", () => {
      haptic && haptic("impact");
      location.hash = `#/measure?id=${measurementId}`;
    });
  } else {
    // Дата не назначена — основной шаг: согласовать и назначить
    const dateSection = el(`
      <section class="block">
        <div class="block-head">📞 Согласовать дату с клиентом</div>
        <div style="padding:8px 4px;color:var(--muted);font-size:13px;">
          Позвоните клиенту, договоритесь о точной дате и времени, затем зафиксируйте здесь.
        </div>
        <div class="form-row">
          <label class="field">
            <span class="field-label">Дата и время визита</span>
            <input type="datetime-local" id="schedInput">
            <span class="field-error" id="schedError"></span>
          </label>
        </div>
        <div class="podbor-cta-row">
          <button class="btn-primary" id="saveSched" type="button">Назначить</button>
        </div>
      </section>
    `);
    app.appendChild(dateSection);
    dateSection.querySelector("#saveSched").addEventListener("click", () => saveScheduleDate(measurementId, dateSection));
  }
}

async function saveScheduleDate(measurementId, section) {
  const input = section.querySelector("#schedInput");
  const errorEl = section.querySelector("#schedError");
  if (errorEl) errorEl.textContent = "";
  const val = input.value;
  if (!val) {
    if (errorEl) errorEl.textContent = "Укажите дату и время";
    return;
  }
  const iso = new Date(val).toISOString();
  try {
    const res = await fetch(`${BACKEND_URL}/api/measurement_schedule`, {
      method: "POST",
      body: JSON.stringify({
        initData: tg?.initData || "",
        initDataUnsafe: tg?.initDataUnsafe || null,
        measurement_id: measurementId,
        scheduled_at: iso,
      }),
    });
    const data = await res.json();
    if (data.error) {
      if (errorEl) errorEl.textContent = "Ошибка: " + data.error;
      return;
    }
    haptic && haptic("success");
    tg?.showAlert?.("Дата сохранена — менеджер уведомлён.");
    renderInboxDetail(measurementId); // перерисовать с новым статусом
  } catch (e) {
    if (errorEl) errorEl.textContent = "Сеть: " + e.message;
  }
}

function renderLogisticsBlock(m) {
  const hasData = !!(m.entrance || m.floor || m.gps_lat || m.parking_type || m.parking_note || m.delivery_notes);
  const parkingLabels = {
    free:   "🅿️ Бесплатная",
    paid:   "💰 Платная",
    street: "🛣️ На улице",
    none:   "🚫 Нет парковки",
  };

  const section = el(`
    <section class="block logistics-block">
      <div class="block-head" id="logHead">
        <span>📍 Логистика ${hasData ? '<span class="log-dot">●</span>' : ''}</span>
        <button class="log-toggle" id="logToggle" type="button">${hasData ? "Изменить" : "Заполнить"}</button>
      </div>
      <div class="log-summary" id="logSummary"></div>
      <div class="log-editor" id="logEditor" style="display:none;">
        <div class="form-row two-col">
          <label class="field">
            <span class="field-label">Подъезд</span>
            <input type="text" id="logEntrance" value="${escHtml(m.entrance || "")}" placeholder="например: 2">
          </label>
          <label class="field">
            <span class="field-label">Этаж</span>
            <input type="text" id="logFloor" value="${escHtml(m.floor || "")}" placeholder="например: 7">
          </label>
        </div>

        <div class="form-row">
          <label class="field">
            <span class="field-label">GPS координаты</span>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
              <input type="text" id="logGps" value="${m.gps_lat && m.gps_lng ? `${m.gps_lat}, ${m.gps_lng}` : ""}" placeholder="широта, долгота" style="flex:1;min-width:140px;">
              <button class="btn-secondary" id="getGps" type="button" style="white-space:nowrap;padding:8px 12px;">📍 Сейчас</button>
              <button class="btn-secondary" id="getGpsAddr" type="button" style="white-space:nowrap;padding:8px 12px;">🔍 По адресу</button>
            </div>
            <span class="field-hint" id="gpsHint">«Сейчас» — с устройства. «По адресу» — геокодер по адресу заявки.</span>
          </label>
        </div>

        <div class="form-row">
          <span class="field-label" style="display:block;margin-bottom:6px;">Парковка</span>
          <div class="preferred-options">
            <label class="pref-opt">
              <input type="radio" name="parkType" value="free" ${m.parking_type === "free" ? "checked" : ""}>
              <span class="pref-label">🅿️ Бесплатная</span>
            </label>
            <label class="pref-opt">
              <input type="radio" name="parkType" value="paid" ${m.parking_type === "paid" ? "checked" : ""}>
              <span class="pref-label">💰 Платная</span>
            </label>
            <label class="pref-opt">
              <input type="radio" name="parkType" value="street" ${m.parking_type === "street" ? "checked" : ""}>
              <span class="pref-label">🛣️ На улице</span>
            </label>
            <label class="pref-opt">
              <input type="radio" name="parkType" value="none" ${m.parking_type === "none" ? "checked" : ""}>
              <span class="pref-label">🚫 Нет парковки</span>
            </label>
          </div>
          <input type="text" id="logParkNote" value="${escHtml(m.parking_note || "")}" placeholder="зона, тариф, как оплатить" style="margin-top:8px;">
        </div>

        <div class="form-row">
          <label class="field">
            <span class="field-label">Заметки логистики</span>
            <textarea id="logDelivery" rows="3" placeholder="домофон, шлагбаум, размер лифта (для сборщика), узкий проезд, ...">${escHtml(m.delivery_notes || "")}</textarea>
          </label>
        </div>

        <div class="podbor-cta-row">
          <button class="btn-secondary" id="logCancel" type="button">Отмена</button>
          <button class="btn-primary" id="logSave" type="button">Сохранить</button>
        </div>
      </div>
    </section>
  `);

  // Сводка (когда не в режиме редактирования)
  function updateSummary(curM) {
    const sum = section.querySelector("#logSummary");
    const lines = [];
    if (curM.entrance) lines.push(`Подъезд <b>${escHtml(curM.entrance)}</b>`);
    if (curM.floor)    lines.push(`этаж <b>${escHtml(curM.floor)}</b>`);
    if (curM.gps_lat && curM.gps_lng) {
      const ymUrl = `https://yandex.ru/maps/?pt=${curM.gps_lng},${curM.gps_lat},pm2rdm&z=17&ll=${curM.gps_lng},${curM.gps_lat}`;
      lines.push(`<a href="${ymUrl}" target="_blank" rel="noopener">📍 ${curM.gps_lat}, ${curM.gps_lng}</a>`);
    }
    if (curM.parking_type && parkingLabels[curM.parking_type]) {
      let p = parkingLabels[curM.parking_type];
      if (curM.parking_note) p += ` · ${escHtml(curM.parking_note)}`;
      lines.push(p);
    }
    if (curM.delivery_notes) {
      lines.push(`<i>${escHtml(curM.delivery_notes)}</i>`);
    }
    sum.innerHTML = lines.length
      ? lines.join(" · ")
      : `<span style="color:var(--muted);font-size:13px;">Информация для подъезда не заполнена — заполни при выезде.</span>`;
  }
  updateSummary(m);

  const editor = section.querySelector("#logEditor");
  const summary = section.querySelector("#logSummary");
  const toggleBtn = section.querySelector("#logToggle");

  function setEdit(on) {
    editor.style.display = on ? "" : "none";
    summary.style.display = on ? "none" : "";
    toggleBtn.style.display = on ? "none" : "";
  }

  toggleBtn.addEventListener("click", () => setEdit(true));
  section.querySelector("#logCancel").addEventListener("click", () => setEdit(false));

  // GPS «Сейчас»
  section.querySelector("#getGps").addEventListener("click", () => {
    const hint = section.querySelector("#gpsHint");
    hint.textContent = "Запрашиваем координаты...";
    if (!navigator.geolocation) {
      hint.textContent = "Геолокация недоступна. Введите вручную.";
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        section.querySelector("#logGps").value = `${lat}, ${lng}`;
        hint.textContent = `Получено · точность ${Math.round(pos.coords.accuracy)} м`;
        haptic && haptic("success");
      },
      (err) => {
        hint.textContent = `Не удалось: ${err.message || "отказано в доступе"}`;
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });

  // GPS «По адресу» — геокодирование через backend
  section.querySelector("#getGpsAddr").addEventListener("click", async () => {
    const hint = section.querySelector("#gpsHint");
    const addr = (m.address || "").trim();
    if (!addr) {
      hint.textContent = "В заявке нет адреса — нужен текст адреса для геокодера.";
      return;
    }
    hint.textContent = "Ищем по адресу...";
    try {
      const res = await fetch(`${BACKEND_URL}/api/geocode`, {
        method: "POST",
        body: JSON.stringify({
          initData: tg?.initData || "",
          initDataUnsafe: tg?.initDataUnsafe || null,
          address: addr,
        }),
      });
      const data = await res.json();
      if (!data.ok || !data.result) {
        hint.textContent = "Адрес не найден геокодером — введите GPS вручную.";
        return;
      }
      const r = data.result;
      section.querySelector("#logGps").value = `${r.lat.toFixed(6)}, ${r.lng.toFixed(6)}`;
      const srcLabel = r.source === "yandex" ? "Я.Геокодер" : "OSM";
      hint.textContent = `Найдено: ${r.formatted || addr} · источник ${srcLabel}`;
      haptic && haptic("success");
    } catch (e) {
      hint.textContent = "Сеть: " + e.message;
    }
  });

  // Сохранение
  section.querySelector("#logSave").addEventListener("click", async () => {
    const btn = section.querySelector("#logSave");
    btn.disabled = true;
    btn.textContent = "Сохраняем...";
    const gpsStr = (section.querySelector("#logGps").value || "").trim();
    let gps_lat = "", gps_lng = "";
    if (gpsStr) {
      const parts = gpsStr.split(/[,;\s]+/).filter(Boolean);
      if (parts.length >= 2) {
        gps_lat = parts[0];
        gps_lng = parts[1];
      }
    }
    const parkType = (section.querySelector('input[name="parkType"]:checked') || {}).value || "";
    const payload = {
      initData: tg?.initData || "",
      initDataUnsafe: tg?.initDataUnsafe || null,
      measurement_id: m.id,
      entrance:       section.querySelector("#logEntrance").value,
      floor:          section.querySelector("#logFloor").value,
      gps_lat, gps_lng,
      parking_type:   parkType,
      parking_note:   section.querySelector("#logParkNote").value,
      delivery_notes: section.querySelector("#logDelivery").value,
    };
    try {
      const res = await fetch(`${BACKEND_URL}/api/measurement_logistics`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) {
        btn.disabled = false;
        btn.textContent = "Сохранить";
        alert("Ошибка: " + data.error);
        return;
      }
      // Обновляем локальные данные и сводку
      Object.assign(m, data.logistics || {});
      updateSummary(m);
      setEdit(false);
      // Обновляем точку-индикатор «есть данные»
      const hasNow = !!(m.entrance || m.floor || m.gps_lat || m.parking_type || m.parking_note || m.delivery_notes);
      const head = section.querySelector("#logHead span");
      head.innerHTML = `📍 Логистика ${hasNow ? '<span class="log-dot">●</span>' : ''}`;
      toggleBtn.textContent = hasNow ? "Изменить" : "Заполнить";
      btn.disabled = false;
      btn.textContent = "Сохранить";
      haptic && haptic("success");
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Сохранить";
      alert("Сеть: " + e.message);
    }
  });

  return section;
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
    if (location.hash.startsWith("#/assembly")) {
      Assembly.mount(app);
      hideSplash();
      return;
    }
    if (location.hash.startsWith("#/c/proposal")) {
      app.innerHTML = "";
      document.body.classList.remove("has-bottom-nav");
      const oldNav = document.getElementById("bottom-nav");
      if (oldNav) oldNav.remove();
      if (typeof Proposals !== "undefined") {
        Proposals.mountClient(app);
      } else {
        app.innerHTML = `<div class="error">Модуль подбора не загружен</div>`;
      }
      hideSplash();
      return;
    }
    if (location.hash.startsWith("#/c/contract")) {
      app.innerHTML = "";
      document.body.classList.remove("has-bottom-nav");
      const oldNavC = document.getElementById("bottom-nav");
      if (oldNavC) oldNavC.remove();
      if (typeof Proposals !== "undefined") {
        Proposals.mountContractReview(app);
      } else {
        app.innerHTML = `<div class="error">Модуль не загружен</div>`;
      }
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
  } else if (location.hash.startsWith("#/assembly")) {
    Assembly.mount(app);
  } else if (location.hash.startsWith("#/c/proposal")) {
    app.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    const oldNav2 = document.getElementById("bottom-nav");
    if (oldNav2) oldNav2.remove();
    if (typeof Proposals !== "undefined") {
      Proposals.mountClient(app);
    } else {
      app.innerHTML = `<div class="error">Модуль подбора не загружен</div>`;
    }
  } else if (location.hash.startsWith("#/c/contract")) {
    app.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    const oldNav3 = document.getElementById("bottom-nav");
    if (oldNav3) oldNav3.remove();
    if (typeof Proposals !== "undefined") {
      Proposals.mountContractReview(app);
    } else {
      app.innerHTML = `<div class="error">Модуль не загружен</div>`;
    }
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
