/* ============================================================
   История заказов — #/c/orders
   Единый таймлайн: подборы + сборки клиента.
   ============================================================ */

const OrdersScreen = (function () {

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtDate(iso) {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    } catch { return iso.slice(0, 10); }
  }

  async function _api(path, body = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(`${BACKEND_URL}/api/${path}`, {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: tg?.initData || "", initDataUnsafe: tg?.initDataUnsafe || null, ...body }),
      });
      if (!res.ok) throw new Error(`Ошибка сервера (${res.status})`);
      return await res.json();
    } catch (e) {
      if (e.name === "AbortError") throw new Error("Сервер не отвечает");
      throw e;
    } finally { clearTimeout(t); }
  }

  /* ---- Статусы подборов ---------------------------------------- */
  const PROPOSAL_LABELS = {
    brief:    { icon: "📝", text: "Анкета заполнена",  color: "#8e8e8e" },
    draft:    { icon: "⏳", text: "Готовим подбор",    color: "#F39C12" },
    sent:     { icon: "📨", text: "Подбор отправлен",  color: "#2980B9" },
    reviewed: { icon: "✅", text: "Вы просмотрели",    color: "#27AE60" },
    done:     { icon: "🎉", text: "Завершён",          color: "#16a085" },
    archived: { icon: "📦", text: "В архиве",          color: "#bdc3c7" },
  };

  /* ---- Статусы сборок ------------------------------------------ */
  const ASSEMBLY_LABELS = {
    created:     { icon: "🆕", text: "Создана",        color: "#8e8e8e" },
    scheduled:   { icon: "📅", text: "Запланирована",  color: "#2980B9" },
    in_progress: { icon: "🔨", text: "В процессе",     color: "#F39C12" },
    done:        { icon: "✅", text: "Завершена",       color: "#27AE60" },
    cancelled:   { icon: "❌", text: "Отменена",        color: "#C0392B" },
  };

  /* ---- Один элемент таймлайна ---------------------------------- */
  function renderItem(item) {
    const statusStyle = `color:${item.statusColor};font-size:12px;font-weight:500;`;
    const hasLink = !!item.href;
    const dateStr = fmtDate(item.date);

    return `
      <div class="orders-item${hasLink ? " orders-item--link" : ""}"
           ${hasLink ? `data-href="${escHtml(item.href)}"` : ""}>
        <div class="orders-item-left">
          <div class="orders-item-icon">${item.icon}</div>
          <div class="orders-item-line"></div>
        </div>
        <div class="orders-item-body">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <div class="orders-item-type">${escHtml(item.typeLabel)}</div>
              ${item.title ? `<div class="orders-item-title">${escHtml(item.title)}</div>` : ""}
            </div>
            <div style="flex-shrink:0;text-align:right;">
              <div style="${statusStyle}">${escHtml(item.statusText)}</div>
              ${dateStr ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;">${escHtml(dateStr)}</div>` : ""}
            </div>
          </div>
          ${item.subtitle ? `<div class="orders-item-subtitle">${escHtml(item.subtitle)}</div>` : ""}
          ${item.calUrl ? `<a href="${escHtml(item.calUrl)}" target="_blank" style="font-size:12px;color:var(--accent);text-decoration:none;">📅 Посмотреть в календаре</a>` : ""}
        </div>
      </div>`;
  }

  /* ---- Маппинг подбора в элемент таймлайна -------------------- */
  function proposalToItem(p) {
    const sl = PROPOSAL_LABELS[p.status] || { icon: "📋", text: p.status, color: "#8e8e8e" };
    const partsArr = [];
    if (p.n_categories) partsArr.push(`${p.n_categories} категор.`);
    if (p.n_variants)   partsArr.push(`${p.n_variants} вар.`);
    const subtitle = partsArr.join(" · ");
    const date = p.sent_at || p.reviewed_at || p.created_at;
    return {
      type: "proposal",
      date,
      icon: sl.icon,
      typeLabel: "Подбор кухни",
      title: null,
      subtitle: subtitle || null,
      statusText: sl.text,
      statusColor: sl.color,
      href: p.id ? `#/c/proposal/${encodeURIComponent(p.id)}` : null,
      calUrl: null,
    };
  }

  /* ---- Маппинг сборки в элемент таймлайна --------------------- */
  function assemblyToItem(a) {
    const sl = ASSEMBLY_LABELS[a.status] || { icon: "🔧", text: a.status, color: "#8e8e8e" };
    const date = a.scheduled_at || a.ts;
    return {
      type: "assembly",
      date,
      icon: sl.icon,
      typeLabel: "Сборка кухни",
      title: a.address || null,
      subtitle: a.scope_of_work || null,
      statusText: sl.text,
      statusColor: sl.color,
      href: null,
      calUrl: a.gcal_event_url || null,
    };
  }

  /* ---- Пустое состояние --------------------------------------- */
  function renderEmpty() {
    return `
      <div style="display:flex;flex-direction:column;align-items:center;padding:60px 24px;text-align:center;">
        <div style="font-size:48px;margin-bottom:16px;">📋</div>
        <div style="font-size:16px;font-weight:600;color:var(--ink);margin-bottom:8px;">Заказов пока нет</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.5;max-width:260px;">
          Когда менеджер создаст подбор или запланирует сборку — всё появится здесь.
        </div>
        <button class="btn-primary" data-href="#/c/proposal" style="margin-top:24px;min-width:200px;">🛒 Запросить подбор</button>
      </div>`;
  }

  /* ── mount ─────────────────────────────────────────────────── */
  async function mount(container) {
    container.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    const oldNav = document.getElementById("bottom-nav");
    if (oldNav) oldNav.remove();

    // Header
    const h = document.createElement("header");
    h.className = "podbor-header";
    h.innerHTML = `
      <button class="podbor-back" aria-label="Назад">${(window.ICONS || {}).arrow_left || "‹"}</button>
      <div class="podbor-title">История заказов</div>
      <div style="width:36px"></div>
    `;
    h.querySelector(".podbor-back").addEventListener("click", () => {
      haptic && haptic("impact");
      history.back();
    });
    container.appendChild(h);

    const screen = document.createElement("div");
    screen.className = "podbor-screen";
    screen.innerHTML = `<div class="loader-inline"><div class="spinner"></div></div>`;
    container.appendChild(screen);

    try {
      const [proposalsData, assembliesData] = await Promise.all([
        _api("proposal_list").catch(() => ({ proposals: [] })),
        _api("assembly_list").catch(() => ({ assemblies: [] })),
      ]);

      const proposals = (proposalsData.proposals || []).map(proposalToItem);
      const assemblies = (assembliesData.assemblies || []).map(assemblyToItem);

      const all = [...proposals, ...assemblies].sort((a, b) => {
        const da = a.date || "";
        const db = b.date || "";
        return db.localeCompare(da);
      });

      screen.innerHTML = "";

      if (!all.length) {
        screen.innerHTML = renderEmpty();
        screen.querySelectorAll("[data-href]").forEach(el => {
          el.addEventListener("click", () => {
            haptic && haptic("impact");
            location.hash = el.dataset.href;
          });
        });
        return;
      }

      // Счётчик
      const countDiv = document.createElement("div");
      countDiv.style.cssText = "padding:12px 16px 4px;font-size:13px;color:var(--muted);";
      countDiv.textContent = `Всего: ${all.length} ${_declinate(all.length, ["запись", "записи", "записей"])}`;
      screen.appendChild(countDiv);

      // Таймлайн
      const timeline = document.createElement("div");
      timeline.className = "orders-timeline";
      timeline.innerHTML = all.map(renderItem).join("");
      screen.appendChild(timeline);

      const spacer = document.createElement("div");
      spacer.style.height = "32px";
      screen.appendChild(spacer);

      // Клики
      screen.querySelectorAll("[data-href]").forEach(el => {
        el.addEventListener("click", () => {
          haptic && haptic("impact");
          location.hash = el.dataset.href;
        });
      });

    } catch (e) {
      screen.innerHTML = `<div class="error" style="margin:16px;">Ошибка: ${escHtml(e.message)}</div>`;
    }
  }

  function _declinate(n, forms) {
    const abs = Math.abs(n) % 100;
    const r = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (r > 1 && r < 5) return forms[1];
    if (r === 1) return forms[0];
    return forms[2];
  }

  return { mount };
})();
