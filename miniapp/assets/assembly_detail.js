/* ============================================================
   Детальная карточка сборки — #/c/assembly/:id
   Доступна клиенту, менеджеру, мастеру. v20260519o
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

      // Финансовый блок — ставки из backend (настраиваются в админке)
      const _kp  = data.kitchen_price ? Number(data.kitchen_price) : 0;
      const _cr  = data.client_rate_pct    || 10;
      const _ar  = data.assembler_rate_pct || 9;
      const _cp  = data.assembly_price_for_client != null
        ? Number(data.assembly_price_for_client)
        : (_kp ? Math.round(_kp * _cr / 100) : 0);
      const _ap  = data.assembler_payout != null
        ? Number(data.assembler_payout)
        : null;

      const _priceRows = _kp ? `
        ${row("Стоимость кухни", _kp.toLocaleString("ru-RU") + " ₽")}
        ${row("Стоимость сборки (" + _cr + "%)", _cp.toLocaleString("ru-RU") + " ₽")}
        ${_ap != null ? row("Ваш заработок (" + _ar + "%)", Math.round(_ap).toLocaleString("ru-RU") + " ₽", {color: "var(--accent)"}) : ""}
      ` : "";

      // Основные данные
      const mainBlock = `
        <div style="margin:12px 16px 0;border:1px solid var(--border);border-radius:12px;
                    padding:0 12px;background:var(--surface);">
          ${row("Адрес", data.address)}
          ${_priceRows}
          ${row("Объём работ", data.scope_of_work)}
          ${row("Дата сборки", fmtDate(data.scheduled_at))}
          ${row("Начало", fmtDate(data.started_at))}
          ${row("Завершение", fmtDate(data.completed_at))}
        </div>`;

      // Контакт мастера (виден клиенту)
      const masterBlock = data.assigned_to_name ? `
        <div style="margin:12px 16px 0;padding:12px;background:var(--surface);
                    border:1px solid var(--border);border-radius:12px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;
                      letter-spacing:.06em;color:var(--muted);margin-bottom:6px;">Ваш мастер</div>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="font-size:14px;font-weight:600;color:var(--ink);">${escHtml(data.assigned_to_name)}</div>
            ${data.assigned_to_username ? `
              <a href="https://t.me/${escHtml(data.assigned_to_username)}" target="_blank"
                 style="font-size:13px;color:var(--accent);text-decoration:none;font-weight:500;">
                ✉️ Написать
              </a>` : ""}
          </div>
          ${data.assigned_to_username ? `
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">
              @${escHtml(data.assigned_to_username)}
            </div>` : ""}
        </div>` : "";

      // === Согласование даты сборки ===
      // Для менеджера: кнопка «Предложить дату» или статус ожидания
      function _fmtDateShort(iso) {
        if (!iso) return "";
        try {
          return new Date(iso).toLocaleString("ru-RU", {
            day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
          });
        } catch { return iso.slice(0, 16).replace("T", " "); }
      }

      const dateStatus = data.client_date_status || "";
      const proposedDate = data.proposed_date || "";
      const clientPrefDate = data.client_preferred_date || "";

      // Блок для менеджера
      const dateNegMgrBlock = data.viewer_is_manager && !["done", "cancelled"].includes(data.status) ? (() => {
        if (dateStatus === "pending") {
          return `
            <div id="date-neg-block" style="margin:12px 16px 0;padding:10px 12px;background:var(--surface);
                 border:1px solid #F39C12;border-radius:12px;">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;
                          letter-spacing:.06em;color:#F39C12;margin-bottom:6px;">⏳ Ожидаем ответа клиента</div>
              <div style="font-size:13px;color:var(--ink);">Предложено: <b>${escHtml(_fmtDateShort(proposedDate))}</b></div>
              <button id="date-propose-again-btn" class="btn-secondary"
                      style="margin-top:8px;font-size:12px;padding:7px 12px;">
                Изменить предложение
              </button>
            </div>`;
        }
        if (dateStatus === "declined") {
          return `
            <div id="date-neg-block" style="margin:12px 16px 0;padding:10px 12px;background:var(--surface);
                 border:1px solid #C0392B;border-radius:12px;">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;
                          letter-spacing:.06em;color:#C0392B;margin-bottom:6px;">❌ Клиент не может</div>
              ${clientPrefDate ? `<div style="font-size:13px;color:var(--ink);">Предлагает: <b>${escHtml(_fmtDateShort(clientPrefDate))}</b></div>` : `<div style="font-size:13px;color:var(--muted);">Альтернативная дата не указана</div>`}
              <div style="display:flex;gap:6px;margin-top:8px;">
                ${clientPrefDate ? `<button id="date-accept-client-btn" class="btn-primary"
                        style="flex:1;font-size:12px;padding:7px 10px;">✅ Принять дату клиента</button>` : ""}
                <button id="date-propose-again-btn" class="${clientPrefDate ? "btn-secondary" : "btn-primary"}"
                        style="flex:1;font-size:12px;padding:7px 10px;">📅 Предложить другую</button>
              </div>
            </div>`;
        }
        // Нет активного предложения — умный подборщик
        return `
          <div id="date-neg-block" style="margin:12px 16px 0;">
            <button id="date-suggest-btn" class="btn-secondary"
                    style="width:100%;font-size:13px;padding:10px;">
              🔍 Подобрать мастера и дату
            </button>
            <div id="date-suggest-panel" style="display:none;margin-top:8px;"></div>
            <div id="date-propose-manual-toggle" style="margin-top:6px;text-align:center;">
              <button style="font-size:12px;color:var(--muted);background:none;border:none;
                             cursor:pointer;padding:4px 0;text-decoration:underline;">
                Указать вручную
              </button>
            </div>
            <div id="date-propose-form" style="display:none;margin-top:8px;padding:12px;
                 background:var(--surface);border:1px solid var(--border);border-radius:12px;">
              <div style="font-size:13px;font-weight:600;color:var(--ink);margin-bottom:8px;">Предложить дату:</div>
              <input type="datetime-local" id="date-propose-input"
                     style="width:100%;padding:10px;border:1px solid var(--border);
                            border-radius:8px;background:var(--surface);color:var(--ink);
                            font-size:13px;box-sizing:border-box;">
              <div style="display:flex;gap:6px;margin-top:8px;">
                <button id="date-propose-cancel-btn" class="btn-secondary"
                        style="flex:1;font-size:13px;padding:9px;">Отмена</button>
                <button id="date-propose-send-btn" class="btn-primary"
                        style="flex:1;font-size:13px;padding:9px;">Отправить клиенту</button>
              </div>
              <div id="date-propose-status" style="font-size:12px;color:var(--muted);min-height:16px;margin-top:4px;"></div>
            </div>
          </div>`;
      })() : "";

      // Блок для клиента: подтверждение предложенной даты
      const dateNegClientBlock = !data.viewer_is_manager && !data.viewer_is_assembler && proposedDate && dateStatus === "pending" ? `
        <div id="date-client-block" style="margin:12px 16px 0;padding:12px;
             background:var(--surface);border:2px solid var(--accent);border-radius:12px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;
                      letter-spacing:.06em;color:var(--accent);margin-bottom:6px;">
            📅 Менеджер предлагает дату сборки
          </div>
          <div style="font-size:16px;font-weight:700;color:var(--ink);">
            ${escHtml(_fmtDateShort(proposedDate))}
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button id="date-client-confirm-btn" class="btn-primary"
                    style="flex:1;font-size:13px;padding:10px;">✅ Подтверждаю</button>
            <button id="date-client-decline-btn" class="btn-secondary"
                    style="flex:1;font-size:13px;padding:10px;">📅 Другое время</button>
          </div>
          <div id="date-client-alt-form" style="display:none;margin-top:8px;">
            <input type="datetime-local" id="date-client-alt-input"
                   style="width:100%;padding:10px;border:1px solid var(--border);
                          border-radius:8px;background:var(--surface);color:var(--ink);
                          font-size:13px;box-sizing:border-box;">
            <button id="date-client-send-alt-btn" class="btn-primary"
                    style="width:100%;margin-top:6px;font-size:13px;padding:9px;">
              Отправить менеджеру
            </button>
          </div>
          <div id="date-client-status" style="font-size:12px;color:var(--muted);min-height:16px;margin-top:4px;"></div>
        </div>` : "";

      // Испытательный срок — виден менеджеру когда есть назначенный сборщик
      const probationBlock = (data.viewer_is_manager && data.assigned_to_tg_id) ? `
        <div id="probation-wrap" style="margin:12px 16px 0;padding:10px 12px;
             background:var(--surface);border:1px solid var(--border);border-radius:12px;
             display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--ink);">Испытательный срок</div>
            <div style="font-size:11px;color:var(--muted);">Сборщик обязан прикладывать фото</div>
          </div>
          <button id="probation-toggle-btn" class="${data.assigned_on_probation ? "btn-primary" : "btn-secondary"}"
                  style="font-size:12px;padding:7px 12px;white-space:nowrap;">
            ${data.assigned_on_probation ? "✅ Активен" : "Включить"}
          </button>
        </div>` : "";

      // Act №4 summary
      const act4SummaryBlock = (data.act4_total > 0 || data.act4_signed) ? (() => {
        const dmgColor = data.act4_damaged > 0 ? "#E67E22" : "#27AE60";
        return `
          <div style="margin:12px 16px 0;padding:10px 12px;background:var(--surface);
                      border:1px solid var(--border);border-radius:12px;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;
                        letter-spacing:.06em;color:var(--muted);margin-bottom:6px;">Акт №4 · Приёмка товара</div>
            <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
              <span style="font-size:13px;">📦 ${data.act4_total} поз.</span>
              ${data.act4_damaged > 0
                ? `<span style="font-size:13px;color:${dmgColor};">⚠️ ${data.act4_damaged} поврежд.</span>`
                : `<span style="font-size:13px;color:${dmgColor};">✅ Без повреждений</span>`}
              ${data.act4_signed
                ? `<span style="font-size:12px;color:var(--muted);">Принял: ${escHtml(data.act4_signed_by)}</span>`
                : `<span style="font-size:12px;color:#E67E22;">⏳ Не подписан</span>`}
            </div>
          </div>`;
      })() : "";

      // Заметка менеджера
      const noteBlock = data.manager_note ? `
        <div style="margin:12px 16px 0;padding:12px;background:var(--surface-2,var(--surface));
                    border:1px solid var(--border);border-radius:12px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;
                      letter-spacing:.06em;color:var(--muted);margin-bottom:6px;">Заметка</div>
          <div style="font-size:13px;color:var(--ink);line-height:1.5;">${escHtml(data.manager_note)}</div>
        </div>` : "";

      // Фото результата
      function _photoUrl(fn) {
        return `${BACKEND_URL}/api/photo/${encodeURIComponent(data.id)}/${encodeURIComponent(fn)}`;
      }
      const photosAfter = (data.photos_after || []).filter(Boolean);
      const photosBefore = (data.photos_before || []).filter(Boolean);
      const allPhotos = [...photosBefore, ...photosAfter];
      const photosBlock = allPhotos.length ? `
        <div style="margin:12px 16px 0;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;
                      letter-spacing:.06em;color:var(--muted);margin-bottom:8px;">Фото сборки</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${allPhotos.map(fn => {
              const u = _photoUrl(fn);
              return `<a href="${u}" target="_blank">
                <img src="${u}" alt="фото"
                     style="width:80px;height:80px;object-fit:cover;border-radius:8px;
                            border:1px solid var(--border);" loading="lazy">
              </a>`;
            }).join("")}
          </div>
        </div>` : "";

      // Подпись
      const VIA_LABELS = {
        canvas: "✍️ Подпись пальцем",
        code:   "📱 Код подтверждения",
        proxy:  "👤 Представитель",
        absent: "🚫 Без подписи",
      };
      const signBlock = data.signed_by_name ? `
        <div style="margin:12px 16px 0;padding:10px 12px;background:var(--surface);
                    border:1px solid var(--border);border-radius:12px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;
                      letter-spacing:.06em;color:var(--muted);margin-bottom:6px;">
            ${escHtml(VIA_LABELS[data.signed_via] || "Принято")}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:13px;font-weight:600;color:var(--ink);">${escHtml(data.signed_by_name)}</div>
            <div style="font-size:12px;color:var(--muted);">${escHtml(fmtDate(data.signed_at) || "")}</div>
          </div>
          ${data.signed_by_phone ? `<div style="font-size:12px;color:var(--muted);margin-top:2px;">${escHtml(data.signed_by_phone)}</div>` : ""}
        </div>` : `<div id="sr-sign-btn-wrap" style="margin:12px 16px 0;"></div>`;

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

      // Заметки сборщика (показ) — перед кнопками, данные уже в data
      const assemblerNotesBlock = data.assembler_notes ? `
        <div style="margin:12px 16px 0;padding:12px;background:var(--surface);
                    border:1px solid var(--border);border-radius:12px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;
                      letter-spacing:.06em;color:var(--muted);margin-bottom:6px;">Заметки сборщика</div>
          <div style="font-size:13px;color:var(--ink);line-height:1.5;white-space:pre-wrap;">${escHtml(data.assembler_notes)}</div>
        </div>` : "";

      screen.innerHTML = statusBanner + mainBlock + dateNegMgrBlock + dateNegClientBlock +
        act4SummaryBlock + masterBlock + probationBlock +
        noteBlock + assemblerNotesBlock + photosBlock + signBlock + calBtn +
        `<div style="height:32px;"></div>`;

      // Обработчик toggle испытательного срока
      const probToggleBtn = screen.querySelector("#probation-toggle-btn");
      if (probToggleBtn) {
        probToggleBtn.addEventListener("click", async () => {
          haptic && haptic("impact");
          const newVal = !data.assigned_on_probation;
          probToggleBtn.disabled = true;
          probToggleBtn.textContent = "…";
          try {
            const res = await _api("assembler_set_probation", {
              assembler_tg_id: data.assigned_to_tg_id,
              on_probation: newVal,
            });
            if (res.ok) mount(container, assemblyId);
            else { probToggleBtn.disabled = false; alert(res.msg || res.error); }
          } catch (e) { probToggleBtn.disabled = false; probToggleBtn.textContent = "Ошибка"; }
        });
      }

      // === Обработчики согласования даты (менеджер) ===
      const proposeOpenBtn = screen.querySelector("#date-propose-open-btn");
      const proposeAgainBtn = screen.querySelector("#date-propose-again-btn");
      const dateAcceptClientBtn = screen.querySelector("#date-accept-client-btn");

      function _showProposeForm() {
        const form = screen.querySelector("#date-propose-form");
        const openBtn = screen.querySelector("#date-propose-open-btn");
        if (form) { form.style.display = "block"; if (openBtn) openBtn.style.display = "none"; }
      }

      if (proposeOpenBtn) {
        proposeOpenBtn.addEventListener("click", () => { haptic && haptic("impact"); _showProposeForm(); });
      }
      if (proposeAgainBtn) {
        proposeAgainBtn.addEventListener("click", () => {
          haptic && haptic("impact");
          const block = screen.querySelector("#date-neg-block");
          if (block) block.innerHTML = `
            <div style="padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:12px;">
              <div style="font-size:13px;font-weight:600;color:var(--ink);margin-bottom:8px;">Предложить дату:</div>
              <input type="datetime-local" id="date-propose-input"
                     style="width:100%;padding:10px;border:1px solid var(--border);
                            border-radius:8px;background:var(--surface);color:var(--ink);
                            font-size:13px;box-sizing:border-box;">
              <div style="display:flex;gap:6px;margin-top:8px;">
                <button id="date-propose-cancel-btn" class="btn-secondary" style="flex:1;font-size:13px;padding:9px;">Отмена</button>
                <button id="date-propose-send-btn" class="btn-primary" style="flex:1;font-size:13px;padding:9px;">Отправить</button>
              </div>
              <div id="date-propose-status" style="font-size:12px;color:var(--muted);min-height:16px;margin-top:4px;"></div>
            </div>`;
          _bindProposeForm(block);
        });
      }

      if (dateAcceptClientBtn) {
        dateAcceptClientBtn.addEventListener("click", async () => {
          haptic && haptic("impact");
          dateAcceptClientBtn.disabled = true;
          dateAcceptClientBtn.textContent = "…";
          try {
            const res = await _api("assembly_propose_date", {
              assembly_id: data.id,
              proposed_date: data.client_preferred_date,
            });
            if (res.ok) mount(container, assemblyId);
            else dateAcceptClientBtn.textContent = res.error || "Ошибка";
          } catch (e) { dateAcceptClientBtn.textContent = "Ошибка"; }
        });
      }

      function _bindProposeForm(ctx) {
        const cancelBtn = (ctx || screen).querySelector("#date-propose-cancel-btn");
        const sendBtn   = (ctx || screen).querySelector("#date-propose-send-btn");
        const statusEl  = (ctx || screen).querySelector("#date-propose-status");
        if (cancelBtn) cancelBtn.addEventListener("click", () => mount(container, assemblyId));
        if (sendBtn) sendBtn.addEventListener("click", async () => {
          haptic && haptic("impact");
          const inputEl = (ctx || screen).querySelector("#date-propose-input");
          const val = inputEl ? inputEl.value : "";
          if (!val) { if (statusEl) statusEl.textContent = "Выберите дату"; return; }
          sendBtn.disabled = true; sendBtn.textContent = "Отправляем…";
          try {
            const res = await _api("assembly_propose_date", { assembly_id: data.id, proposed_date: val });
            if (res.ok) {
              haptic && haptic("success");
              mount(container, assemblyId);
            } else {
              if (statusEl) statusEl.textContent = res.msg || res.error || "Ошибка";
              sendBtn.disabled = false; sendBtn.textContent = "Отправить клиенту";
            }
          } catch (e) {
            if (statusEl) statusEl.textContent = e.message;
            sendBtn.disabled = false; sendBtn.textContent = "Отправить клиенту";
          }
        });
      }
      _bindProposeForm(null);

      // Кнопка "Указать вручную"
      const manualToggle = screen.querySelector("#date-propose-manual-toggle button");
      if (manualToggle) {
        manualToggle.addEventListener("click", () => {
          haptic && haptic("impact");
          const form = screen.querySelector("#date-propose-form");
          const panel = screen.querySelector("#date-suggest-panel");
          const suggestBtn = screen.querySelector("#date-suggest-btn");
          if (form) { form.style.display = form.style.display === "none" ? "block" : "none"; }
          if (panel) panel.style.display = "none";
          if (suggestBtn) suggestBtn.style.display = "block";
        });
      }

      // === Умный подборщик: загрузка и рендер слотов ===
      const suggestBtn = screen.querySelector("#date-suggest-btn");
      if (suggestBtn) {
        let _slotsLoaded = false;
        suggestBtn.addEventListener("click", async () => {
          haptic && haptic("impact");
          const panel = screen.querySelector("#date-suggest-panel");
          const manualWrap = screen.querySelector("#date-propose-manual-toggle");
          if (!panel) return;

          if (panel.style.display === "block") {
            panel.style.display = "none";
            suggestBtn.textContent = "🔍 Подобрать мастера и дату";
            return;
          }

          panel.style.display = "block";
          suggestBtn.textContent = "⏳ Загружаем…";
          suggestBtn.disabled = true;
          if (manualWrap) manualWrap.style.display = "none";

          if (!_slotsLoaded) {
            panel.innerHTML = `<div class="loader-inline"><div class="spinner"></div></div>`;
            try {
              const slots = await _api("assembly_suggest_slots", { assembly_id: data.id });
              if (slots.error) {
                panel.innerHTML = `<div style="color:#C0392B;font-size:13px;padding:8px 0;">${escHtml(slots.error)}</div>`;
              } else {
                _renderSlots(panel, slots.assemblers || []);
                _slotsLoaded = true;
              }
            } catch (e) {
              panel.innerHTML = `<div style="color:#C0392B;font-size:13px;padding:8px 0;">Ошибка: ${escHtml(e.message)}</div>`;
            }
          }
          suggestBtn.disabled = false;
          suggestBtn.textContent = "✕ Скрыть";
        });
      }

      function _fmtSlot(iso) {
        try {
          const d = new Date(iso);
          const days = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
          const mons = ["","янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
          return `${days[d.getDay()]} ${d.getDate()} ${mons[d.getMonth()+1]}, ${String(d.getHours()).padStart(2,"0")}:00`;
        } catch { return iso.slice(0, 16).replace("T"," "); }
      }

      let _selectedAssemblerTgId = null;
      let _selectedSlot = null;

      function _renderSlots(panel, assemblers) {
        panel.innerHTML = "";

        if (!assemblers.length) {
          panel.innerHTML = `<div style="font-size:13px;color:var(--muted);padding:8px 0;">Нет доступных сборщиков</div>`;
          return;
        }

        // Итоговый блок отправки
        const sendWrap = document.createElement("div");
        sendWrap.id = "slots-send-wrap";
        sendWrap.style.cssText = "display:none;margin-top:8px;padding:10px;background:var(--surface);" +
          "border:1px solid var(--accent);border-radius:10px;";

        for (const asm of assemblers) {
          const card = document.createElement("div");
          card.style.cssText = "margin-bottom:10px;padding:10px;background:var(--surface);" +
            "border:1px solid var(--border);border-radius:10px;";

          // Заголовок: имя + рейтинг-бейджи
          const probBadge = asm.on_probation
            ? `<span style="font-size:10px;padding:2px 6px;border-radius:8px;
                            background:#fff3cd;color:#856404;">испытательный</span>` : "";
          const loadColor = asm.active_count >= 3 ? "#E67E22" : asm.active_count >= 1 ? "#F39C12" : "#27AE60";
          card.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:700;color:var(--ink);">
                  ${escHtml(asm.name)}
                </div>
                <div style="font-size:11px;color:var(--muted);margin-top:1px;display:flex;gap:6px;flex-wrap:wrap;">
                  <span>✅ ${asm.completed_count} сборок</span>
                  <span style="color:${loadColor};">🔨 ${asm.active_count} активных</span>
                  ${probBadge}
                </div>
              </div>
              <div style="font-size:12px;font-weight:700;color:var(--accent);white-space:nowrap;">
                ⭐ ${asm.score > 0 ? "+" : ""}${asm.score}
              </div>
            </div>
            <div class="slots-chips" style="display:flex;gap:5px;flex-wrap:wrap;"></div>
          `;

          const chipsWrap = card.querySelector(".slots-chips");
          if (!asm.free_slots || !asm.free_slots.length) {
            chipsWrap.innerHTML = `<span style="font-size:12px;color:var(--muted);">Нет свободных дат на 2 недели</span>`;
          } else {
            asm.free_slots.forEach(slot => {
              const chip = document.createElement("button");
              chip.className = "slot-chip";
              chip.dataset.slot = slot;
              chip.dataset.asmId = asm.tg_id;
              chip.dataset.asmName = asm.name;
              chip.style.cssText = `font-size:11px;padding:4px 8px;border-radius:8px;
                border:1px solid var(--border);background:var(--surface);
                color:var(--ink);cursor:pointer;white-space:nowrap;`;
              chip.textContent = _fmtSlot(slot);
              chip.addEventListener("click", () => {
                haptic && haptic("impact");
                // Снять выделение с всех чипов
                panel.querySelectorAll(".slot-chip").forEach(c => {
                  c.style.background = "var(--surface)";
                  c.style.color = "var(--ink)";
                  c.style.borderColor = "var(--border)";
                });
                // Подсветить выбранный
                chip.style.background = "var(--accent)";
                chip.style.color = "#fff";
                chip.style.borderColor = "var(--accent)";

                _selectedAssemblerTgId = asm.tg_id;
                _selectedSlot = slot;

                // Показываем кнопку отправки
                sendWrap.style.display = "block";
                sendWrap.innerHTML = `
                  <div style="font-size:13px;color:var(--ink);margin-bottom:8px;">
                    <b>${escHtml(asm.name)}</b><br>
                    <span style="color:var(--muted);">${escHtml(_fmtSlot(slot))}</span>
                  </div>
                  <button id="slots-send-btn" class="btn-primary"
                          style="width:100%;font-size:13px;padding:10px;">
                    📅 Предложить клиенту
                  </button>
                  <div id="slots-send-status" style="font-size:12px;color:var(--muted);
                       min-height:16px;margin-top:4px;"></div>
                `;
                const sendSlotBtn = sendWrap.querySelector("#slots-send-btn");
                sendSlotBtn.addEventListener("click", async () => {
                  haptic && haptic("impact");
                  sendSlotBtn.disabled = true; sendSlotBtn.textContent = "Отправляем…";
                  const statusEl = sendWrap.querySelector("#slots-send-status");
                  try {
                    const res = await _api("assembly_propose_date", {
                      assembly_id: data.id,
                      proposed_date: _selectedSlot,
                      assign_assembler_tg_id: _selectedAssemblerTgId,
                    });
                    if (res.ok) {
                      haptic && haptic("success");
                      mount(container, assemblyId);
                    } else {
                      if (statusEl) statusEl.textContent = res.msg || res.error || "Ошибка";
                      sendSlotBtn.disabled = false; sendSlotBtn.textContent = "📅 Предложить клиенту";
                    }
                  } catch (e) {
                    if (statusEl) statusEl.textContent = e.message;
                    sendSlotBtn.disabled = false; sendSlotBtn.textContent = "📅 Предложить клиенту";
                  }
                });
              });
              chipsWrap.appendChild(chip);
            });
          }

          panel.appendChild(card);
        }

        panel.appendChild(sendWrap);
      }

      // === Обработчики согласования даты (клиент) ===
      const clientConfirmBtn = screen.querySelector("#date-client-confirm-btn");
      const clientDeclineBtn = screen.querySelector("#date-client-decline-btn");
      const clientSendAltBtn = screen.querySelector("#date-client-send-alt-btn");
      const clientStatus     = screen.querySelector("#date-client-status");

      if (clientConfirmBtn) {
        clientConfirmBtn.addEventListener("click", async () => {
          haptic && haptic("impact");
          clientConfirmBtn.disabled = true; clientConfirmBtn.textContent = "…";
          try {
            const res = await _api("assembly_date_confirm", { assembly_id: data.id });
            if (res.ok) {
              haptic && haptic("success");
              mount(container, assemblyId);
            } else {
              clientConfirmBtn.disabled = false; clientConfirmBtn.textContent = "✅ Подтверждаю";
              if (clientStatus) clientStatus.textContent = res.error || "Ошибка";
            }
          } catch (e) { clientConfirmBtn.disabled = false; clientConfirmBtn.textContent = "✅ Подтверждаю"; }
        });
      }

      if (clientDeclineBtn) {
        clientDeclineBtn.addEventListener("click", () => {
          haptic && haptic("impact");
          const altForm = screen.querySelector("#date-client-alt-form");
          if (altForm) altForm.style.display = "block";
          clientDeclineBtn.style.display = "none";
        });
      }

      if (clientSendAltBtn) {
        clientSendAltBtn.addEventListener("click", async () => {
          haptic && haptic("impact");
          const altInput = screen.querySelector("#date-client-alt-input");
          const altVal = altInput ? altInput.value : "";
          clientSendAltBtn.disabled = true; clientSendAltBtn.textContent = "Отправляем…";
          try {
            const res = await _api("assembly_date_decline", {
              assembly_id: data.id,
              preferred_date: altVal || null,
            });
            if (res.ok) {
              haptic && haptic("success");
              const block = screen.querySelector("#date-client-block");
              if (block) block.innerHTML = `
                <div style="padding:10px;text-align:center;color:var(--muted);font-size:13px;">
                  ✅ Ваш ответ отправлен менеджеру
                </div>`;
            } else {
              clientSendAltBtn.disabled = false; clientSendAltBtn.textContent = "Отправить менеджеру";
              if (clientStatus) clientStatus.textContent = res.error || "Ошибка";
            }
          } catch (e) { clientSendAltBtn.disabled = false; clientSendAltBtn.textContent = "Отправить менеджеру"; }
        });
      }

      // === Кнопки смены статуса (сборщик + менеджер) ===
      const isAssembler = data.viewer_is_assembler;
      const isMgr       = data.viewer_is_manager;

      // === Кнопка «Мой заказ» — только для клиента ===
      if (!isMgr && !isAssembler) {
        const tlWrap = document.createElement("div");
        tlWrap.style.cssText = "margin:8px 16px 0;";
        const tlBtn = document.createElement("button");
        tlBtn.className = "btn-primary";
        tlBtn.style.cssText = "width:100%;font-size:14px;padding:12px;";
        tlBtn.textContent = "📋 Мой заказ — этапы";
        tlBtn.addEventListener("click", () => {
          haptic && haptic("impact");
          location.hash = `#/c/assembly/${encodeURIComponent(data.id)}/timeline`;
        });
        tlWrap.appendChild(tlBtn);
        screen.appendChild(tlWrap);
      }

      // === Оценка сборки (клиент, после завершения, ещё не оценивал) ===
      if (!isMgr && !isAssembler && data.status === "done" && !data.client_feedback_at
          && typeof FeedbackModule !== "undefined") {
        const fbWrap = document.createElement("div");
        fbWrap.style.cssText = "margin:16px 16px 0;";
        screen.appendChild(fbWrap);
        FeedbackModule.mountAssemblyFeedback(fbWrap, {
          assemblerName:   data.assigned_to_name  || "",
          assemblerTgId:   data.assigned_to_tg_id || "",
          managerName:     data.manager_name      || "",
          managerTgId:     data.manager_tg_id     || "",
          assemblyId:      data.id,
          onSubmit: () => mount(container, assemblyId),
        });
      }
      const isAssigned  = String(data.assigned_to_tg_id) === String(data.viewer_tg_id);
      const canChangeStatus = isMgr || (isAssembler && isAssigned);

      const STATUS_BTNS = {
        created:     [{ label: "🔨 Начать сборку",    next: "in_progress", cls: "btn-primary" }],
        scheduled:   [{ label: "🔨 Начать сборку",    next: "in_progress", cls: "btn-primary" }],
        in_progress: [{ label: "✅ Завершить сборку", next: "done",        cls: "btn-primary" }],
      };

      if (canChangeStatus && STATUS_BTNS[data.status]) {
        STATUS_BTNS[data.status].forEach(({ label, next, cls }) => {
          const w = document.createElement("div");
          w.style.cssText = "margin:8px 16px 0;";
          const b = document.createElement("button");
          b.className = cls;
          b.style.cssText = "width:100%;font-size:15px;padding:13px;";
          b.textContent = label;
          b.addEventListener("click", async () => {
            haptic && haptic("impact");
            b.disabled = true; b.textContent = "Обновляем…";
            try {
              const res = await _api("assembly_set_status", { assembly_id: data.id, status: next });
              if (res.error) { b.disabled = false; b.textContent = label; alert(res.msg || res.error); return; }
              mount(container, assemblyId);
            } catch (e) { b.disabled = false; b.textContent = label; }
          });
          w.appendChild(b); screen.appendChild(w);
        });
      }

      // === Назначить экспедитора (менеджер) ===
      if (isMgr && data.status !== "done" && data.status !== "cancelled") {
        const expWrap = document.createElement("div");
        expWrap.style.cssText = "margin:8px 16px 0;";
        expWrap.innerHTML = `
          <div style="display:flex;gap:8px;align-items:center;">
            <select id="exp-select" style="flex:1;padding:10px;border:1px solid var(--border);
                    border-radius:8px;background:var(--surface);color:var(--ink);font-size:13px;">
              <option value="">📦 Назначить экспедитора…</option>
            </select>
            <button id="exp-assign-btn" class="btn-secondary"
                    style="padding:10px 14px;font-size:13px;white-space:nowrap;">Назначить</button>
          </div>
        `;
        screen.appendChild(expWrap);
        // Загружаем список экспедиторов
        _loadExpeditorList(expWrap.querySelector("#exp-select"), data.expeditor_tg_id);
        expWrap.querySelector("#exp-assign-btn").addEventListener("click", async () => {
          haptic && haptic("impact");
          const selId = expWrap.querySelector("#exp-select").value;
          const res = await _api("assembly_set_expeditor", { assembly_id: data.id, expeditor_tg_id: selId });
          if (res.ok) mount(container, assemblyId);
        });
      }

      // === Фото-отчёт (только испытательный срок) ===
      if (isAssembler && isAssigned && data.viewer_on_probation) {
        const photoUploadWrap = document.createElement("div");
        photoUploadWrap.style.cssText = "margin:8px 16px 0;";
        photoUploadWrap.innerHTML = `
          <div style="font-size:12px;color:var(--muted);margin-bottom:6px;">📸 Фото-отчёт сборки</div>
          <div style="display:flex;gap:8px;">
            <button id="photo-before-btn" class="btn-secondary"
                    style="flex:1;font-size:13px;padding:9px 6px;" data-kind="before">До сборки</button>
            <button id="photo-after-btn" class="btn-secondary"
                    style="flex:1;font-size:13px;padding:9px 6px;" data-kind="after">После сборки</button>
          </div>
          <input type="file" id="photo-file-input" accept="image/*" capture="environment"
                 style="display:none;">
          <div id="photo-upload-status" style="font-size:12px;color:var(--muted);margin-top:4px;min-height:16px;"></div>
        `;
        screen.appendChild(photoUploadWrap);

        const fileInput = photoUploadWrap.querySelector("#photo-file-input");
        const statusEl  = photoUploadWrap.querySelector("#photo-upload-status");
        let _activeKind = "after";

        photoUploadWrap.querySelectorAll("button[data-kind]").forEach(btn => {
          btn.addEventListener("click", () => {
            _activeKind = btn.dataset.kind;
            fileInput.click();
          });
        });

        fileInput.addEventListener("change", async () => {
          const file = fileInput.files[0];
          if (!file) return;
          statusEl.textContent = "Загружаем…";
          try {
            const dataUrl = await new Promise((res, rej) => {
              const reader = new FileReader();
              reader.onload = e => res(e.target.result);
              reader.onerror = rej;
              reader.readAsDataURL(file);
            });
            const result = await _api("assembly_photo_upload", {
              assembly_id: data.id,
              photo_b64: dataUrl,
              kind: _activeKind,
            });
            if (result.error) {
              statusEl.textContent = `Ошибка: ${result.msg || result.error}`;
            } else {
              statusEl.textContent = `✅ Фото добавлено`;
              haptic && haptic("success");
              setTimeout(() => mount(container, assemblyId), 600);
            }
          } catch (e) {
            statusEl.textContent = `Ошибка: ${e.message}`;
          } finally {
            fileInput.value = "";
          }
        });
      }

      // === Заметки сборщика — ввод (in_progress, назначенный сборщик или менеджер) ===
      if ((isAssembler && isAssigned) || isMgr) {
        const notesWrap = document.createElement("div");
        notesWrap.style.cssText = "margin:8px 16px 0;";
        notesWrap.innerHTML = `
          <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">📝 Заметки сборщика</div>
          <textarea id="asm-notes-input" rows="3"
                    placeholder="Замечания, отклонения от проекта, вопросы…"
                    style="width:100%;padding:10px;border:1px solid var(--border);border-radius:10px;
                           background:var(--surface);color:var(--ink);font-size:13px;
                           resize:vertical;box-sizing:border-box;"
                    ${isMgr && !isAssigned ? "readonly" : ""}>${escHtml(data.assembler_notes || "")}</textarea>
          ${(!isMgr || isAssigned) ? `
          <button id="asm-notes-save-btn" class="btn-secondary"
                  style="width:100%;margin-top:6px;font-size:13px;padding:9px;">Сохранить заметку</button>
          <div id="asm-notes-status" style="font-size:12px;color:var(--muted);min-height:16px;margin-top:4px;"></div>` : ""}
        `;
        screen.appendChild(notesWrap);
        const saveNotesBtn = notesWrap.querySelector("#asm-notes-save-btn");
        if (saveNotesBtn) {
          saveNotesBtn.addEventListener("click", async () => {
            haptic && haptic("impact");
            const notes = notesWrap.querySelector("#asm-notes-input").value.trim();
            saveNotesBtn.disabled = true;
            saveNotesBtn.textContent = "Сохраняем…";
            const statusEl = notesWrap.querySelector("#asm-notes-status");
            try {
              const res = await _api("assembly_notes_save", { assembly_id: data.id, notes });
              if (res.ok) {
                statusEl.textContent = "✅ Сохранено";
                haptic && haptic("success");
                setTimeout(() => statusEl.textContent = "", 2000);
              } else statusEl.textContent = res.msg || res.error;
            } catch (e) { statusEl.textContent = e.message; }
            finally { saveNotesBtn.disabled = false; saveNotesBtn.textContent = "Сохранить заметку"; }
          });
        }
      }

      // === Доп работы (сборщик + менеджер) ===
      if ((isAssembler && isAssigned) || isMgr) {
        const extrasWrap = document.createElement("div");
        extrasWrap.style.cssText = "margin:8px 16px 0;";
        extrasWrap.innerHTML = `
          <button id="extras-toggle-btn" class="btn-secondary"
                  style="width:100%;font-size:14px;padding:11px;" data-open="0">
            🧾 Доп работы <span id="extras-badge"></span>
          </button>
          <div id="extras-panel" style="display:none;margin-top:8px;"></div>
        `;
        screen.appendChild(extrasWrap);

        const extrasPanel = extrasWrap.querySelector("#extras-panel");
        const extrasBadge = extrasWrap.querySelector("#extras-badge");

        extrasWrap.querySelector("#extras-toggle-btn").addEventListener("click", async () => {
          haptic && haptic("impact");
          const btn = extrasWrap.querySelector("#extras-toggle-btn");
          const isOpen = btn.dataset.open === "1";
          if (isOpen) {
            extrasPanel.style.display = "none";
            btn.dataset.open = "0";
          } else {
            extrasPanel.style.display = "block";
            btn.dataset.open = "1";
            if (!extrasPanel.dataset.loaded) {
              extrasPanel.dataset.loaded = "1";
              await _loadExtras(data.id, extrasPanel, extrasBadge, isMgr || (isAssembler && isAssigned));
            }
          }
        });

        // Подгружаем счётчик сразу
        _api("assembly_extras_list", { assembly_id: data.id }).then(r => {
          const items = r.extras || [];
          if (items.length) {
            const total = items.reduce((s, x) => s + Number(x.amount || 0), 0);
            extrasBadge.textContent = `· ${items.length} поз. ${total > 0 ? "/ " + Math.round(total).toLocaleString("ru-RU") + " ₽" : ""}`;
          }
        }).catch(() => {});
      }

      // Кнопка «Акт №4 — приёмка товара»
      const act4Wrap = document.createElement("div");
      act4Wrap.style.cssText = "margin:8px 16px 0;";
      const act4Btn = document.createElement("button");
      act4Btn.className = "btn-secondary";
      act4Btn.style.cssText = "width:100%;font-size:14px;padding:11px;";
      act4Btn.textContent = "📦 Акт №4 · Приёмка товара";
      act4Btn.addEventListener("click", () => {
        haptic && haptic("impact");
        location.hash = `#/assembly/${data.id}/act4`;
      });
      act4Wrap.appendChild(act4Btn);
      screen.appendChild(act4Wrap);

            // Кнопка «Акт доп.работ» — для сборщика и менеджера
      if (data.viewer_is_assembler || data.viewer_is_manager) {
        const extraWrap = document.createElement("div");
        extraWrap.style.cssText = "margin:8px 16px 0;";
        const extraBtn = document.createElement("button");
        extraBtn.className = "btn-secondary";
        extraBtn.style.cssText = "width:100%;font-size:14px;padding:11px;";
        extraBtn.textContent = "📋 Акт доп. работ";
        extraBtn.addEventListener("click", () => {
          haptic && haptic("impact");
          location.hash = `#/assembly/${data.id}/extra_acts`;
        });
        extraWrap.appendChild(extraBtn);
        screen.appendChild(extraWrap);
      }

      // Кнопка «Акт сдачи-приёмки» — для менеджера всегда доступна
      const actWrap = document.createElement("div");
      actWrap.style.cssText = "margin:8px 16px 0;";
      const actBtn = document.createElement("button");
      actBtn.className = "btn-secondary";
      actBtn.style.cssText = "width:100%;font-size:14px;padding:11px;";
      actBtn.textContent = "📄 Акт №3 · Сдача-приёмка сборки";
      actBtn.addEventListener("click", () => {
        haptic && haptic("impact");
        location.hash = `#/assembly/${data.id}/contract`;
      });
      actWrap.appendChild(actBtn);
      screen.appendChild(actWrap);

      // Кнопка «Подписать акт» — только если ещё не подписано
      if (!data.signed_by_name) {
        const btnWrap = screen.querySelector("#sr-sign-btn-wrap");
        if (btnWrap) {
          const signBtn = document.createElement("button");
          signBtn.className = "btn-primary";
          signBtn.style.cssText = "width:100%;font-size:15px;padding:13px;";
          signBtn.textContent = "✍️ Подписать акт приёмки";
          signBtn.addEventListener("click", () => {
            haptic && haptic("impact");
            if (typeof SignRequest !== "undefined") {
              SignRequest.open(data.id, {
                clientName:  data.client_name || "",
                clientTgId:  data.client_tg_id || "",
                onSuccess: () => {
                  mount(container, assemblyId);
                },
              });
            }
          });
          btnWrap.appendChild(signBtn);
        }
      }

    } catch (e) {
      screen.innerHTML = `<div class="error" style="margin:16px;">Ошибка: ${escHtml(e.message)}</div>`;
    }
  }

  async function _loadExtras(assemblyId, panel, badge, canEdit) {
    panel.innerHTML = `<div style="font-size:13px;color:var(--muted);padding:8px 0;">Загружаем…</div>`;
    try {
      const r = await _api("assembly_extras_list", { assembly_id: assemblyId });
      const items = r.extras || [];

      function renderList() {
        const total = items.reduce((s, x) => s + Number(x.amount || 0), 0);
        if (badge) badge.textContent = items.length
          ? `· ${items.length} поз. ${total > 0 ? "/ " + Math.round(total).toLocaleString("ru-RU") + " ₽" : ""}`
          : "";

        panel.innerHTML = "";

        // Список
        const STATUS_LABELS = {
          pending:  { icon: "⏳", text: "На согласовании", color: "#E67E22" },
          approved: { icon: "✅", text: "Согласовано",     color: "#27AE60" },
          rejected: { icon: "❌", text: "Отклонено",       color: "#C0392B" },
        };

        if (items.length) {
          const listEl = document.createElement("div");
          listEl.style.cssText = "margin-bottom:10px;";
          for (const item of items) {
            const itemEl = document.createElement("div");
            itemEl.style.cssText = "padding:8px 0;border-bottom:1px solid var(--border);";
            const photoUrl = item.receipt_photo
              ? `${BACKEND_URL}/api/photo/${encodeURIComponent(assemblyId)}/${encodeURIComponent(item.receipt_photo)}`
              : null;
            const sl = STATUS_LABELS[item.status] || STATUS_LABELS.pending;
            itemEl.innerHTML = `
              <div style="display:flex;gap:8px;align-items:flex-start;">
                ${photoUrl ? `<a href="${photoUrl}" target="_blank" style="flex-shrink:0;">
                  <img src="${photoUrl}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid var(--border);" loading="lazy">
                </a>` : `<div style="width:48px;height:48px;background:var(--surface);border-radius:6px;border:1px dashed var(--border);flex-shrink:0;"></div>`}
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13px;font-weight:600;color:var(--ink);">${escHtml(item.description || "—")}</div>
                  <div style="font-size:12px;color:var(--accent);margin-top:2px;">${item.amount ? Number(item.amount).toLocaleString("ru-RU") + " ₽" : "сумма не указана"}</div>
                  <div style="font-size:11px;color:${sl.color};margin-top:2px;">${sl.icon} ${sl.text}</div>
                  <div style="font-size:11px;color:var(--muted);">${escHtml(item.added_by_name || "")}</div>
                </div>
                ${canEdit ? `<button data-del="${escHtml(item.id)}" style="font-size:18px;padding:4px;background:none;border:none;cursor:pointer;color:var(--muted);">✕</button>` : ""}
              </div>
              ${(isMgr && item.status === "pending") ? `
              <div style="display:flex;gap:8px;margin-top:6px;" data-approve-row="${escHtml(item.id)}">
                <button data-act="approve" data-eid="${escHtml(item.id)}"
                        class="btn-primary" style="flex:1;font-size:12px;padding:7px;">✅ Согласовать</button>
                <button data-act="reject"  data-eid="${escHtml(item.id)}"
                        class="btn-secondary" style="flex:1;font-size:12px;padding:7px;">❌ Отклонить</button>
              </div>` : ""}
            `;
            if (canEdit) {
              itemEl.querySelector(`[data-del]`)?.addEventListener("click", async (e) => {
                if (!confirm("Удалить запись?")) return;
                const res = await _api("assembly_extra_delete", { assembly_id: assemblyId, extra_id: e.target.dataset.del });
                if (res.ok) {
                  const idx = items.findIndex(x => x.id === e.target.dataset.del);
                  if (idx >= 0) items.splice(idx, 1);
                  renderList();
                }
              });
            }
            if (isMgr) {
              itemEl.querySelectorAll("[data-act]").forEach(btn => {
                btn.addEventListener("click", async () => {
                  haptic && haptic("impact");
                  btn.disabled = true;
                  const res = await _api("assembly_extra_approve", {
                    assembly_id: assemblyId,
                    extra_id: btn.dataset.eid,
                    action: btn.dataset.act,
                  });
                  if (res.ok) {
                    const itm = items.find(x => x.id === btn.dataset.eid);
                    if (itm) itm.status = res.status;
                    renderList();
                  } else btn.disabled = false;
                });
              });
            }
            listEl.appendChild(itemEl);
          }
          // Итоги: согласовано + ожидает
          const approvedTotal = items.filter(x => x.status === "approved").reduce((s, x) => s + Number(x.amount || 0), 0);
          const pendingTotal  = items.filter(x => x.status === "pending").reduce((s, x) => s + Number(x.amount || 0), 0);
          if (total > 0) {
            const totEl = document.createElement("div");
            totEl.style.cssText = "padding:8px 0;font-size:13px;";
            totEl.innerHTML = `
              ${approvedTotal > 0 ? `<div style="display:flex;justify-content:space-between;font-weight:700;color:#27AE60;">
                <span>✅ Согласовано:</span><span>${Math.round(approvedTotal).toLocaleString("ru-RU")} ₽</span>
              </div>` : ""}
              ${pendingTotal > 0 ? `<div style="display:flex;justify-content:space-between;color:#E67E22;">
                <span>⏳ Ожидает:</span><span>${Math.round(pendingTotal).toLocaleString("ru-RU")} ₽</span>
              </div>` : ""}
            `;
            listEl.appendChild(totEl);
          }
          panel.appendChild(listEl);
        }

        if (!canEdit) return;

        // Форма добавления
        const form = document.createElement("div");
        form.innerHTML = `
          <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">+ Добавить позицию</div>
          <input id="extra-desc" type="text" placeholder="Описание (уплотнитель, крепёж…)"
                 style="width:100%;padding:9px 10px;border:1px solid var(--border);border-radius:8px;
                        background:var(--surface);color:var(--ink);font-size:13px;box-sizing:border-box;margin-bottom:6px;">
          <div style="display:flex;gap:8px;margin-bottom:6px;">
            <input id="extra-amount" type="number" min="0" step="10" placeholder="Сумма, ₽"
                   style="flex:1;padding:9px 10px;border:1px solid var(--border);border-radius:8px;
                          background:var(--surface);color:var(--ink);font-size:13px;">
            <button id="extra-receipt-btn" class="btn-secondary"
                    style="padding:9px 12px;font-size:13px;white-space:nowrap;">📸 Чек</button>
          </div>
          <input type="file" id="extra-receipt-input" accept="image/*" capture="environment" style="display:none;">
          <div id="extra-receipt-preview" style="margin-bottom:6px;"></div>
          <div id="extra-parse-status" style="font-size:12px;color:var(--accent);min-height:16px;margin-bottom:4px;"></div>
          <button id="extra-add-btn" class="btn-primary" style="width:100%;padding:10px;font-size:14px;">Добавить</button>
          <div id="extra-add-status" style="font-size:12px;color:var(--muted);min-height:16px;margin-top:4px;"></div>
        `;
        panel.appendChild(form);

        let _receiptB64 = null;
        let _receiptFn  = null;

        const receiptInput  = form.querySelector("#extra-receipt-input");
        const parseStatus   = form.querySelector("#extra-parse-status");
        const receiptPreview = form.querySelector("#extra-receipt-preview");

        form.querySelector("#extra-receipt-btn").addEventListener("click", () => receiptInput.click());

        receiptInput.addEventListener("change", async () => {
          const file = receiptInput.files[0];
          if (!file) return;
          parseStatus.textContent = "Загружаем чек…";
          _receiptFn = file.name;
          _receiptB64 = await new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = e => res(e.target.result);
            reader.onerror = rej;
            reader.readAsDataURL(file);
          });
          receiptPreview.innerHTML = `<img src="${_receiptB64}" style="max-width:100%;max-height:120px;border-radius:6px;border:1px solid var(--border);">`;
          // AI парсинг суммы
          parseStatus.textContent = "🔍 Распознаём сумму…";
          try {
            const pr = await _api("assembly_receipt_parse", { photo_b64: _receiptB64 });
            if (pr.amount && pr.amount > 0) {
              form.querySelector("#extra-amount").value = Math.round(pr.amount);
              parseStatus.textContent = `✅ Сумма распознана: ${Math.round(pr.amount).toLocaleString("ru-RU")} ₽`;
            } else {
              parseStatus.textContent = "Сумма не распознана — введите вручную";
            }
          } catch (e) {
            parseStatus.textContent = "Сумма не распознана — введите вручную";
          }
          receiptInput.value = "";
        });

        form.querySelector("#extra-add-btn").addEventListener("click", async () => {
          haptic && haptic("impact");
          const desc   = form.querySelector("#extra-desc").value.trim();
          const amount = parseFloat(form.querySelector("#extra-amount").value) || 0;
          const addStatus = form.querySelector("#extra-add-status");
          if (!desc) { form.querySelector("#extra-desc").style.borderColor = "var(--danger,red)"; return; }
          form.querySelector("#extra-desc").style.borderColor = "";
          const addBtn = form.querySelector("#extra-add-btn");
          addBtn.disabled = true; addBtn.textContent = "Сохраняем…";
          try {
            const res = await _api("assembly_extra_add", {
              assembly_id: assemblyId,
              description: desc,
              amount,
              receipt_b64: _receiptB64 || null,
            });
            if (res.ok) {
              haptic && haptic("success");
              items.push(res.extra);
              form.querySelector("#extra-desc").value = "";
              form.querySelector("#extra-amount").value = "";
              receiptPreview.innerHTML = "";
              parseStatus.textContent = "";
              _receiptB64 = null;
              renderList();
            } else {
              addStatus.textContent = res.msg || res.error;
            }
          } catch (e) { addStatus.textContent = e.message; }
          finally { addBtn.disabled = false; addBtn.textContent = "Добавить"; }
        });
      }

      renderList();
    } catch (e) {
      panel.innerHTML = `<div class="error">Ошибка: ${escHtml(e.message)}</div>`;
    }
  }

  async function _loadExpeditorList(select, currentExpTgId) {
    try {
      const res = await _api("staff_list", { role: "expeditor" });
      const list = res.staff || [];
      select.innerHTML = `<option value="">— Не назначен —</option>` +
        list.map(u => `<option value="${escHtml(u.tg_id)}"${String(u.tg_id) === String(currentExpTgId) ? " selected" : ""}>${escHtml(u.full_name || u.tg_id)}</option>`).join("");
    } catch (e) {
      select.innerHTML = `<option value="">Ошибка загрузки</option>`;
    }
  }

  return { mount };
})();
