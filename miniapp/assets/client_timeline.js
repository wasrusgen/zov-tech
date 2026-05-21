/* ============================================================
   Таймлайн заказа клиента — #/c/assembly/:id/timeline
   Доступен клиенту, менеджеру, назначенному сборщику.
   ============================================================ */

const ClientTimeline = (function () {

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtDate(iso) {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString("ru-RU", {
        day: "numeric", month: "long",
        hour: "2-digit", minute: "2-digit",
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

  const STATUS_COLORS = {
    created:     "#8e8e8e",
    scheduled:   "#2980B9",
    in_progress: "#F39C12",
    done:        "#27AE60",
    cancelled:   "#C0392B",
  };
  const STATUS_LABELS = {
    created:     "Создана",
    scheduled:   "Запланирована",
    in_progress: "В процессе",
    done:        "Завершена",
    cancelled:   "Отменена",
  };

  function mount(container, assemblyId) {
    container.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    const oldNav = document.getElementById("bottom-nav");
    if (oldNav) oldNav.remove();

    const h = document.createElement("header");
    h.className = "podbor-header";
    h.innerHTML = `
      <button class="podbor-back">${(window.ICONS || {}).arrow_left || "‹"}</button>
      <div class="podbor-title">Мой заказ</div>
      <div style="width:36px"></div>
    `;
    h.querySelector(".podbor-back").addEventListener("click", () => {
      haptic && haptic("impact");
      history.back();
    });
    container.appendChild(h);

    const screen = document.createElement("div");
    screen.className = "podbor-screen";
    screen.style.cssText = "padding:0 0 48px;";
    screen.innerHTML = `<div class="loader-inline"><div class="spinner"></div></div>`;
    container.appendChild(screen);

    _api("client_order_timeline", { assembly_id: assemblyId })
      .then(data => {
        if (data.error) {
          screen.innerHTML = `<div class="error" style="margin:16px;">${escHtml(data.error)}</div>`;
          return;
        }

        screen.innerHTML = "";

        // Шапка — название + статус
        const statusColor = STATUS_COLORS[data.status] || "#8e8e8e";
        const statusText  = STATUS_LABELS[data.status]  || data.status;
        const titleEl = document.createElement("div");
        titleEl.style.cssText = "padding:16px 16px 12px;border-bottom:1px solid var(--border);";
        titleEl.innerHTML = `
          <div style="font-size:17px;font-weight:700;color:var(--ink);line-height:1.2;">
            ${escHtml(data.client_name || "Заказ")}
          </div>
          ${data.address ? `
            <div style="font-size:13px;color:var(--muted);margin-top:4px;">
              📍 ${escHtml(data.address)}
            </div>` : ""}
          <div style="display:inline-block;margin-top:8px;
                      font-size:12px;font-weight:600;padding:3px 10px;
                      border-radius:10px;background:${statusColor}20;color:${statusColor};">
            ${escHtml(statusText)}
          </div>
        `;
        screen.appendChild(titleEl);

        // Подсказка прогресса
        const milestones = data.milestones || [];
        const doneCount = milestones.filter(m => m.done).length;
        const total = milestones.length;
        const pct = total ? Math.round((doneCount / total) * 100) : 0;

        const progressEl = document.createElement("div");
        progressEl.style.cssText = "padding:12px 16px;border-bottom:1px solid var(--border);";
        progressEl.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;
                      margin-bottom:6px;">
            <span style="font-size:12px;color:var(--muted);">Выполнено этапов</span>
            <span style="font-size:12px;font-weight:700;color:var(--ink);">
              ${doneCount} / ${total}
            </span>
          </div>
          <div style="height:4px;background:var(--border);border-radius:4px;overflow:hidden;">
            <div style="height:100%;border-radius:4px;
                        background:var(--accent);
                        width:${pct}%;transition:width .4s ease;"></div>
          </div>
        `;
        screen.appendChild(progressEl);

        // Таймлайн
        const tlWrap = document.createElement("div");
        tlWrap.style.cssText = "padding:16px;";

        milestones.forEach((ms, idx) => {
          const isLast = idx === milestones.length - 1;

          const row = document.createElement("div");
          row.style.cssText = "display:flex;gap:12px;";

          // Левая колонка: точка + линия
          const lineCol = document.createElement("div");
          lineCol.style.cssText = "display:flex;flex-direction:column;align-items:center;width:36px;flex-shrink:0;";

          const dot = document.createElement("div");
          dot.style.cssText = `
            width:36px;height:36px;border-radius:50%;flex-shrink:0;
            display:flex;align-items:center;justify-content:center;
            font-size:17px;
            background:${ms.done ? "var(--accent)" : "var(--surface)"};
            border:2px solid ${ms.done ? "var(--accent)" : "var(--border)"};
          `;
          dot.textContent = ms.done ? ms.icon : "○";

          const connLine = document.createElement("div");
          if (!isLast) {
            connLine.style.cssText = `
              flex:1;width:2px;min-height:20px;margin:4px 0;
              background:${ms.done ? "var(--accent)" : "var(--border)"};
              opacity:${ms.done ? "1" : "0.4"};
            `;
          }

          lineCol.appendChild(dot);
          lineCol.appendChild(connLine);

          // Правая колонка: контент
          const content = document.createElement("div");
          content.style.cssText = `
            padding:4px 0 ${isLast ? "0" : "20px"};
            flex:1;min-width:0;
          `;
          content.innerHTML = `
            <div style="font-size:14px;
                        font-weight:${ms.done ? "600" : "400"};
                        color:${ms.done ? "var(--ink)" : "var(--muted)"};
                        line-height:1.3;">
              ${escHtml(ms.title)}
            </div>
            ${ms.ts ? `
              <div style="font-size:12px;color:var(--muted);margin-top:2px;">
                ${escHtml(fmtDate(ms.ts) || "")}
              </div>` : (!ms.done ? `
              <div style="font-size:11px;color:var(--muted);margin-top:2px;
                          font-style:italic;">ожидается</div>` : "")}
            ${ms.detail ? `
              <div style="font-size:12px;color:var(--muted);margin-top:2px;">
                ${escHtml(ms.detail)}
              </div>` : ""}
          `;

          row.appendChild(lineCol);
          row.appendChild(content);
          tlWrap.appendChild(row);
        });

        screen.appendChild(tlWrap);

        // Кнопка «Назад к карточке сборки»
        const backBtn = document.createElement("div");
        backBtn.style.cssText = "margin:0 16px;";
        backBtn.innerHTML = `
          <button class="btn-secondary"
                  style="width:100%;font-size:13px;padding:11px;">
            ← Назад к карточке
          </button>
        `;
        backBtn.querySelector("button").addEventListener("click", () => {
          haptic && haptic("impact");
          history.back();
        });
        screen.appendChild(backBtn);
      })
      .catch(e => {
        screen.innerHTML = `<div class="error" style="margin:16px;">Ошибка: ${escHtml(e.message)}</div>`;
      });
  }

  return { mount };
})();
