/* ============================================================
   SignRequest — цифровая подпись акта сборки (ФЗ-63 ПЭП)
   Два метода: canvas (палец) и code (OTP через Telegram/SMS).
   Дополнительно: proxy (представитель) и absent (клиент отсутствовал).
   ============================================================ */

const SignRequest = (function () {
  "use strict";

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
          initData: Platform.initData,
          initDataUnsafe: Platform.initDataUnsafe,
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

  /* ── Canvas signature ─────────────────────────────────────── */

  function initCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    let drawing = false;
    let hasStrokes = false;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    resize();

    function pos(e) {
      const rect = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    }

    function start(e) {
      e.preventDefault();
      drawing = true;
      const { x, y } = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    function move(e) {
      e.preventDefault();
      if (!drawing) return;
      hasStrokes = true;
      const { x, y } = pos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    function end(e) {
      e.preventDefault();
      drawing = false;
    }

    canvas.addEventListener("mousedown",  start, { passive: false });
    canvas.addEventListener("mousemove",  move,  { passive: false });
    canvas.addEventListener("mouseup",    end,   { passive: false });
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove",  move,  { passive: false });
    canvas.addEventListener("touchend",   end,   { passive: false });

    return {
      clear() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasStrokes = false;
      },
      isEmpty() { return !hasStrokes; },
      toDataURL() { return canvas.toDataURL("image/png"); },
    };
  }

  /* ── Overlay builder ──────────────────────────────────────── */

  function open(assemblyId, opts = {}) {
    const clientName = opts.clientName || "";
    const clientTgId = opts.clientTgId || "";
    const onSuccess  = opts.onSuccess  || null;

    // Удалить предыдущий если есть
    document.getElementById("signreq-overlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "signreq-overlay";
    overlay.className = "signreq-overlay";

    overlay.innerHTML = `
      <div class="signreq-sheet">
        <div class="signreq-header">
          <div class="signreq-title">Подписание акта</div>
          <button class="signreq-close" aria-label="Закрыть">✕</button>
        </div>

        <!-- Режим: tabs -->
        <div class="signreq-tabs">
          <button class="signreq-tab active" data-tab="canvas">✍️ Пальцем</button>
          <button class="signreq-tab" data-tab="code">📱 Код</button>
          <button class="signreq-tab" data-tab="proxy">👤 Представитель</button>
          <button class="signreq-tab" data-tab="absent">🚫 Отсутствует</button>
        </div>

        <!-- Canvas -->
        <div class="signreq-panel" id="sr-panel-canvas">
          <div style="font-size:12px;color:var(--muted);margin-bottom:8px;text-align:center;">
            Клиент подписывает пальцем на экране
          </div>
          <div class="signreq-canvas-wrap">
            <canvas id="sr-canvas"></canvas>
            <div class="signreq-canvas-hint">Подпись здесь</div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn-secondary signreq-clear">Очистить</button>
          </div>
          <div class="signreq-name-row">
            <label class="field">
              <span class="field-label">ФИО подписанта</span>
              <input id="sr-canvas-name" type="text" placeholder="${escHtml(clientName || "Имя клиента")}" value="${escHtml(clientName)}">
            </label>
            <label class="field">
              <span class="field-label">Телефон (необяз.)</span>
              <input id="sr-canvas-phone" type="tel" placeholder="+7 ...">
            </label>
          </div>
          <div class="signreq-cta">
            <button class="btn-primary signreq-submit-canvas">Подписать</button>
          </div>
          <div class="signreq-err" id="sr-canvas-err"></div>
        </div>

        <!-- Code -->
        <div class="signreq-panel" id="sr-panel-code" style="display:none;">
          <div class="signreq-code-info">
            ${clientTgId
              ? `Код будет отправлен клиенту <b>${escHtml(clientName || "")}</b> в Telegram`
              : `<span style="color:var(--warn,#F39C12);">⚠️ Telegram клиента не привязан — продиктуйте код по телефону</span>`}
          </div>
          <div id="sr-code-send-block">
            <button class="btn-secondary signreq-send-code">📤 Отправить код клиенту</button>
          </div>
          <div id="sr-code-input-block" style="display:none;">
            <div style="font-size:12px;color:var(--muted);margin:10px 0 4px;">Код отправлен. Введите 6 цифр:</div>
            <input id="sr-code-input" type="text" inputmode="numeric" pattern="[0-9]{6}"
                   maxlength="6" placeholder="000000"
                   style="font-size:28px;letter-spacing:8px;text-align:center;width:100%;padding:12px;">
            <div class="signreq-name-row" style="margin-top:10px;">
              <label class="field">
                <span class="field-label">ФИО подписанта</span>
                <input id="sr-code-name" type="text" placeholder="${escHtml(clientName || "Имя клиента")}" value="${escHtml(clientName)}">
              </label>
              <label class="field">
                <span class="field-label">Телефон (необяз.)</span>
                <input id="sr-code-phone" type="tel" placeholder="+7 ...">
              </label>
            </div>
            <div class="signreq-cta">
              <button class="btn-primary signreq-submit-code">Подтвердить</button>
            </div>
          </div>
          <div class="signreq-err" id="sr-code-err"></div>
        </div>

        <!-- Proxy -->
        <div class="signreq-panel" id="sr-panel-proxy" style="display:none;">
          <div style="font-size:13px;color:var(--muted);margin-bottom:12px;">
            Акт подписывает уполномоченный представитель клиента.
            Укажите его данные.
          </div>
          <div class="signreq-name-row">
            <label class="field">
              <span class="field-label">ФИО представителя</span>
              <input id="sr-proxy-name" type="text" placeholder="Иванов Иван Иванович">
            </label>
            <label class="field">
              <span class="field-label">Телефон представителя</span>
              <input id="sr-proxy-phone" type="tel" placeholder="+7 ...">
            </label>
          </div>
          <div class="signreq-cta">
            <button class="btn-primary signreq-submit-proxy">Зафиксировать подпись</button>
          </div>
          <div class="signreq-err" id="sr-proxy-err"></div>
        </div>

        <!-- Absent -->
        <div class="signreq-panel" id="sr-panel-absent" style="display:none;">
          <div style="font-size:13px;color:var(--muted);margin-bottom:12px;">
            Клиент отсутствовал при сдаче работ. Укажите причину.
          </div>
          <div class="field">
            <span class="field-label">Причина</span>
            <select id="sr-absent-reason" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--ink);font-size:14px;">
              <option value="Клиент отсутствовал">Клиент отсутствовал (общая)</option>
              <option value="Клиент недоступен по телефону">Клиент недоступен по телефону</option>
              <option value="Клиент перенёс приёмку">Клиент перенёс приёмку</option>
              <option value="Акт отправлен на email">Акт отправлен на email / мессенджер</option>
            </select>
          </div>
          <div class="field" style="margin-top:8px;">
            <span class="field-label">Примечание (необяз.)</span>
            <input id="sr-absent-note" type="text" placeholder="доп. комментарий">
          </div>
          <div class="signreq-cta">
            <button class="btn-primary signreq-submit-absent">Отметить как «без подписи»</button>
          </div>
          <div class="signreq-err" id="sr-absent-err"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Закрытие
    overlay.querySelector(".signreq-close").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    // Tabs
    const tabs = overlay.querySelectorAll(".signreq-tab");
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        overlay.querySelectorAll(".signreq-panel").forEach(p => p.style.display = "none");
        overlay.querySelector(`#sr-panel-${tab.dataset.tab}`).style.display = "";
      });
    });

    // Canvas setup
    const canvas = overlay.querySelector("#sr-canvas");
    const canvasCtrl = initCanvas(canvas);

    overlay.querySelector(".signreq-clear").addEventListener("click", () => {
      canvasCtrl.clear();
      Platform.haptic("impact");
    });

    // ── Отправить код ────────────────────────────────────────────
    let codeSent = false;
    overlay.querySelector(".signreq-send-code").addEventListener("click", async () => {
      const btn = overlay.querySelector(".signreq-send-code");
      const errEl = overlay.querySelector("#sr-code-err");
      errEl.textContent = "";
      btn.disabled = true;
      btn.textContent = "Отправляем...";
      try {
        const res = await _api("sign_request_create", { assembly_id: assemblyId, mode: "code" });
        if (res.error) throw new Error(res.error);
        codeSent = true;
        overlay.querySelector("#sr-code-send-block").style.display = "none";
        overlay.querySelector("#sr-code-input-block").style.display = "";
        Platform.haptic("success");
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "📤 Отправить код клиенту";
        errEl.textContent = "Ошибка: " + e.message;
      }
    });

    // ── Submit: canvas ───────────────────────────────────────────
    overlay.querySelector(".signreq-submit-canvas").addEventListener("click", async () => {
      const errEl = overlay.querySelector("#sr-canvas-err");
      errEl.textContent = "";
      if (canvasCtrl.isEmpty()) {
        errEl.textContent = "Нарисуйте подпись на поле выше";
        return;
      }
      const name = overlay.querySelector("#sr-canvas-name").value.trim();
      if (!name) {
        errEl.textContent = "Укажите ФИО подписанта";
        return;
      }
      await _submitSigned({
        mode: "canvas",
        signature_data: canvasCtrl.toDataURL(),
        signed_by_name: name,
        signed_by_phone: overlay.querySelector("#sr-canvas-phone").value.trim(),
        errEl,
        onSuccess,
      });
    });

    // ── Submit: code ─────────────────────────────────────────────
    overlay.querySelector(".signreq-submit-code").addEventListener("click", async () => {
      const errEl = overlay.querySelector("#sr-code-err");
      errEl.textContent = "";
      const code = overlay.querySelector("#sr-code-input").value.trim();
      if (!/^\d{6}$/.test(code)) {
        errEl.textContent = "Введите 6-значный код";
        return;
      }
      const name = overlay.querySelector("#sr-code-name").value.trim();
      if (!name) {
        errEl.textContent = "Укажите ФИО подписанта";
        return;
      }
      await _submitSigned({
        mode: "code",
        code,
        signed_by_name: name,
        signed_by_phone: overlay.querySelector("#sr-code-phone").value.trim(),
        errEl,
        onSuccess,
      }, assemblyId);
    });

    // ── Submit: proxy ─────────────────────────────────────────────
    overlay.querySelector(".signreq-submit-proxy").addEventListener("click", async () => {
      const errEl = overlay.querySelector("#sr-proxy-err");
      errEl.textContent = "";
      const name = overlay.querySelector("#sr-proxy-name").value.trim();
      if (!name) {
        errEl.textContent = "Укажите ФИО представителя";
        return;
      }
      await _submitSigned({
        mode: "proxy",
        signed_by_name: name,
        signed_by_phone: overlay.querySelector("#sr-proxy-phone").value.trim(),
        errEl,
        onSuccess,
      }, assemblyId);
    });

    // ── Submit: absent ────────────────────────────────────────────
    overlay.querySelector(".signreq-submit-absent").addEventListener("click", async () => {
      const errEl = overlay.querySelector("#sr-absent-err");
      errEl.textContent = "";
      const reason = overlay.querySelector("#sr-absent-reason").value;
      const note   = overlay.querySelector("#sr-absent-note").value.trim();
      await _submitSigned({
        mode: "absent",
        absent_reason: note ? `${reason} · ${note}` : reason,
        errEl,
        onSuccess,
      }, assemblyId);
    });

    // --- helper -------------------------------------------------------
    async function _submitSigned(params, asmId = assemblyId) {
      const { errEl, onSuccess: cb, ...apiParams } = params;
      const btn = overlay.querySelector(`.signreq-submit-${apiParams.mode}`);
      if (btn) { btn.disabled = true; btn.textContent = "Сохраняем..."; }
      try {
        const res = await _api("sign_request_submit", {
          assembly_id: asmId,
          ...apiParams,
        });
        if (res.error) throw new Error(res.error);
        Platform.haptic("success");
        close();
        if (typeof cb === "function") cb(res);
      } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = _btnLabel(apiParams.mode); }
        errEl.textContent = _errMsg(e.message);
      }
    }
  }

  function _btnLabel(mode) {
    return {
      canvas: "Подписать",
      code:   "Подтвердить",
      proxy:  "Зафиксировать подпись",
      absent: "Отметить как «без подписи»",
    }[mode] || "Подтвердить";
  }

  function _errMsg(raw) {
    return ({
      invalid_code:   "Неверный код — проверьте и попробуйте снова",
      code_expired:   "Код устарел (72 ч) — отправьте новый",
      no_sign_token:  "Сначала отправьте код клиенту",
      missing_code:   "Введите 6-значный код",
      forbidden:      "Нет прав на подпись этой сборки",
      invalid_init_data: "Ошибка авторизации — перезапустите приложение",
    })[raw] || "Ошибка: " + raw;
  }

  function close() {
    document.getElementById("signreq-overlay")?.remove();
  }

  return { open, close };
})();
