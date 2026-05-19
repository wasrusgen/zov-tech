/* ============================================================
   StaffClients — список клиентов для сборщика / замерщика
   #/master/clients
   ============================================================ */

const StaffClients = (function () {
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
  function fmtDate(iso) {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString("ru-RU", {
        day: "numeric", month: "short", year: "numeric",
      });
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
          initData: (typeof Platform !== "undefined" ? Platform.initData : (window.tg?.initData || "")),
          initDataUnsafe: (typeof Platform !== "undefined" ? Platform.initDataUnsafe : null),
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

  const ASM_STATUS = {
    created:     { icon: "🆕", text: "Создана",       color: "#8e8e8e" },
    scheduled:   { icon: "📅", text: "Запланирована", color: "#2980B9" },
    in_progress: { icon: "🔨", text: "В процессе",    color: "#F39C12" },
    done:        { icon: "✅", text: "Завершена",      color: "#27AE60" },
    cancelled:   { icon: "❌", text: "Отменена",       color: "#C0392B" },
  };
  const MEAS_STATUS = {
    new:       { icon: "🆕", text: "Новый",        color: "#8e8e8e" },
    scheduled: { icon: "📅", text: "Назначен",     color: "#2980B9" },
    done:      { icon: "✅", text: "Выполнен",      color: "#27AE60" },
    cancelled: { icon: "❌", text: "Отменён",       color: "#C0392B" },
  };

  function _statusBadge(status, map) {
    const s = map[status] || { icon: "•", text: status, color: "#aaa" };
    return `<span style="font-size:11px;color:${s.color};white-space:nowrap;">${s.icon} ${escHtml(s.text)}</span>`;
  }

  /* ── Главный экран ─────────────────────────────────────────── */
  async function mount(container) {
    container.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    document.getElementById("bottom-nav")?.remove();

    // Header
    const h = el(`
      <header class="podbor-header">
        <button class="podbor-back" aria-label="Назад">${(window.ICONS || {}).arrow_left || "‹"}</button>
        <div class="podbor-title">Мои клиенты</div>
        <button id="reloadBtn" style="background:none;border:none;font-size:18px;cursor:pointer;padding:4px 8px;" title="Обновить">↻</button>
      </header>
    `);
    h.querySelector(".podbor-back").addEventListener("click", () => {
      haptic && haptic("impact");
      history.back();
    });

    // Фильтр
    const filterEl = el(`
      <div style="padding:0 16px 8px;display:flex;gap:8px;">
        <button class="sc-filter active" data-f="active" style="padding:6px 14px;border-radius:20px;border:1px solid var(--accent);background:var(--accent);color:#fff;font-size:12px;cursor:pointer;">Активные</button>
        <button class="sc-filter" data-f="done"   style="padding:6px 14px;border-radius:20px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:12px;cursor:pointer;">Завершённые</button>
        <button class="sc-filter" data-f="all"    style="padding:6px 14px;border-radius:20px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:12px;cursor:pointer;">Все</button>
      </div>
    `);

    const screen = el(`<div class="podbor-screen"></div>`);
    container.appendChild(h);
    container.appendChild(filterEl);
    container.appendChild(screen);

    let currentFilter = "active";

    const load = async (filter) => {
      currentFilter = filter;
      screen.innerHTML = `<div class="loader-inline"><div class="spinner"></div></div>`;
      try {
        const data = await _api("staff_clients", { filter });
        if (data.error) {
          screen.innerHTML = `<div class="error" style="margin:16px;">${escHtml(data.error)}</div>`;
          return;
        }
        _render(screen, data, container);
      } catch (e) {
        screen.innerHTML = `<div class="error" style="margin:16px;">Ошибка: ${escHtml(e.message)}</div>`;
      }
    };

    filterEl.querySelectorAll(".sc-filter").forEach(btn => {
      btn.addEventListener("click", () => {
        filterEl.querySelectorAll(".sc-filter").forEach(b => {
          b.style.background = "var(--surface)";
          b.style.color = "var(--muted)";
          b.style.borderColor = "var(--border)";
        });
        btn.style.background = "var(--accent)";
        btn.style.color = "#fff";
        btn.style.borderColor = "var(--accent)";
        haptic && haptic("selection");
        load(btn.dataset.f);
      });
    });

    h.querySelector("#reloadBtn").addEventListener("click", () => {
      haptic && haptic("impact");
      load(currentFilter);
    });

    load("active");
  }

  /* ── Рендер ─────────────────────────────────────────────────── */
  function _render(screen, data, container) {
    screen.innerHTML = "";

    const clients = data.clients || [];
    if (!clients.length) {
      screen.appendChild(el(`
        <div style="text-align:center;padding:48px 16px;color:var(--muted);">
          <div style="font-size:36px;margin-bottom:12px;">📋</div>
          <div style="font-size:14px;font-weight:600;color:var(--ink);">Клиентов нет</div>
          <div style="font-size:12px;margin-top:6px;">По выбранному фильтру ничего не найдено</div>
        </div>
      `));
      return;
    }

    // Роль-бейдж в шапке
    const roles = [];
    if (data.is_assembler) roles.push("сборщик");
    if (data.is_measurer)  roles.push("замерщик");
    if (roles.length) {
      screen.appendChild(el(`
        <div style="margin:0 16px 10px;font-size:11px;color:var(--muted);">
          ${escHtml(roles.join(" · "))} · ${clients.length} клиентов
        </div>
      `));
    }

    clients.forEach(c => {
      const asmCount  = c.assemblies.length;
      const measCount = c.measurements.length;

      // Ближайшая дата
      const dates = [
        ...c.assemblies.map(a => a.scheduled_at),
        ...c.measurements.map(m => m.scheduled_at),
      ].filter(Boolean).sort();
      const nearestDate = dates[0] || null;

      // Статусы для превью
      const asmStatuses  = c.assemblies.map(a => a.status);
      const measStatuses = c.measurements.map(m => m.status);

      const card = el(`
        <div style="margin:6px 16px;padding:14px;background:var(--surface);
                    border:1px solid var(--border);border-radius:14px;cursor:pointer;"
             role="button" tabindex="0">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:15px;font-weight:700;color:var(--ink);
                          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${escHtml(c.client_name || "Без имени")}
              </div>
              ${c.client_phone ? `<div style="font-size:12px;color:var(--muted);margin-top:2px;">${escHtml(c.client_phone)}</div>` : ""}
            </div>
            ${nearestDate ? `<div style="font-size:11px;color:var(--accent);white-space:nowrap;flex-shrink:0;font-weight:600;">${escHtml(fmtDate(nearestDate))}</div>` : ""}
          </div>

          <!-- Теги: сборки + замеры -->
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">
            ${asmCount ? c.assemblies.map(a => `
              <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;
                           background:var(--bg);border:1px solid var(--border);border-radius:10px;">
                ${_statusBadge(a.status, ASM_STATUS)}
                ${a.address ? `<span style="font-size:10px;color:var(--muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(a.address.split(",")[0])}</span>` : ""}
              </span>
            `).join("") : ""}
            ${measCount ? c.measurements.map(m => `
              <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;
                           background:var(--bg);border:1px solid #7B68EE22;border-radius:10px;">
                <span style="font-size:11px;color:#7B68EE;">📐 ${_statusBadge(m.status, MEAS_STATUS).replace(/<[^>]+>/g,'').trim()}</span>
              </span>
            `).join("") : ""}
          </div>
        </div>
      `);

      card.addEventListener("click", () => {
        haptic && haptic("impact");
        _openClientDetail(container, c, data);
      });

      screen.appendChild(card);
    });

    screen.appendChild(el(`<div style="height:32px;"></div>`));
  }

  /* ── Детальная карточка клиента ────────────────────────────── */
  function _openClientDetail(container, c, listData) {
    container.innerHTML = "";

    const h = el(`
      <header class="podbor-header">
        <button class="podbor-back" aria-label="Назад">${(window.ICONS || {}).arrow_left || "‹"}</button>
        <div class="podbor-title" style="font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${escHtml(c.client_name || "Клиент")}
        </div>
        <div style="width:32px;"></div>
      </header>
    `);
    h.querySelector(".podbor-back").addEventListener("click", () => {
      haptic && haptic("impact");
      mount(container);
    });

    const screen = el(`<div class="podbor-screen"></div>`);
    container.appendChild(h);
    container.appendChild(screen);

    // Контакты
    const phone = c.client_phone || "";
    screen.appendChild(el(`
      <div style="margin:0 16px 16px;padding:14px;background:var(--surface);
                  border:1px solid var(--border);border-radius:14px;">
        <div style="font-size:16px;font-weight:700;color:var(--ink);margin-bottom:6px;">
          ${escHtml(c.client_name || "Без имени")}
        </div>
        ${phone ? `
          <a href="tel:${escHtml(phone)}" style="display:flex;align-items:center;gap:8px;
             padding:10px 0;text-decoration:none;color:var(--accent);">
            <span style="font-size:18px;">📞</span>
            <span style="font-size:15px;font-weight:600;">${escHtml(phone)}</span>
          </a>
        ` : `<div style="font-size:12px;color:var(--muted);">Телефон не указан</div>`}
      </div>
    `));

    // Сборки
    if (c.assemblies.length) {
      screen.appendChild(el(`<div class="section-head"><span class="label">🔨 Сборки · ${c.assemblies.length}</span></div>`));
      c.assemblies.forEach(a => {
        const s = ASM_STATUS[a.status] || { icon: "•", text: a.status, color: "#aaa" };
        const needsConfirm = !a.scheduled_at && !a.confirmed_at && a.status === "created";
        const confirmDeadline = a.confirm_by ? new Date(a.confirm_by) : null;
        const isOverdue = confirmDeadline && confirmDeadline < new Date();

        const asmCard = el(`
          <div style="margin:4px 16px;padding:12px 14px;background:var(--surface);
                      border:1px solid ${needsConfirm && !isOverdue ? "var(--accent)" : "var(--border)"};
                      border-radius:12px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;cursor:pointer;" class="asm-tap">
              <div style="flex:1;">
                <div style="font-size:12px;font-weight:600;color:${s.color};">${s.icon} ${escHtml(s.text)}</div>
                ${a.address ? `<div style="font-size:12px;color:var(--muted);margin-top:2px;">${escHtml(a.address)}</div>` : ""}
                ${a.scope_of_work ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;">${escHtml(a.scope_of_work.slice(0,80))}</div>` : ""}
                ${a.date_range ? `<div style="font-size:11px;margin-top:4px;color:var(--accent);">📅 ${escHtml(a.date_range)}</div>` : ""}
              </div>
              <div style="text-align:right;flex-shrink:0;">
                ${a.scheduled_at ? `<div style="font-size:11px;color:var(--accent);font-weight:600;">${escHtml(fmtDate(a.scheduled_at))}</div>` : ""}
                ${a.confirmed_at ? `<div style="font-size:10px;color:#27AE60;margin-top:2px;">✅ Согласовано</div>` : ""}
                ${a.signed_by_name ? `<div style="font-size:10px;color:#27AE60;margin-top:2px;">✍️ Подписан</div>` : ""}
              </div>
            </div>
            ${needsConfirm ? `
              <div style="margin-top:10px;">
                ${confirmDeadline && !isOverdue ? `
                  <div id="timer-${a.id}" style="font-size:11px;color:${isOverdue ? '#C0392B':'#F39C12'};margin-bottom:6px;">
                    ⏱ Осталось: —
                  </div>
                ` : isOverdue ? `<div style="font-size:11px;color:#C0392B;margin-bottom:6px;">⚠️ Срок подтверждения истёк</div>` : ""}
                <button class="btn-primary confirm-date-btn" data-id="${escHtml(a.id)}"
                  style="width:100%;padding:10px;font-size:13px;">
                  📞 Подтвердить дату после созвона
                </button>
              </div>
            ` : ""}
          </div>
        `);

        // Переход в детальный экран по тапу
        asmCard.querySelector(".asm-tap").addEventListener("click", () => {
          haptic && haptic("impact");
          location.hash = `#/assembly/${a.id}`;
        });

        // Кнопка подтверждения
        const confirmBtn = asmCard.querySelector(".confirm-date-btn");
        if (confirmBtn) {
          confirmBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            haptic && haptic("impact");
            _openScheduleOverlay(a.id, "assembly", c.client_name, () => {
              // После подтверждения перезагружаем список
              mount(container);
            });
          });
        }

        // Таймер обратного отсчёта
        if (confirmDeadline && !isOverdue) {
          const timerEl = asmCard.querySelector(`#timer-${a.id}`);
          if (timerEl) {
            const tick = () => {
              const diff = confirmDeadline - new Date();
              if (diff <= 0) { timerEl.textContent = "⚠️ Срок истёк"; return; }
              const h = Math.floor(diff / 3600000);
              const m = Math.floor((diff % 3600000) / 60000);
              const s2 = Math.floor((diff % 60000) / 1000);
              timerEl.textContent = `⏱ Осталось: ${h}ч ${m}м ${s2}с`;
            };
            tick();
            const iv = setInterval(tick, 1000);
            // Останавливаем таймер при уходе со страницы
            const obs = new MutationObserver(() => {
              if (!document.contains(timerEl)) { clearInterval(iv); obs.disconnect(); }
            });
            obs.observe(document.body, { childList: true, subtree: true });
          }
        }

        screen.appendChild(asmCard);
      });
    }

    // Замеры
    if (c.measurements.length) {
      screen.appendChild(el(`<div class="section-head" style="margin-top:16px;"><span class="label">📐 Замеры · ${c.measurements.length}</span></div>`));
      c.measurements.forEach(m => {
        const s = MEAS_STATUS[m.status] || { icon: "•", text: m.status, color: "#aaa" };
        const needsConfirmM = !m.scheduled_at && m.status !== "done" && m.status !== "cancelled";
        const mCard = el(`
          <div style="margin:4px 16px;padding:12px 14px;background:var(--surface);
                      border:1px solid ${needsConfirmM ? "var(--accent)" : "var(--border)"};border-radius:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <div>
                <div style="font-size:12px;font-weight:600;color:${s.color};">${s.icon} ${escHtml(s.text)}</div>
                ${m.address ? `<div style="font-size:12px;color:var(--muted);margin-top:2px;">${escHtml(m.address)}</div>` : ""}
                ${m.zamer_no ? `<div style="font-size:11px;color:var(--muted);">Замер №${escHtml(m.zamer_no)}</div>` : ""}
                ${m.preferred_date ? `<div style="font-size:11px;color:var(--accent);">📅 Клиент: ${escHtml(m.preferred_date)}</div>` : ""}
              </div>
              ${m.scheduled_at ? `<div style="font-size:11px;color:var(--accent);font-weight:600;">${escHtml(fmtDate(m.scheduled_at))}</div>` : ""}
            </div>
            ${needsConfirmM ? `
              <button class="btn-primary confirm-meas-btn" data-id="${escHtml(m.id)}"
                style="width:100%;padding:10px;font-size:13px;margin-top:10px;">
                📞 Подтвердить дату замера
              </button>
            ` : ""}
          </div>
        `);
        const measConfirmBtn = mCard.querySelector(".confirm-meas-btn");
        if (measConfirmBtn) {
          measConfirmBtn.addEventListener("click", () => {
            haptic && haptic("impact");
            _openScheduleOverlay(m.id, "measurement", c.client_name, () => mount(container));
          });
        }
        screen.appendChild(mCard);
      });
    }

    screen.appendChild(el(`<div style="height:32px;"></div>`));
  }

  /* ── Оверлей выбора даты/времени ───────────────────────────── */
  function _openScheduleOverlay(itemId, type, clientName, onSuccess) {
    document.getElementById("schedule-overlay")?.remove();

    // Минимальная дата — сегодня
    const todayISO = new Date().toISOString().slice(0, 16);

    const overlay = document.createElement("div");
    overlay.id = "schedule-overlay";
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;
      display:flex;align-items:flex-end;justify-content:center;
    `;
    overlay.innerHTML = `
      <div style="width:100%;max-width:480px;background:var(--bg);border-radius:20px 20px 0 0;padding:20px 16px 32px;">
        <div style="text-align:center;font-weight:700;font-size:16px;margin-bottom:4px;">
          ${type === "assembly" ? "📅 Дата сборки" : "📅 Дата замера"}
        </div>
        <div style="text-align:center;font-size:12px;color:var(--muted);margin-bottom:16px;">
          ${escHtml(clientName)}
        </div>

        <label class="field">
          <span class="field-label">Дата и время</span>
          <input id="sc-datetime" type="datetime-local" min="${todayISO}"
            style="width:100%;padding:12px;border:1px solid var(--border);border-radius:10px;
                   background:var(--surface);color:var(--ink);font-size:15px;">
        </label>

        <label class="field" style="margin-top:10px;">
          <span class="field-label">Заметка (необязательно)</span>
          <input id="sc-note" type="text" placeholder="напр. парковка у дома..."
            style="width:100%;padding:10px;border:1px solid var(--border);border-radius:10px;
                   background:var(--surface);color:var(--ink);font-size:14px;">
        </label>

        <div id="sc-err" style="color:#C0392B;font-size:12px;margin-top:8px;min-height:16px;"></div>

        <div style="display:flex;gap:10px;margin-top:14px;">
          <button id="sc-cancel" class="btn-secondary" style="flex:1;padding:12px;">Отмена</button>
          <button id="sc-confirm" class="btn-primary" style="flex:2;padding:12px;">✅ Подтвердить</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector("#sc-cancel").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector("#sc-confirm").addEventListener("click", async () => {
      const dt = overlay.querySelector("#sc-datetime").value;
      const note = overlay.querySelector("#sc-note").value.trim();
      const errEl = overlay.querySelector("#sc-err");
      if (!dt) { errEl.textContent = "Выберите дату и время"; return; }

      const btn = overlay.querySelector("#sc-confirm");
      btn.disabled = true;
      btn.textContent = "Сохраняем…";
      errEl.textContent = "";

      try {
        const path = type === "assembly" ? "assembly_schedule" : "measurement_schedule";
        const idKey = type === "assembly" ? "assembly_id" : "measurement_id";
        const res = await _api(path, { [idKey]: itemId, scheduled_at: dt, note });
        if (res.error) throw new Error(res.error);
        haptic && haptic("success");
        overlay.remove();
        if (typeof onSuccess === "function") onSuccess();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "✅ Подтвердить";
        errEl.textContent = "Ошибка: " + e.message;
      }
    });
  }

  return { mount };
})();
