// ЗОВ MiniApp — главный скрипт
// На входе: подписанный initData от Telegram.
// Ходим на backend → получаем профиль (роль, статус) → рендерим меню.

const tg = window.Telegram?.WebApp;
const BACKEND_URL = ""; // TODO: заполнить URL Apps Script Web App

const app = document.getElementById("app");

async function fetchMe() {
  if (!BACKEND_URL) {
    // dev-режим без backend — для локального просмотра вёрстки
    return {
      role: "manager",
      user: { full_name: "Тест Менеджер", salon: "ЗОВ Москва" },
      status: "active",
      status_until: "2026-08-12",
    };
  }
  const res = await fetch(`${BACKEND_URL}/api/me`, {
    method: "POST",
    body: JSON.stringify({
      initData: tg?.initData || "",
      startParam: tg?.initDataUnsafe?.start_param || null,
    }),
  });
  return res.json();
}

function renderManager(me) {
  const status = me.status || "active";
  app.innerHTML = `
    <div class="header">
      <h1>Кабинет менеджера</h1>
      <div class="subtitle">
        ${me.user.full_name} · ${me.user.salon || ""}
        <span class="status-badge ${status}">${statusLabel(status)}</span>
      </div>
    </div>
    <nav class="menu">
      <a class="menu-item" href="#/m/podbor">
        <span class="icon">🔧</span>
        <span class="label">Подбор техники для клиента</span>
        <span class="arrow">›</span>
      </a>
      <a class="menu-item" href="#/m/measurements">
        <span class="icon">📐</span>
        <span class="label">Замеры</span>
        <span class="arrow">›</span>
      </a>
      <div class="menu-item disabled">
        <span class="icon">📋</span>
        <span class="label">Заявки клиентов <small>(скоро)</small></span>
      </div>
      <div class="menu-item disabled">
        <span class="icon">💼</span>
        <span class="label">Сделки <small>(скоро)</small></span>
      </div>
      <a class="menu-item" href="#/m/status">
        <span class="icon">💰</span>
        <span class="label">Мой статус и доступ</span>
        <span class="arrow">›</span>
      </a>
    </nav>
  `;
}

function renderClient(me) {
  app.innerHTML = `
    <div class="header">
      <h1>Кабинет клиента</h1>
      <div class="subtitle">
        ${me.user.full_name || "Здравствуйте!"}
        ${me.manager ? `<br>Менеджер: ${me.manager.full_name}, ${me.manager.salon || ""}` : ""}
      </div>
    </div>
    <nav class="menu">
      <a class="menu-item" href="#/c/measure">
        <span class="icon">📐</span>
        <span class="label">Замер кухни</span>
        <span class="arrow">›</span>
      </a>
      <div class="menu-item disabled">
        <span class="icon">🔧</span>
        <span class="label">Подобрать технику <small>(скоро)</small></span>
      </div>
      <div class="menu-item disabled">
        <span class="icon">💡</span>
        <span class="label">Идеи и кейсы <small>(скоро)</small></span>
      </div>
      <a class="menu-item" href="#/c/contact">
        <span class="icon">📞</span>
        <span class="label">Связаться с менеджером</span>
        <span class="arrow">›</span>
      </a>
    </nav>
  `;
}

function statusLabel(s) {
  return { active: "🟢 active", lapsed: "🔴 lapsed", grace: "🟡 grace" }[s] || s;
}

async function init() {
  if (tg) {
    tg.ready();
    tg.expand();
  }
  try {
    const me = await fetchMe();
    if (me.role === "manager") renderManager(me);
    else renderClient(me);
  } catch (e) {
    app.innerHTML = `<div class="loader">Ошибка загрузки. Попробуйте позже.</div>`;
    console.error(e);
  }
}

init();
