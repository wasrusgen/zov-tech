/* ============================================================
   Клиенты — список + история подборов
   ============================================================ */

const Clients = (function () {
  let root = null;
  let clientsCache = null;

  /* ===================== Mount ===================== */

  function mount(container) {
    root = container;
    document.body.classList.remove("has-bottom-nav");
    const oldNav = document.getElementById("bottom-nav");
    if (oldNav) oldNav.remove();

    const sub = location.hash.replace(/^#\/clients\/?/, "");
    if (sub.startsWith("lead/")) {
      const leadId = sub.slice(5);
      renderLead(leadId);
    } else if (sub.startsWith("measurement/")) {
      const measurementId = sub.slice(12);
      renderMeasurement(measurementId);
    } else if (sub.startsWith("client/")) {
      const clientKey = decodeURIComponent(sub.slice(7));
      renderClientHistory(clientKey);
    } else {
      renderList();
    }
  }

  /* ===================== Список клиентов ===================== */

  async function renderList() {
    root.innerHTML = "";
    root.appendChild(headerEl("Клиенты", null));
    const loading = el(`<div class="loader-inline"><div class="spinner"></div></div>`);
    root.appendChild(loading);

    let data;
    try {
      data = await fetchClients();
      clientsCache = data;
    } catch (e) {
      loading.remove();
      root.appendChild(el(`<div class="error">Не удалось загрузить: ${e.message}</div>`));
      return;
    }
    loading.remove();

    if (!data.clients || !data.clients.length) {
      root.appendChild(el(`
        <div class="empty">
          <p class="lede" style="text-align:center;padding:40px 20px;color:var(--muted)">
            У тебя пока нет подборов с клиентами.<br>
            Сделай первый — в кабинете «Подбор техники».
          </p>
        </div>
      `));
      return;
    }

    const meta = el(`
      <div class="kicker" style="margin-bottom:8px;">
        ${data.count} ${pluralize(data.count, "клиент", "клиента", "клиентов")} · ${countLeads(data.clients)} ${pluralize(countLeads(data.clients), "подбор", "подбора", "подборов")}
      </div>
    `);
    root.appendChild(meta);

    const list = el(`<div class="client-list"></div>`);
    for (const c of data.clients) {
      list.appendChild(renderClientCard(c));
    }
    root.appendChild(list);
  }

  function renderClientCard(c) {
    const lastAt = formatDate(c.last_lead_at);
    const card = el(`
      <article class="client-card">
        <div class="client-card-head">
          <div class="client-avatar">${initial(c.client_name)}</div>
          <div class="client-meta">
            <div class="client-name">${escHtml(c.client_name || "Без имени")}</div>
            ${c.client_phone ? `<div class="client-phone">${escHtml(c.client_phone)}</div>` : ""}
          </div>
          <div class="client-arrow">${ICONS.chevron || "›"}</div>
        </div>
        <div class="client-footer">
          <span class="leads-count">${c.leads_count} ${pluralize(c.leads_count, "подбор", "подбора", "подборов")}</span>
          <span class="muted">${lastAt}</span>
        </div>
      </article>
    `);
    card.addEventListener("click", () => {
      haptic && haptic("impact");
      const key = c.client_tg_id || c.client_name.toLowerCase();
      location.hash = `#/clients/client/${encodeURIComponent(key)}`;
    });
    return card;
  }

  /* ===================== История клиента ===================== */

  async function renderClientHistory(clientKey) {
    root.innerHTML = "";
    root.appendChild(headerEl("История подборов", "#/clients"));

    // Берём из кеша если есть
    let clients = clientsCache?.clients;
    if (!clients) {
      try {
        const data = await fetchClients();
        clients = data.clients;
        clientsCache = data;
      } catch (e) {
        root.appendChild(el(`<div class="error">${e.message}</div>`));
        return;
      }
    }
    const client = clients.find(c =>
      (c.client_tg_id && c.client_tg_id === clientKey) ||
      (c.client_name && c.client_name.toLowerCase() === clientKey)
    );
    if (!client) {
      root.appendChild(el(`<div class="empty">Клиент не найден</div>`));
      return;
    }

    root.appendChild(el(`
      <div class="client-detail-head">
        <div class="client-avatar lg">${initial(client.client_name)}</div>
        <div>
          <h2 class="client-detail-name">${escHtml(client.client_name)}</h2>
          ${client.client_phone ? `<div class="client-detail-phone">${escHtml(client.client_phone)}</div>` : ""}
        </div>
      </div>
    `));

    root.appendChild(el(`<div class="section-head"><span class="label">Подборы · ${client.leads_count}</span></div>`));

    const leadsList = el(`<div class="leads-list"></div>`);
    for (const lead of client.leads) {
      const item = el(`
        <button class="lead-item">
          <div class="lead-date">${formatDate(lead.created_at)}</div>
          <div class="lead-id">#${(lead.id || "").slice(0, 8)}</div>
          <div class="lead-status status-${lead.status || "new"}">${statusLabel(lead.status)}</div>
          <div class="lead-arrow">${ICONS.chevron || "›"}</div>
        </button>
      `);
      item.addEventListener("click", () => {
        haptic && haptic("impact");
        location.hash = `#/clients/lead/${lead.id}`;
      });
      leadsList.appendChild(item);
    }
    root.appendChild(leadsList);

    // Замеры этого клиента (если есть)
    try {
      const ms = await fetchMeasurements({ client_tg_id: client.client_tg_id || "" });
      const myMeasurements = (ms.measurements || []).filter(m => {
        // Если client_tg_id зарегистрирован — фильтруем по нему
        if (client.client_tg_id) return String(m.client_tg_id) === String(client.client_tg_id);
        // Иначе — ищем имя клиента в notes (упрощённая логика для новых клиентов)
        return (m.notes || "").toLowerCase().includes((client.client_name || "").toLowerCase());
      });
      if (myMeasurements.length) {
        root.appendChild(el(`<div class="section-head" style="margin-top:24px;"><span class="label">Замеры · ${myMeasurements.length}</span></div>`));
        const mList = el(`<div class="leads-list"></div>`);
        for (const m of myMeasurements) {
          const photoCount = m.photo_count || (m.photos || []).length;
          const photoBadge = photoCount ? ` · 📷 ${photoCount}` : "";
          const item = el(`
            <button class="lead-item">
              <div class="lead-date">${formatDate(m.created_at)}</div>
              <div class="lead-id">${escHtml(layoutLabel(m.layout))}</div>
              <div class="lead-status">${m.area_m2 ? m.area_m2 + " м²" : "—"}${photoBadge}</div>
              <div class="lead-arrow">${ICONS.chevron || "›"}</div>
            </button>
          `);
          item.addEventListener("click", () => {
            haptic && haptic("impact");
            location.hash = `#/clients/measurement/${m.id}`;
          });
          mList.appendChild(item);
        }
        root.appendChild(mList);
      }
    } catch (e) {
      // Игнорируем — секция замеров просто не покажется
    }
  }

  function layoutLabel(key) {
    return ({
      linear: "Прямая",
      l_shape: "Угловая Г",
      u_shape: "П-образная",
      island: "С островом",
      peninsula: "Полуостров",
    }[key]) || (key || "—");
  }

  /* ===================== Детали лида (re-render отчёта) ===================== */

  async function renderLead(leadId) {
    root.innerHTML = "";
    root.appendChild(headerEl("Подбор", "back"));
    const loading = el(`<div class="loader-inline"><div class="spinner"></div></div>`);
    root.appendChild(loading);

    let lead;
    try {
      lead = await fetchLead(leadId);
    } catch (e) {
      loading.remove();
      root.appendChild(el(`<div class="error">${e.message}</div>`));
      return;
    }
    loading.remove();

    if (lead.error) {
      root.appendChild(el(`<div class="error">${lead.error}</div>`));
      return;
    }

    // Шапка
    root.appendChild(el(`
      <div class="lead-detail-head">
        <div class="kicker">Подбор #${(lead.id || "").slice(0, 8)}</div>
        <h2 class="display-title">${escHtml(lead.client_name || "Клиент")}</h2>
        <p class="lede">Сохранён ${formatDate(lead.created_at)}</p>
      </div>
    `));

    // Рендерим отчёт через Podbor.renderReport если ai-json есть
    if (lead.ai && typeof window.Podbor?.renderSavedReport === "function") {
      const reportNode = window.Podbor.renderSavedReport(lead.ai, lead.id);
      root.appendChild(reportNode);
    } else if (lead.ai_text) {
      // Fallback — AI вернул plain text
      root.appendChild(el(`
        <div class="block">
          <div class="block-head">AI ответ</div>
          <pre class="ai-text-fallback">${escHtml(lead.ai_text)}</pre>
        </div>
      `));
    } else {
      root.appendChild(el(`<div class="empty">Для этого лида нет AI-ответа.</div>`));
    }
  }

  /* ===================== Деталь замера ===================== */

  async function renderMeasurement(measurementId) {
    root.innerHTML = "";
    root.appendChild(headerEl("Замер", "back"));
    const loading = el(`<div class="loader-inline"><div class="spinner"></div></div>`);
    root.appendChild(loading);

    let m;
    try {
      m = await fetchMeasurementDetail(measurementId);
    } catch (e) {
      loading.remove();
      root.appendChild(el(`<div class="error">${e.message}</div>`));
      return;
    }
    loading.remove();

    if (m.error) {
      root.appendChild(el(`<div class="error">${m.error}</div>`));
      return;
    }

    const walls = m.walls || {};
    const wallsText = Object.entries(walls)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${k.replace("wall", "стена ")}: ${v} мм`)
      .join(" · ");

    const openings = m.openings || {};

    // Шапка + кнопка печати/PDF
    root.appendChild(el(`
      <div class="measurement-detail-head">
        <div class="kicker">Замер #${(m.id || "").slice(0, 8)}</div>
        <h2 class="display-title">${escHtml(layoutLabel(m.layout))}</h2>
        <div class="measurement-detail-meta">
          <span>📅 ${formatDate(m.created_at)}</span>
          ${m.area_m2 ? `<span>📐 ${escHtml(m.area_m2)} м²</span>` : ""}
          ${m.ceiling_mm ? `<span>📏 потолок ${escHtml(m.ceiling_mm)} мм</span>` : ""}
        </div>
      </div>
    `));

    const printBtn = el(`<button class="report-print-btn">🖨️ Скачать PDF / Печать</button>`);
    printBtn.addEventListener("click", () => window.print());
    root.appendChild(printBtn);

    // Основной блок
    const detail = el(`
      <div class="block summary-block">
        <div class="measurement-kv-grid">
          ${wallsText ? `<div class="k">Стены</div><div class="v">${escHtml(wallsText)}</div>` : ""}
          ${openings.window ? `<div class="k">Окно</div><div class="v">${escHtml(openings.window)}</div>` : ""}
          ${openings.door ? `<div class="k">Дверь</div><div class="v">${escHtml(openings.door)}</div>` : ""}
          ${m.notes ? `<div class="k">Заметки</div><div class="v">${escHtml(m.notes).replace(/\n/g, "<br>")}</div>` : ""}
        </div>
      </div>
    `);
    root.appendChild(detail);

    // Фото
    const photos = (m.photos || []).filter(Boolean);
    if (photos.length) {
      root.appendChild(el(`<div class="section-head" style="margin-top:18px;"><span class="label">Фото · ${photos.length}</span></div>`));
      const list = el(`<div class="photo-list"></div>`);
      for (const fn of photos) {
        const url = `${BACKEND_URL}/api/photo/${m.id}/${fn}`;
        const tile = el(`
          <a class="photo-tile static" href="${url}" target="_blank" rel="noopener">
            <img src="${url}" alt="">
          </a>
        `);
        list.appendChild(tile);
      }
      root.appendChild(list);
    }
  }

  async function fetchMeasurementDetail(measurementId) {
    if (!BACKEND_URL) throw new Error("BACKEND_URL не задан");
    const res = await fetch(`${BACKEND_URL}/api/measurement_detail`, {
      method: "POST",
      body: JSON.stringify({ initData: tg?.initData || "", measurement_id: measurementId }),
    });
    return await res.json();
  }

  /* ===================== Helpers ===================== */

  function headerEl(title, backHref) {
    const h = el(`
      <header class="podbor-header">
        <button class="podbor-back" aria-label="Назад">${ICONS.arrow_left || "‹"}</button>
        <div class="podbor-title">${escHtml(title)}</div>
        <div style="width:28px"></div>
      </header>
    `);
    h.querySelector(".podbor-back").addEventListener("click", () => {
      if (backHref === "back") {
        history.back();
      } else if (backHref) {
        location.hash = backHref;
      } else {
        location.hash = "";
        location.reload();
      }
    });
    return h;
  }

  async function fetchClients() {
    if (!BACKEND_URL) throw new Error("BACKEND_URL не задан");
    const res = await fetch(`${BACKEND_URL}/api/clients`, {
      method: "POST",
      body: JSON.stringify({ initData: tg?.initData || "" }),
    });
    return await res.json();
  }

  async function fetchLead(leadId) {
    if (!BACKEND_URL) throw new Error("BACKEND_URL не задан");
    const res = await fetch(`${BACKEND_URL}/api/lead`, {
      method: "POST",
      body: JSON.stringify({ initData: tg?.initData || "", lead_id: leadId }),
    });
    return await res.json();
  }

  async function fetchMeasurements(filters = {}) {
    if (!BACKEND_URL) throw new Error("BACKEND_URL не задан");
    const res = await fetch(`${BACKEND_URL}/api/measurements`, {
      method: "POST",
      body: JSON.stringify({ initData: tg?.initData || "", ...filters }),
    });
    return await res.json();
  }

  function initial(name) {
    return ((name || "?").trim()[0] || "?").toUpperCase();
  }

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      if (sameDay) return `сегодня · ${hh}:${mi}`;
      return `${dd}.${mm}.${yy}`;
    } catch (e) {
      return iso.slice(0, 10);
    }
  }

  function pluralize(n, one, few, many) {
    const last = n % 10, lastTwo = n % 100;
    if (lastTwo >= 11 && lastTwo <= 14) return many;
    if (last === 1) return one;
    if (last >= 2 && last <= 4) return few;
    return many;
  }

  function countLeads(clients) {
    return clients.reduce((s, c) => s + (c.leads_count || 0), 0);
  }

  function statusLabel(s) {
    const map = {
      "new": "Новый",
      "sent": "Отправлен",
      "viewed": "Просмотрен",
      "ordered": "Оформлен",
    };
    return map[s] || s || "—";
  }

  return { mount };
})();
