/* ============================================================
   Финансовая сводка менеджера — #/admin/finance
   ============================================================ */

const FinanceSummary = (function () {

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmt(n) {
    if (n == null || n === "") return "—";
    return Number(n).toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " ₽";
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
    } catch { return iso.slice(0, 10); }
  }

  async function _api(path, body = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(`${BACKEND_URL}/api/${path}`, {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: tg?.initData || "",
          initDataUnsafe: tg?.initDataUnsafe || null,
          ...body,
        }),
      });
      if (!res.ok) throw new Error(`Ошибка сервера (${res.status})`);
      return await res.json();
    } catch (e) {
      if (e.name === "AbortError") throw new Error("Сервер не отвечает");
      throw e;
    } finally { clearTimeout(t); }
  }

  let _currentPeriod = "current_month";

  function mount(container) {
    container.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    const oldNav = document.getElementById("bottom-nav");
    if (oldNav) oldNav.remove();

    const h = document.createElement("header");
    h.className = "podbor-header";
    h.innerHTML = `
      <button class="podbor-back">${(window.ICONS || {}).arrow_left || "‹"}</button>
      <div class="podbor-title">Финансы</div>
      <div style="width:36px"></div>
    `;
    h.querySelector(".podbor-back").addEventListener("click", () => {
      haptic && haptic("impact");
      history.back();
    });
    container.appendChild(h);

    // Period switcher
    const periodWrap = document.createElement("div");
    periodWrap.style.cssText = "padding:12px 16px;border-bottom:1px solid var(--border);";
    periodWrap.innerHTML = `
      <div style="display:flex;gap:6px;">
        <button class="fs-period-btn${_currentPeriod === "current_month" ? " active" : ""}"
                data-p="current_month"
                style="flex:1;padding:8px 4px;font-size:12px;font-weight:600;
                       border-radius:8px;border:1px solid var(--border);
                       background:${_currentPeriod === "current_month" ? "var(--accent)" : "var(--surface)"};
                       color:${_currentPeriod === "current_month" ? "#fff" : "var(--ink)"};
                       cursor:pointer;">
          Этот месяц
        </button>
        <button class="fs-period-btn${_currentPeriod === "prev_month" ? " active" : ""}"
                data-p="prev_month"
                style="flex:1;padding:8px 4px;font-size:12px;font-weight:600;
                       border-radius:8px;border:1px solid var(--border);
                       background:${_currentPeriod === "prev_month" ? "var(--accent)" : "var(--surface)"};
                       color:${_currentPeriod === "prev_month" ? "#fff" : "var(--ink)"};
                       cursor:pointer;">
          Пред. месяц
        </button>
        <button class="fs-period-btn${_currentPeriod === "quarter" ? " active" : ""}"
                data-p="quarter"
                style="flex:1;padding:8px 4px;font-size:12px;font-weight:600;
                       border-radius:8px;border:1px solid var(--border);
                       background:${_currentPeriod === "quarter" ? "var(--accent)" : "var(--surface)"};
                       color:${_currentPeriod === "quarter" ? "#fff" : "var(--ink)"};
                       cursor:pointer;">
          3 месяца
        </button>
      </div>
    `;
    container.appendChild(periodWrap);

    const screen = document.createElement("div");
    screen.className = "podbor-screen";
    screen.style.cssText = "padding:0 0 48px;";
    container.appendChild(screen);

    periodWrap.querySelectorAll(".fs-period-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        haptic && haptic("impact");
        _currentPeriod = btn.dataset.p;
        periodWrap.querySelectorAll(".fs-period-btn").forEach(b => {
          const active = b.dataset.p === _currentPeriod;
          b.style.background = active ? "var(--accent)" : "var(--surface)";
          b.style.color      = active ? "#fff" : "var(--ink)";
        });
        _load(screen, _currentPeriod);
      });
    });

    _load(screen, _currentPeriod);
  }

  function _load(screen, period) {
    screen.innerHTML = `<div class="loader-inline"><div class="spinner"></div></div>`;
    _api("manager_finance_summary", { period }).then(data => {
      if (data.error) {
        screen.innerHTML = `<div class="error" style="margin:16px;">${escHtml(data.error)}</div>`;
        return;
      }
      _render(screen, data);
    }).catch(e => {
      screen.innerHTML = `<div class="error" style="margin:16px;">Ошибка: ${escHtml(e.message)}</div>`;
    });
  }

  function _kpiCard(icon, label, value, sub, valueColor) {
    return `
      <div style="padding:12px;background:var(--surface);border:1px solid var(--border);
                  border-radius:12px;">
        <div style="font-size:20px;margin-bottom:4px;">${icon}</div>
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;
                    letter-spacing:.05em;font-weight:600;">${escHtml(label)}</div>
        <div style="font-size:20px;font-weight:700;
                    color:${valueColor || "var(--ink)"};margin-top:2px;line-height:1.1;">
          ${escHtml(value)}
        </div>
        ${sub ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;">${escHtml(sub)}</div>` : ""}
      </div>
    `;
  }

  function _render(screen, data) {
    screen.innerHTML = "";

    // Period label
    const titleEl = document.createElement("div");
    titleEl.style.cssText = "padding:12px 16px 0;";
    titleEl.innerHTML = `
      <div style="font-size:13px;font-weight:700;color:var(--muted);
                  text-transform:uppercase;letter-spacing:.06em;">
        ${escHtml(data.period_label)}
      </div>
    `;
    screen.appendChild(titleEl);

    // KPI grid — 2 колонки
    const kpiGrid = document.createElement("div");
    kpiGrid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px 16px;";

    const noRevMsg = data.revenue_client === 0 ? "нет цен кухни" : null;

    kpiGrid.innerHTML = [
      _kpiCard("📐", "Замеры", `${data.meas_done} / ${data.meas_total}`,
        data.meas_total ? `${data.meas_done} выполнено` : "нет замеров"),
      _kpiCard("🔨", "Сборки", `${data.asm_done} / ${data.asm_total}`,
        data.asm_active > 0 ? `${data.asm_active} в работе` : ""),
      _kpiCard("💰", "Выручка", data.revenue_client ? fmt(data.revenue_client) : "—",
        noRevMsg || (data.asm_done > 0 ? `${data.asm_done} сдано` : "нет завершённых"),
        data.revenue_client > 0 ? "var(--accent)" : undefined),
      _kpiCard("👷", "Выплаты мастерам", data.payout_assembler ? fmt(data.payout_assembler) : "—",
        data.payout_assembler > 0 ? `от ${fmt(data.revenue_client)}` : noRevMsg),
      _kpiCard("📊", "Маржа", data.margin ? fmt(data.margin) : "—",
        data.revenue_client > 0
          ? `${Math.round(data.margin / data.revenue_client * 100)}% от выручки`
          : noRevMsg,
        data.margin > 0 ? "#27AE60" : data.margin < 0 ? "#C0392B" : undefined),
      _kpiCard("🧾", "Доп работы", data.extras_total ? fmt(data.extras_total) : "—",
        data.extras_count > 0 ? `${data.extras_count} позиций одобрено` : "нет доп работ"),
    ].join("");

    screen.appendChild(kpiGrid);

    // Детали сборок с финансами
    const asmList = data.asm_list || [];
    if (asmList.length) {
      const headEl = document.createElement("div");
      headEl.className = "section-head";
      headEl.style.cssText = "margin-top:8px;";
      headEl.innerHTML = `<span class="label">Сборки с финансами <span class="count">· ${asmList.length}</span></span>`;
      screen.appendChild(headEl);

      for (const asm of asmList) {
        const card = document.createElement("div");
        card.style.cssText = "margin:0 16px 8px;padding:10px 12px;background:var(--surface);" +
          "border:1px solid var(--border);border-radius:12px;cursor:pointer;";
        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:700;color:var(--ink);
                          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${escHtml(asm.client_name || "Клиент")}
              </div>
              <div style="font-size:11px;color:var(--muted);margin-top:1px;">
                ${escHtml(fmtDate(asm.completed_at))}
                ${asm.address ? " · " + escHtml(asm.address.slice(0, 35)) + (asm.address.length > 35 ? "…" : "") : ""}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:13px;font-weight:700;color:var(--accent);">${fmt(asm.client_pay)}</div>
              <div style="font-size:11px;color:var(--muted);">мастеру ${fmt(asm.asm_pay)}</div>
            </div>
          </div>
          <div style="margin-top:6px;display:flex;gap:12px;">
            <span style="font-size:11px;color:var(--muted);">
              Кухня: <strong style="color:var(--ink);">${fmt(asm.kitchen_price)}</strong>
            </span>
            <span style="font-size:11px;color:#27AE60;font-weight:600;">
              Маржа: ${fmt(asm.margin)}
            </span>
          </div>
        `;
        card.addEventListener("click", () => {
          haptic && haptic("impact");
          location.hash = `#/c/assembly/${encodeURIComponent(asm.id)}`;
        });
        screen.appendChild(card);
      }
    } else if (data.asm_done === 0) {
      const emptyEl = document.createElement("div");
      emptyEl.style.cssText = "margin:16px;text-align:center;color:var(--muted);font-size:13px;";
      emptyEl.textContent = "Завершённых сборок с ценой кухни за этот период нет";
      screen.appendChild(emptyEl);
    }

    // Итоговая строка (если есть данные)
    if (data.revenue_client > 0) {
      const totalEl = document.createElement("div");
      totalEl.style.cssText = "margin:8px 16px 0;padding:12px;background:var(--surface);" +
        "border:2px solid var(--accent);border-radius:12px;";
      totalEl.innerHTML = `
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;
                    letter-spacing:.05em;font-weight:600;margin-bottom:6px;">Итого за период</div>
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-size:11px;color:var(--muted);">Выручка</div>
            <div style="font-size:17px;font-weight:700;color:var(--accent);">
              ${fmt(data.revenue_client)}
            </div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--muted);">Мастерам</div>
            <div style="font-size:17px;font-weight:700;color:var(--ink);">
              ${fmt(data.payout_assembler)}
            </div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--muted);">Маржа</div>
            <div style="font-size:17px;font-weight:700;color:#27AE60;">
              ${fmt(data.margin)}
            </div>
          </div>
          ${data.extras_total > 0 ? `
          <div>
            <div style="font-size:11px;color:var(--muted);">Доп работы</div>
            <div style="font-size:17px;font-weight:700;color:var(--ink);">
              ${fmt(data.extras_total)}
            </div>
          </div>` : ""}
        </div>
      `;
      screen.appendChild(totalEl);
    }
  }

  return { mount };
})();
