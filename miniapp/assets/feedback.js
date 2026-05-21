/* ============================================================
   Система оценок — виджет + экран #/feedback/my
   Используется в: assembly_detail.js, app.js (замерщик, менеджер)
   ============================================================ */

const FeedbackModule = (function () {

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (e.name === "AbortError") throw new Error("Сервер не отвечает");
      throw e;
    } finally { clearTimeout(t); }
  }

  // ── Отрисовка звёздочек (только чтение) ────────────────────────
  function starsHtml(avg, size) {
    if (avg == null) return "";
    const sz = size || 14;
    const full  = Math.floor(avg);
    const half  = (avg - full) >= 0.4 ? 1 : 0;
    const empty = 5 - full - half;
    return (
      "★".repeat(full) +
      (half ? "½" : "") +
      "☆".repeat(empty)
    ).split("").map((c, i) => {
      const col = i < full ? "#F39C12" : (c === "½" ? "#F39C12" : "#ddd");
      return `<span style="color:${col};font-size:${sz}px;">${c === "½" ? "★" : c}</span>`;
    }).join("");
  }

  // ── Интерактивный виджет звёзд ─────────────────────────────────
  // Возвращает {el, getValue()}
  function createStarWidget(label, sublabel) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "margin-bottom:14px;";
    wrap.innerHTML = `
      <div style="font-size:13px;font-weight:600;color:var(--ink);margin-bottom:2px;">
        ${escHtml(label)}
      </div>
      ${sublabel ? `<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">${escHtml(sublabel)}</div>` : ""}
      <div class="fb-stars" style="display:flex;gap:4px;" data-value="0">
        ${[1,2,3,4,5].map(i => `
          <button type="button" data-v="${i}"
                  style="font-size:28px;line-height:1;background:none;border:none;
                         cursor:pointer;padding:2px;color:#ddd;">★</button>
        `).join("")}
      </div>
    `;
    const row = wrap.querySelector(".fb-stars");
    const btns = [...row.querySelectorAll("button")];
    let selected = 0;

    function paint(n) {
      btns.forEach((b, i) => {
        b.style.color = i < n ? "#F39C12" : "#ddd";
      });
    }
    btns.forEach((btn, idx) => {
      btn.addEventListener("mouseenter", () => paint(idx + 1));
      btn.addEventListener("mouseleave", () => paint(selected));
      btn.addEventListener("click", () => {
        selected = idx + 1;
        row.dataset.value = selected;
        haptic && haptic("impact");
        paint(selected);
      });
    });

    return {
      el: wrap,
      getValue: () => selected,
      isValid: () => selected >= 1,
    };
  }

  // ── Форма оценки после сборки (для клиента) ────────────────────
  // container — DOM-элемент куда рендерить
  // config = { assemblerName, assemblerTgId, managerName, managerTgId,
  //            assemblyId, onSubmit() }
  function mountAssemblyFeedback(container, cfg) {
    container.innerHTML = "";
    container.style.cssText = "margin:12px 16px 0;padding:14px;background:var(--surface);" +
      "border:2px solid var(--accent);border-radius:14px;";

    const title = document.createElement("div");
    title.style.cssText = "font-size:14px;font-weight:700;color:var(--ink);margin-bottom:2px;";
    title.textContent = "⭐ Оцените нашу работу";
    const sub = document.createElement("div");
    sub.style.cssText = "font-size:12px;color:var(--muted);margin-bottom:12px;";
    sub.textContent = "Займёт 10 секунд — помогает нам становиться лучше";
    container.appendChild(title);
    container.appendChild(sub);

    const wAsm = cfg.assemblerName
      ? createStarWidget(`👷 ${cfg.assemblerName}`, "Качество сборки")
      : null;
    const wMgr = cfg.managerName
      ? createStarWidget(`🗂 ${cfg.managerName}`, "Работа менеджера")
      : null;
    const wSvc = createStarWidget("🏠 Сервис в целом", "Насколько довольны компанией?");

    if (wAsm) container.appendChild(wAsm.el);
    if (wMgr) container.appendChild(wMgr.el);
    container.appendChild(wSvc.el);

    // Комментарий
    const cmtWrap = document.createElement("div");
    cmtWrap.style.cssText = "margin-bottom:10px;";
    cmtWrap.innerHTML = `
      <textarea id="fb-comment" rows="2"
                placeholder="Комментарий (необязательно)…"
                style="width:100%;padding:9px;border:1px solid var(--border);
                       border-radius:8px;background:var(--surface);color:var(--ink);
                       font-size:13px;resize:none;box-sizing:border-box;"></textarea>
    `;
    container.appendChild(cmtWrap);

    const sendBtn = document.createElement("button");
    sendBtn.className = "btn-primary";
    sendBtn.style.cssText = "width:100%;font-size:14px;padding:11px;";
    sendBtn.textContent = "Отправить оценку";
    const statusEl = document.createElement("div");
    statusEl.style.cssText = "font-size:12px;color:var(--muted);min-height:16px;margin-top:6px;";
    container.appendChild(sendBtn);
    container.appendChild(statusEl);

    sendBtn.addEventListener("click", async () => {
      // Нужна хотя бы одна оценка
      const hasAny = (wAsm && wAsm.isValid()) || (wMgr && wMgr.isValid()) || wSvc.isValid();
      if (!hasAny) { statusEl.textContent = "Поставьте хотя бы одну звезду"; return; }

      haptic && haptic("impact");
      sendBtn.disabled = true; sendBtn.textContent = "Отправляем…";
      const comment = container.querySelector("#fb-comment")?.value.trim() || "";

      const ratings = [];
      if (wAsm && wAsm.isValid()) {
        ratings.push({ target_tg_id: cfg.assemblerTgId, target_role: "assembler",
                       stars: wAsm.getValue() });
      }
      if (wMgr && wMgr.isValid()) {
        ratings.push({ target_tg_id: cfg.managerTgId, target_role: "manager",
                       stars: wMgr.getValue() });
      }
      if (wSvc.isValid()) {
        ratings.push({ target_role: "service", stars: wSvc.getValue(), comment });
      }

      try {
        const res = await _api("feedback_submit", {
          ref_id: cfg.assemblyId,
          ref_type: "assembly",
          ratings,
        });
        if (res.ok) {
          haptic && haptic("success");
          container.innerHTML = `
            <div style="text-align:center;padding:12px;">
              <div style="font-size:28px;margin-bottom:8px;">🙏</div>
              <div style="font-size:15px;font-weight:700;color:var(--ink);">Спасибо за оценку!</div>
              <div style="font-size:13px;color:var(--muted);margin-top:4px;">
                Ваш отзыв помогает нам работать лучше
              </div>
            </div>`;
          if (cfg.onSubmit) cfg.onSubmit();
        } else {
          statusEl.textContent = res.msg || res.error || "Ошибка";
          sendBtn.disabled = false; sendBtn.textContent = "Отправить оценку";
        }
      } catch (e) {
        statusEl.textContent = e.message;
        sendBtn.disabled = false; sendBtn.textContent = "Отправить оценку";
      }
    });
  }

  // ── Форма оценки замерщиком → менеджера (после завершения замера) ──
  // container — куда рендерить
  // cfg = { managerName, managerTgId, measurementId, onSubmit() }
  function mountMeasurerFeedback(container, cfg) {
    container.innerHTML = "";
    container.style.cssText = "margin:12px 0 0;padding:12px;background:var(--surface);" +
      "border:1px solid var(--border);border-radius:12px;";

    const title = document.createElement("div");
    title.style.cssText = "font-size:13px;font-weight:700;color:var(--ink);margin-bottom:8px;";
    title.textContent = "💬 Оценка заявки от менеджера";
    container.appendChild(title);

    const w = createStarWidget(
      `🗂 ${cfg.managerName || "Менеджер"}`,
      "Насколько полно была подготовлена заявка?"
    );
    container.appendChild(w.el);

    const sendBtn = document.createElement("button");
    sendBtn.className = "btn-secondary";
    sendBtn.style.cssText = "width:100%;font-size:13px;padding:9px;";
    sendBtn.textContent = "Оценить";
    const statusEl = document.createElement("div");
    statusEl.style.cssText = "font-size:11px;color:var(--muted);min-height:14px;margin-top:4px;";
    container.appendChild(sendBtn);
    container.appendChild(statusEl);

    sendBtn.addEventListener("click", async () => {
      if (!w.isValid()) { statusEl.textContent = "Поставьте оценку"; return; }
      haptic && haptic("impact");
      sendBtn.disabled = true; sendBtn.textContent = "…";
      try {
        const res = await _api("feedback_submit", {
          ref_id:   cfg.measurementId,
          ref_type: "measurement",
          ratings:  [{ target_tg_id: cfg.managerTgId, target_role: "manager", stars: w.getValue() }],
        });
        if (res.ok) {
          container.innerHTML = `<div style="font-size:12px;color:#27AE60;padding:4px 0;">✅ Оценка отправлена</div>`;
          if (cfg.onSubmit) cfg.onSubmit();
        } else {
          statusEl.textContent = res.error || "Ошибка";
          sendBtn.disabled = false; sendBtn.textContent = "Оценить";
        }
      } catch (e) {
        statusEl.textContent = e.message;
        sendBtn.disabled = false; sendBtn.textContent = "Оценить";
      }
    });
  }

  // ── Форма оценки менеджером → замерщика ────────────────────────
  // cfg = { measurerName, measurerTgId, measurementId, onSubmit() }
  function mountManagerFeedback(container, cfg) {
    container.innerHTML = "";
    container.style.cssText = "margin:8px 0 0;padding:12px;background:var(--surface);" +
      "border:1px solid var(--border);border-radius:12px;";

    const w = createStarWidget(
      `📐 ${cfg.measurerName || "Замерщик"}`,
      "Качество замера и документации"
    );
    container.appendChild(w.el);

    const sendBtn = document.createElement("button");
    sendBtn.className = "btn-secondary";
    sendBtn.style.cssText = "width:100%;font-size:13px;padding:9px;";
    sendBtn.textContent = "Оценить замерщика";
    const statusEl = document.createElement("div");
    statusEl.style.cssText = "font-size:11px;color:var(--muted);min-height:14px;margin-top:4px;";
    container.appendChild(sendBtn);
    container.appendChild(statusEl);

    sendBtn.addEventListener("click", async () => {
      if (!w.isValid()) { statusEl.textContent = "Поставьте оценку"; return; }
      haptic && haptic("impact");
      sendBtn.disabled = true; sendBtn.textContent = "…";
      try {
        const res = await _api("feedback_submit", {
          ref_id:   cfg.measurementId,
          ref_type: "measurement",
          ratings:  [{ target_tg_id: cfg.measurerTgId, target_role: "measurer", stars: w.getValue() }],
        });
        if (res.ok) {
          container.innerHTML = `<div style="font-size:12px;color:#27AE60;padding:4px 0;">✅ Оценка отправлена</div>`;
          if (cfg.onSubmit) cfg.onSubmit();
        } else {
          statusEl.textContent = res.error || "Ошибка";
          sendBtn.disabled = false; sendBtn.textContent = "Оценить замерщика";
        }
      } catch (e) {
        statusEl.textContent = e.message;
        sendBtn.disabled = false; sendBtn.textContent = "Оценить замерщика";
      }
    });
  }

  // ── Экран «Мои оценки» — #/feedback/my ─────────────────────────
  function mountMyScreen(container) {
    container.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    const oldNav = document.getElementById("bottom-nav");
    if (oldNav) oldNav.remove();

    const h = document.createElement("header");
    h.className = "podbor-header";
    h.innerHTML = `
      <button class="podbor-back">${(window.ICONS || {}).arrow_left || "‹"}</button>
      <div class="podbor-title">Мои оценки</div>
      <div style="width:36px"></div>
    `;
    h.querySelector(".podbor-back").addEventListener("click", () => {
      haptic && haptic("impact"); history.back();
    });
    container.appendChild(h);

    const screen = document.createElement("div");
    screen.className = "podbor-screen";
    screen.style.cssText = "padding:0 0 48px;";
    screen.innerHTML = `<div class="loader-inline"><div class="spinner"></div></div>`;
    container.appendChild(screen);

    _api("feedback_my").then(data => {
      if (data.error) {
        screen.innerHTML = `<div class="error" style="margin:16px;">${escHtml(data.error)}</div>`;
        return;
      }
      screen.innerHTML = "";

      if (!data.total) {
        screen.innerHTML = `
          <div style="margin:48px 16px;text-align:center;color:var(--muted);font-size:14px;">
            Оценок пока нет.<br>Они появятся после завершения работ.
          </div>`;
        return;
      }

      // Общий балл (среднее по всем ролям)
      const allVals = (data.aggregated || []).map(a => a.avg);
      const overall = allVals.length
        ? (allVals.reduce((s, v) => s + v, 0) / allVals.length).toFixed(1)
        : null;

      const heroEl = document.createElement("div");
      heroEl.style.cssText = "padding:20px 16px;text-align:center;border-bottom:1px solid var(--border);";
      heroEl.innerHTML = `
        <div style="font-size:48px;line-height:1;">${overall || "—"}</div>
        <div style="margin:6px 0 2px;">${starsHtml(parseFloat(overall), 18)}</div>
        <div style="font-size:12px;color:var(--muted);">${data.total} оценок</div>
      `;
      screen.appendChild(heroEl);

      // По ролям
      for (const agg of (data.aggregated || [])) {
        const rowEl = document.createElement("div");
        rowEl.style.cssText = "padding:12px 16px;border-bottom:1px solid var(--border);" +
          "display:flex;justify-content:space-between;align-items:center;";
        rowEl.innerHTML = `
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--ink);">${escHtml(agg.label)}</div>
            <div style="font-size:11px;color:var(--muted);">${agg.count} оценок</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:20px;font-weight:700;color:var(--accent);">${agg.avg}</div>
            <div style="font-size:13px;">${starsHtml(agg.avg, 13)}</div>
          </div>
        `;
        screen.appendChild(rowEl);
      }

      // Комментарии
      if (data.comments && data.comments.length) {
        const cmtHead = document.createElement("div");
        cmtHead.className = "section-head";
        cmtHead.style.marginTop = "16px";
        cmtHead.innerHTML = `<span class="label">Комментарии</span>`;
        screen.appendChild(cmtHead);

        for (const c of data.comments) {
          const cEl = document.createElement("div");
          cEl.style.cssText = "margin:0 16px 8px;padding:10px 12px;background:var(--surface);" +
            "border:1px solid var(--border);border-radius:10px;";
          cEl.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="font-size:12px;color:var(--muted);">${escHtml(c.role || "Клиент")}</span>
              <span style="font-size:13px;">${"★".repeat(parseInt(c.stars)||0)}</span>
            </div>
            <div style="font-size:13px;color:var(--ink);">${escHtml(c.comment)}</div>
          `;
          screen.appendChild(cEl);
        }
      }
    }).catch(e => {
      screen.innerHTML = `<div class="error" style="margin:16px;">Ошибка: ${escHtml(e.message)}</div>`;
    });
  }

  return {
    starsHtml,
    createStarWidget,
    mountAssemblyFeedback,
    mountMeasurerFeedback,
    mountManagerFeedback,
    mountMyScreen,
  };
})();
