/* ============================================================
   AssemblerAnalytics — аналитика занятости сборщиков
   #/admin/assembler-analytics
   Данные: «Таблица занятости сборщиков.xlsx» → backend parser
   ============================================================ */

const AssemblerAnalytics = (function () {
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
    // "2026-05" → "Май 2026"
    try {
      const d = new Date(ym + "-01");
      return d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    } catch { return ym; }
  }

  async function _api(path, body = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000); // парсинг Excel — долгий
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
      if (e.name === "AbortError") throw new Error("Таймаут — файл большой, попробуй ещё раз");
      throw e;
    } finally { clearTimeout(t); }
  }

  /* ── Главный экран ─────────────────────────────────────────── */
  async function mount(container) {
    container.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    document.getElementById("bottom-nav")?.remove();

    const h = el(`
      <header class="podbor-header">
        <button class="podbor-back" aria-label="Назад">${(window.ICONS || {}).arrow_left || "‹"}</button>
        <div class="podbor-title">Аналитика сборщиков</div>
        <button id="reloadBtn" style="background:none;border:none;font-size:18px;cursor:pointer;padding:4px 8px;" title="Обновить">↻</button>
      </header>
    `);
    h.querySelector(".podbor-back").addEventListener("click", () => {
      haptic && haptic("impact");
      history.back();
    });

    const screen = el(`<div class="podbor-screen"></div>`);
    container.appendChild(h);
    container.appendChild(screen);

    const yearEl = el(`
      <div style="padding:0 16px 8px;display:flex;align-items:center;gap:10px;">
        <label style="font-size:12px;color:var(--muted);">Год:</label>
        <select id="yearSelect" style="padding:5px 10px;border:1px solid var(--border);border-radius:8px;
                  background:var(--surface);color:var(--ink);font-size:13px;">
          <option value="">Все</option>
          <option value="2026" selected>2026</option>
          <option value="2025">2025</option>
          <option value="2024">2024</option>
        </select>
      </div>
    `);
    container.insertBefore(yearEl, screen);

    const load = async (year) => {
      screen.innerHTML = `<div class="loader-inline"><div class="spinner"></div><div style="margin-top:8px;font-size:12px;color:var(--muted);">Парсим Excel… может занять 10–20 сек</div></div>`;
      try {
        const data = await _api("assembler_analytics", { year });
        if (data.error) {
          screen.innerHTML = `<div class="error" style="margin:16px;">${escHtml(data.error)}</div>`;
          return;
        }
        _render(screen, data, year);
      } catch (e) {
        screen.innerHTML = `<div class="error" style="margin:16px;">Ошибка: ${escHtml(e.message)}</div>`;
      }
    };

    yearEl.querySelector("#yearSelect").addEventListener("change", function () {
      load(this.value);
    });
    h.querySelector("#reloadBtn").addEventListener("click", () => {
      haptic && haptic("impact");
      load(yearEl.querySelector("#yearSelect").value);
    });

    load("2026");
  }

  /* ── Рендер данных ─────────────────────────────────────────── */
  function _render(screen, data, year) {
    screen.innerHTML = "";

    const parsedAt = data.parsed_at ? new Date(data.parsed_at).toLocaleString("ru-RU") : "—";
    screen.appendChild(el(`
      <div style="margin:0 16px 12px;font-size:11px;color:var(--muted);">
        Обновлено: ${escHtml(parsedAt)} · Записей: ${escHtml(String(data.total_records || 0))}
      </div>
    `));

    // === Итоги по месяцам ===
    const byMonth = data.by_month || {};
    const months = Object.keys(byMonth).sort();
    if (months.length) {
      screen.appendChild(el(`<div class="section-head"><span class="label">📅 По месяцам</span></div>`));
      const monthWrap = el(`<div style="overflow-x:auto;padding:0 16px 8px;"></div>`);
      const table = el(`
        <table style="border-collapse:collapse;width:100%;min-width:400px;font-size:12px;">
          <thead>
            <tr style="border-bottom:2px solid var(--border);">
              <th style="text-align:left;padding:6px 8px;color:var(--muted);font-weight:600;">Месяц</th>
              <th style="text-align:right;padding:6px 8px;color:var(--muted);font-weight:600;">Заказов</th>
              <th style="text-align:right;padding:6px 8px;color:var(--muted);font-weight:600;">Сумма сборок</th>
              <th style="text-align:right;padding:6px 8px;color:var(--muted);font-weight:600;">Сборщиков</th>
            </tr>
          </thead>
          <tbody id="monthTbody"></tbody>
        </table>
      `);
      const tbody = table.querySelector("#monthTbody");
      let grandTotal = 0, grandOrders = 0;
      for (const ym of months.reverse()) {
        const m = byMonth[ym];
        grandTotal += m.total_amount || 0;
        grandOrders += m.order_count || 0;
        const tr = el(`
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:7px 8px;font-weight:500;">${escHtml(fmtMonth(ym))}</td>
            <td style="padding:7px 8px;text-align:right;">${escHtml(String(m.order_count || 0))}</td>
            <td style="padding:7px 8px;text-align:right;font-weight:600;color:var(--accent);">${escHtml(fmtMoney(m.total_amount))}</td>
            <td style="padding:7px 8px;text-align:right;color:var(--muted);">${escHtml(String((m.assemblers || []).length))}</td>
          </tr>
        `);
        tbody.appendChild(tr);
      }
      // Итого строка
      tbody.appendChild(el(`
        <tr style="border-top:2px solid var(--border);background:var(--surface);">
          <td style="padding:7px 8px;font-weight:700;">ИТОГО</td>
          <td style="padding:7px 8px;text-align:right;font-weight:700;">${grandOrders}</td>
          <td style="padding:7px 8px;text-align:right;font-weight:700;color:var(--accent);">${escHtml(fmtMoney(grandTotal))}</td>
          <td style="padding:7px 8px;"></td>
        </tr>
      `));
      monthWrap.appendChild(table);
      screen.appendChild(monthWrap);
    }

    // === Рейтинг сборщиков ===
    const assemblers = (data.assemblers || []);
    if (assemblers.length) {
      screen.appendChild(el(`
        <div class="section-head" style="margin-top:20px;">
          <span class="label">👷 Сборщики · ${assemblers.length}</span>
        </div>
      `));

      const maxAmt = Math.max(...assemblers.map(a => a.total_amount)) || 1;

      assemblers.forEach((a, idx) => {
        const barPct = Math.round((a.total_amount / maxAmt) * 100);
        const avgPerOrder = a.total_orders ? Math.round(a.total_amount / a.total_orders) : 0;
        // Раскладка по месяцам: последние 6
        const monthKeys = Object.keys(a.months || {}).sort().slice(-6);
        const monthCells = monthKeys.map(ym => {
          const mm = a.months[ym];
          return `<div style="flex:1;text-align:center;">
            <div style="font-size:9px;color:var(--muted);">${ym.slice(5)}</div>
            <div style="font-size:11px;font-weight:600;">${Math.round((mm.total_amount||0)/1000)}к</div>
            <div style="font-size:9px;color:var(--muted);">${mm.orders} зак.</div>
          </div>`;
        }).join("");

        const card = el(`
          <div style="margin:6px 16px;padding:12px 14px;background:var(--surface);
                      border:1px solid var(--border);border-radius:12px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;">
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--ink);">${idx + 1}. ${escHtml(a.name)}</div>
                <div style="font-size:11px;color:var(--muted);margin-top:1px;">
                  ${a.total_orders} заказов · ср. ${escHtml(fmtMoney(avgPerOrder))} / заказ
                </div>
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:16px;font-weight:700;color:var(--accent);">${escHtml(fmtMoney(a.total_amount))}</div>
              </div>
            </div>
            <!-- Прогресс-бар -->
            <div style="height:4px;background:var(--border);border-radius:2px;margin-bottom:8px;">
              <div style="height:4px;background:var(--accent);border-radius:2px;width:${barPct}%;"></div>
            </div>
            <!-- Месяцы -->
            ${monthCells ? `<div style="display:flex;gap:4px;margin-top:4px;">${monthCells}</div>` : ""}
          </div>
        `);
        screen.appendChild(card);
      });
    }

    if (!months.length && !assemblers.length) {
      screen.innerHTML = `
        <div style="text-align:center;padding:40px 16px;color:var(--muted);">
          Нет данных за выбранный период.<br>
          <span style="font-size:12px;">Попробуй выбрать другой год.</span>
        </div>
      `;
    }

    screen.appendChild(el(`<div style="height:32px;"></div>`));
  }

  return { mount };
})();
