/* ============================================================
   Детальная карточка сборки — #/c/assembly/:id
   Доступна клиенту, менеджеру, мастеру.
   ============================================================ */

const AssemblyDetailScreen = (function () {

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtDate(iso) {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString("ru-RU", {
        day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
    } catch { return iso.slice(0, 16).replace("T", " "); }
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

  const STATUS = {
    created:     { icon: "🆕", text: "Создана",       color: "#8e8e8e" },
    scheduled:   { icon: "📅", text: "Запланирована", color: "#2980B9" },
    in_progress: { icon: "🔨", text: "В процессе",    color: "#F39C12" },
    done:        { icon: "✅", text: "Завершена",      color: "#27AE60" },
    cancelled:   { icon: "❌", text: "Отменена",       color: "#C0392B" },
  };

  function row(label, value, opts = {}) {
    if (!value) return "";
    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;
                  padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="font-size:12px;color:var(--muted);flex-shrink:0;margin-right:12px;">${escHtml(label)}</div>
        <div style="font-size:13px;font-weight:500;color:${opts.color || "var(--ink)"};text-align:right;">${opts.html ? value : escHtml(value)}</div>
      </div>`;
  }

  async function mount(container, assemblyId) {
    container.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    const oldNav = document.getElementById("bottom-nav");
    if (oldNav) oldNav.remove();

    // Header
    const h = document.createElement("header");
    h.className = "podbor-header";
    h.innerHTML = `
      <button class="podbor-back" aria-label="Назад">${(window.ICONS || {}).arrow_left || "‹"}</button>
      <div class="podbor-title">Сборка кухни</div>
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
      const data = await _api("assembly_detail", { assembly_id: assemblyId });

      if (data.error) {
        screen.innerHTML = `<div class="error" style="margin:16px;">${escHtml(data.error)}</div>`;
        return;
      }

      const sl = STATUS[data.status] || { icon: "🔧", text: data.status, color: "#8e8e8e" };

      // Статус-баннер
      const statusBanner = `
        <div style="display:flex;align-items:center;gap:10px;padding:16px;
                    background:var(--surface);border-bottom:1px solid var(--border);">
          <div style="font-size:32px;">${sl.icon}</div>
          <div>
            <div style="font-size:16px;font-weight:700;color:${sl.color};">${escHtml(sl.text)}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">ID: ${escHtml(data.id)}</div>
          </div>
        </div>`;

      // Основные данные
      const mainBlock = `
        <div style="margin:12px 16px 0;border:1px solid var(--border);border-radius:12px;
                    padding:0 12px;background:var(--surface);">
          ${row("Адрес", data.address)}
          ${data.kitchen_price ? row("Стоимость кухни", Number(data.kitchen_price).toLocaleString("ru-RU") + " ₽") : ""}
          ${data.kitchen_price ? row("Стоимость сборки", Number(Math.round(data.kitchen_price * 0.09)).toLocaleString("ru-RU") + " ₽", {color: "var(--accent)"}) : ""}
          ${row("Объём работ", data.scope_of_work)}
          ${row("Дата сборки", fmtDate(data.scheduled_at))}
          ${row("Начало", fmtDate(data.started_at))}
          ${row("Завершение", fmtDate(data.completed_at))}
        </div>`;

      // Заметка менеджера
      const noteBlock = data.manager_note ? `
        <div style="margin:12px 16px 0;padding:12px;background:var(--surface-2,var(--surface));
                    border:1px solid var(--border);border-radius:12px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;
                      letter-spacing:.06em;color:var(--muted);margin-bottom:6px;">Заметка</div>
          <div style="font-size:13px;color:var(--ink);line-height:1.5;">${escHtml(data.manager_note)}</div>
        </div>` : "";

      // Фото результата
      const photosAfter = (data.photos_after || []).filter(Boolean);
      const photosBlock = photosAfter.length ? `
        <div style="margin:12px 16px 0;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;
                      letter-spacing:.06em;color:var(--muted);margin-bottom:8px;">Фото результата</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${photosAfter.map(u => `
              <a href="${escHtml(u)}" target="_blank">
                <img src="${escHtml(u)}" alt="фото"
                     style="width:80px;height:80px;object-fit:cover;border-radius:8px;
                            border:1px solid var(--border);">
              </a>`).join("")}
          </div>
        </div>` : "";

      // Подпись
      const signBlock = data.signed_by_name ? `
        <div style="margin:12px 16px 0;padding:10px 12px;background:var(--surface);
                    border:1px solid var(--border);border-radius:12px;
                    display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:12px;color:var(--muted);">Принято клиентом</div>
            <div style="font-size:13px;font-weight:600;color:var(--ink);">${escHtml(data.signed_by_name)}</div>
          </div>
          <div style="font-size:12px;color:var(--muted);">${escHtml(fmtDate(data.signed_at) || "")}</div>
        </div>` : "";

      // Кнопка Google Calendar
      const calBtn = data.gcal_event_url ? `
        <div style="margin:12px 16px 0;">
          <a href="${escHtml(data.gcal_event_url)}" target="_blank"
             style="display:flex;align-items:center;justify-content:center;gap:8px;
                    padding:12px;border:1px solid var(--border);border-radius:10px;
                    background:var(--surface);text-decoration:none;
                    font-size:13px;font-weight:600;color:var(--accent);">
            📅 Посмотреть в Google Календаре
          </a>
        </div>` : "";

      screen.innerHTML = statusBanner + mainBlock + noteBlock + photosBlock + signBlock + calBtn +
        `<div style="height:32px;"></div>`;

    } catch (e) {
      screen.innerHTML = `<div class="error" style="margin:16px;">Ошибка: ${escHtml(e.message)}</div>`;
    }
  }

  return { mount };
})();
