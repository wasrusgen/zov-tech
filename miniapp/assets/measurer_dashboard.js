/* ============================================================
   MeasurerDashboard — личная статистика замерщика
   #/master/measurer-stats
   ============================================================ */

const MeasurerDashboard = (function () {
  "use strict";

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }
  function fmtMoney(n) {
    return Math.round(n || 0).toLocaleString("ru-RU") + " ₽";
  }
  function fmtMonth(ym) {
    try {
      const d = new Date(ym + "-01");
      return d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    } catch { return ym; }
  }

  async function _api(path, body = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(`${BACKEND_URL}/api/${path}`, {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: (typeof Platform !== "undefined" ? Platform.initData : (window.tg?.initData || "")),
          initDataUnsafe: (typeof Platform !== "undefined" ? Platform.initDataUnsafe : null),
          ...body,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (e.name === "AbortError") throw new Error("Таймаут");
      throw e;
    } finally { clearTimeout(t); }
  }

  async function mount(container) {
    container.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    document.getElementById("bottom-nav")?.remove();

    const h = el(`
      <header class="podbor-header">
        <button class="podbor-back">${(window.ICONS || {}).arrow_left || "‹"}</button>
        <div class="podbor-title">Мои замеры</div>
        <button id="reloadBtn" style="background:none;border:none;font-size:18px;cursor:pointer;padding:4px 8px;">↻</button>
      </header>
    `);
    h.querySelector(".podbor-back").addEventListener("click", () => { haptic && haptic("impact"); history.back(); });

    const yearEl = el(`
      <div style="padding:0 16px 8px;display:flex;align-items:center;gap:10px;">
        <label style="font-size:12px;color:var(--muted);">Год:</label>
        <select id="yearSelect" style="padding:5px 10px;border:1px solid var(--border);border-radius:8px;
                  background:var(--surface);color:var(--ink);font-size:13px;">
          <option value="2026" selected>2026</option>
          <option value="2025">2025</option>
          <option value="">Все</option>
        </select>
      </div>
    `);

    const screen = el(`<div class="podbor-screen"></div>`);
    container.appendChild(h);
    container.appendChild(yearEl);
    container.appendChild(screen);

    const load = async (year) => {
      screen.innerHTML = `<div class="loader-inline"><div class="spinner"></div></div>`;
      try {
        const data = await _api("measurer_earnings", { year });
        if (data.error) {
          screen.innerHTML = `<div class="error" style="margin:16px;">${escHtml(data.error)}</div>`;
          return;
        }
        _render(screen, data);
      } catch (e) {
        screen.innerHTML = `<div class="error" style="margin:16px;">Ошибка: ${escHtml(e.message)}</div>`;
      }
    };

    yearEl.querySelector("#yearSelect").addEventListener("change", function () { load(this.value); });
    h.querySelector("#reloadBtn").addEventListener("click", () => { haptic && haptic("impact"); load(yearEl.querySelector("#yearSelect").value); });
    load("2026");
  }

  function _render(screen, data) {
    screen.innerHTML = "";

    const months = data.months || {};
    const monthKeys = Object.keys(months).sort().reverse();

    const now = new Date();
    const curYM  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevD  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYM = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, "0")}`;

    const curMonth  = months[curYM]  || null;
    const prevMonth = months[prevYM] || null;

    // Hero
    screen.appendChild(el(`
      <div style="margin:0 16px 16px;padding:20px;background:var(--accent);border-radius:16px;color:#fff;">
        <div style="font-size:11px;opacity:.75;margin-bottom:4px;">Всего за период</div>
        <div style="font-size:28px;font-weight:800;">${escHtml(fmtMoney(data.total_amount))}</div>
        <div style="font-size:12px;opacity:.75;margin-top:4px;">
          ${escHtml(String(data.total_measurements))} замеров
          ${data.total_amount > 0 ? ` · ${escHtml(fmtMoney(data.total_amount / data.total_measurements))} в среднем` : ""}
        </div>
      </div>
    `));

    // Мини-карточки
    if (curMonth || prevMonth) {
      const row = el(`<div style="display:flex;gap:10px;margin:0 16px 16px;"></div>`);
      const mini = (label, m) => !m
        ? el(`<div style="flex:1;padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:12px;opacity:.4;">
              <div style="font-size:10px;color:var(--muted);">${escHtml(label)}</div>
              <div style="font-size:15px;font-weight:700;margin-top:4px;">—</div></div>`)
        : el(`<div style="flex:1;padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:12px;">
              <div style="font-size:10px;color:var(--muted);">${escHtml(label)}</div>
              <div style="font-size:15px;font-weight:700;color:var(--accent);margin-top:4px;">${escHtml(fmtMoney(m.total_amount))}</div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px;">${m.measurements} замеров · ${m.paid} оплачено</div></div>`);
      row.appendChild(mini("Текущий месяц", curMonth));
      row.appendChild(mini("Прошлый месяц", prevMonth));
      screen.appendChild(row);
    }

    if (!monthKeys.length) {
      screen.appendChild(el(`
        <div style="text-align:center;padding:40px 16px;color:var(--muted);">
          <div style="font-size:32px;margin-bottom:12px;">📐</div>
          <div style="font-size:14px;color:var(--ink);">Замеров за этот период нет</div>
          <div style="font-size:12px;margin-top:8px;">Данные появятся после выставления счёта за замер</div>
        </div>
      `));
      return;
    }

    // Таблица по месяцам
    screen.appendChild(el(`<div class="section-head"><span class="label">📅 По месяцам</span></div>`));
    const maxAmt = Math.max(...monthKeys.map(k => months[k].total_amount), 1);

    monthKeys.forEach(ym => {
      const m = months[ym];
      const pct = Math.round((m.total_amount / maxAmt) * 100);
      const isCur = ym === curYM;

      screen.appendChild(el(`
        <div style="margin:4px 16px;padding:12px 14px;background:var(--surface);
                    border:1px solid ${isCur ? "var(--accent)" : "var(--border)"};border-radius:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div>
              <span style="font-size:13px;font-weight:600;color:var(--ink);">${escHtml(fmtMonth(ym))}</span>
              ${isCur ? `<span style="font-size:10px;background:var(--accent);color:#fff;padding:1px 6px;border-radius:10px;margin-left:6px;">сейчас</span>` : ""}
            </div>
            <div style="text-align:right;">
              <div style="font-size:15px;font-weight:700;color:${m.total_amount > 0 ? "var(--accent)" : "var(--muted)"};">
                ${m.total_amount > 0 ? escHtml(fmtMoney(m.total_amount)) : "—"}
              </div>
              <div style="font-size:10px;color:var(--muted);">
                ${m.measurements} замеров · ${m.paid} со счётом
              </div>
            </div>
          </div>
          ${m.total_amount > 0 ? `
          <div style="height:3px;background:var(--border);border-radius:2px;">
            <div style="height:3px;background:var(--accent);border-radius:2px;width:${pct}%;"></div>
          </div>` : ""}
        </div>
      `));
    });

    screen.appendChild(el(`
      <div style="margin:12px 16px;padding:10px 14px;background:var(--surface-2,var(--surface));
                  border:1px solid var(--border);border-radius:10px;
                  font-size:12px;color:var(--muted);line-height:1.5;">
        💡 Сумма учитывается когда вы выставляете счёт за замер через кнопку «💳 Выставить счёт» в карточке клиента
      </div>
    `));
    screen.appendChild(el(`<div style="height:32px;"></div>`));
  }

  return { mount };
})();
