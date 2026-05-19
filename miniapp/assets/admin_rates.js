/* ============================================================
   AdminRates — управление ставками сборки
   #/admin/rates  →  список правил + форма добавления/редактирования
   Доступно только менеджеру.
   ============================================================ */

const AdminRates = (function () {
  "use strict";

  const DEFAULT_CLIENT    = 10;
  const DEFAULT_ASSEMBLER = 9;

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

  async function _api(path, body = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(`${BACKEND_URL}/api/${path}`, {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: (typeof Platform !== "undefined" ? Platform.initData : (window.tg?.initData || "")),
          initDataUnsafe: (typeof Platform !== "undefined" ? Platform.initDataUnsafe : (window.tg?.initDataUnsafe || null)),
          ...body
        }),
      });
      if (!res.ok) throw new Error(`Ошибка сервера (${res.status})`);
      return await res.json();
    } catch (e) {
      if (e.name === "AbortError") throw new Error("Сервер не отвечает");
      throw e;
    } finally { clearTimeout(t); }
  }

  /* ── Главный экран: список правил ──────────────────────────── */
  async function mount(container) {
    container.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    document.getElementById("bottom-nav")?.remove();

    // Header
    const h = el(`
      <header class="podbor-header">
        <button class="podbor-back" aria-label="Назад">${(window.ICONS || {}).arrow_left || "‹"}</button>
        <div class="podbor-title">Ставки сборки</div>
        <button id="addRateBtn" style="background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;" title="Добавить правило">＋</button>
      </header>
    `);
    h.querySelector(".podbor-back").addEventListener("click", () => {
      haptic && haptic("impact");
      history.back();
    });
    h.querySelector("#addRateBtn").addEventListener("click", () => {
      haptic && haptic("impact");
      _openForm(container, null);
    });
    container.appendChild(h);

    const screen = el(`<div class="podbor-screen"></div>`);
    screen.innerHTML = `<div class="loader-inline"><div class="spinner"></div></div>`;
    container.appendChild(screen);

    // Инфо-бэджик
    screen.innerHTML = "";
    screen.appendChild(el(`
      <div style="margin:12px 16px;padding:12px;background:var(--surface);border:1px solid var(--border);
                  border-radius:12px;font-size:13px;color:var(--muted);line-height:1.5;">
        <b style="color:var(--ink);">Как работают ставки</b><br>
        Правила применяются по приоритету: <b>конкретный сборщик</b> > <b>все сборщики</b>.<br>
        Клиент платит по ставке <b>«Клиенту»</b>, сборщик получает по ставке <b>«Сборщику»</b>.<br>
        Разница — маржа компании.
      </div>
    `));

    try {
      const data = await _api("assembly_rates_list");
      if (data.error) {
        screen.innerHTML += `<div class="error" style="margin:16px;">${escHtml(data.error)}</div>`;
        return;
      }
      _renderList(screen, container, data.rates || []);
    } catch (e) {
      screen.innerHTML += `<div class="error" style="margin:16px;">Ошибка: ${escHtml(e.message)}</div>`;
    }
  }

  function _renderList(screen, container, rates) {
    // Удаляем старый список если есть
    screen.querySelectorAll(".rates-list").forEach(n => n.remove());

    const active   = rates.filter(r => (r.active || "").toUpperCase() !== "FALSE");
    const inactive = rates.filter(r => (r.active || "").toUpperCase() === "FALSE");

    if (!active.length) {
      screen.appendChild(el(`
        <div style="text-align:center;padding:32px 16px;color:var(--muted);font-size:13px;">
          Нет активных правил.<br>Нажмите ＋ чтобы добавить.
        </div>
      `));
    }

    const list = el(`<div class="rates-list"></div>`);

    // Активные
    if (active.length) {
      list.appendChild(el(`<div class="section-head" style="margin-top:8px;"><span class="label">Активные правила</span></div>`));
      active.forEach(r => list.appendChild(_ruleCard(r, container, screen, rates, false)));
    }

    // Неактивные (свёрнуто)
    if (inactive.length) {
      const toggle = el(`
        <div style="margin:12px 16px 0;">
          <button class="btn-secondary" style="width:100%;font-size:12px;" id="showInactive">
            Показать неактивные (${inactive.length})
          </button>
        </div>
      `);
      const inactiveWrap = el(`<div style="display:none;" id="inactiveWrap"></div>`);
      inactive.forEach(r => inactiveWrap.appendChild(_ruleCard(r, container, screen, rates, true)));
      toggle.querySelector("#showInactive").addEventListener("click", function () {
        inactiveWrap.style.display = inactiveWrap.style.display === "none" ? "" : "none";
        this.textContent = inactiveWrap.style.display === "none"
          ? `Показать неактивные (${inactive.length})`
          : `Скрыть неактивные`;
      });
      list.appendChild(toggle);
      list.appendChild(inactiveWrap);
    }

    screen.appendChild(list);
  }

  function _ruleCard(r, container, screen, allRates, isInactive) {
    const cpct = parseFloat(r.client_rate_pct || DEFAULT_CLIENT).toFixed(1);
    const apct = parseFloat(r.assembler_rate_pct || DEFAULT_ASSEMBLER).toFixed(1);
    const margin = (parseFloat(cpct) - parseFloat(apct)).toFixed(1);
    const isDefault = r.assembler_tg_id === "*" && r.scope === "*";
    const who = isDefault
      ? "🌐 Все сборщики (базовая)"
      : (r.assembler_name ? `👤 ${r.assembler_name}` : `ID: ${r.assembler_tg_id}`);
    const scopeLabel = r.scope !== "*" ? ` · 🗂 ${r.scope}` : "";

    const card = el(`
      <div style="margin:8px 16px;padding:12px 14px;background:var(--surface);
                  border:1px solid var(--border);border-radius:12px;
                  opacity:${isInactive ? "0.55" : "1"};">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div style="font-size:13px;font-weight:600;color:var(--ink);">${escHtml(who)}${escHtml(scopeLabel)}</div>
          ${!isInactive ? `<button data-edit="${escHtml(r.rule_id)}"
            style="background:none;border:1px solid var(--border);border-radius:6px;
                   font-size:11px;padding:3px 8px;cursor:pointer;color:var(--muted);">✏️</button>` : ""}
        </div>
        <div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap;">
          <div style="font-size:12px;color:var(--muted);">Клиенту
            <span style="font-size:15px;font-weight:700;color:var(--ink);margin-left:4px;">${cpct}%</span>
          </div>
          <div style="font-size:12px;color:var(--muted);">Сборщику
            <span style="font-size:15px;font-weight:700;color:var(--accent);margin-left:4px;">${apct}%</span>
          </div>
          <div style="font-size:12px;color:var(--muted);">Маржа
            <span style="font-size:13px;font-weight:600;color:#27AE60;margin-left:4px;">${margin}%</span>
          </div>
        </div>
        ${r.note ? `<div style="font-size:11px;color:var(--muted);margin-top:6px;font-style:italic;">${escHtml(r.note)}</div>` : ""}
        ${!isInactive && !isDefault ? `
          <div style="margin-top:8px;">
            <button data-del="${escHtml(r.rule_id)}"
              style="background:none;border:none;font-size:11px;color:#C0392B;cursor:pointer;padding:0;">
              Деактивировать
            </button>
          </div>` : ""}
      </div>
    `);

    // Редактировать
    card.querySelector(`[data-edit]`)?.addEventListener("click", () => {
      haptic && haptic("impact");
      _openForm(container, r);
    });

    // Деактивировать
    card.querySelector(`[data-del]`)?.addEventListener("click", async () => {
      if (!confirm(`Деактивировать правило "${who}"?`)) return;
      haptic && haptic("impact");
      try {
        const res = await _api("assembly_rate_delete", { rule_id: r.rule_id });
        if (res.error) { alert("Ошибка: " + res.error); return; }
        // Перезагружаем список
        mount(container);
      } catch (e) { alert("Ошибка: " + e.message); }
    });

    return card;
  }

  /* ── Форма добавления / редактирования ─────────────────────── */
  function _openForm(container, rule) {
    // Удаляем старую форму если есть
    document.getElementById("rates-form-overlay")?.remove();

    const isEdit = !!rule;
    const overlay = el(`
      <div id="rates-form-overlay"
           style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;
                  display:flex;align-items:flex-end;">
        <div style="width:100%;max-height:92vh;overflow-y:auto;background:var(--bg);
                    border-radius:16px 16px 0 0;padding:20px 16px 32px;">
          <div style="font-size:16px;font-weight:700;color:var(--ink);margin-bottom:16px;">
            ${isEdit ? "Редактировать правило" : "Новое правило"}
          </div>

          <!-- Кто -->
          <div style="margin-bottom:12px;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
                        color:var(--muted);margin-bottom:6px;">Применять к</div>
            <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;">
              <input type="radio" name="rateWho" value="all" ${!isEdit || rule?.assembler_tg_id === "*" ? "checked" : ""}>
              Все сборщики (базовая)
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;">
              <input type="radio" name="rateWho" value="specific" ${isEdit && rule?.assembler_tg_id !== "*" ? "checked" : ""}>
              Конкретный сборщик
            </label>
          </div>

          <!-- Поля конкретного сборщика -->
          <div id="specificFields" style="display:${isEdit && rule?.assembler_tg_id !== "*" ? "" : "none"};">
            <div style="margin-bottom:10px;">
              <label style="font-size:12px;color:var(--muted);">Telegram ID сборщика</label>
              <input id="fAssemblerTgId" type="text" value="${escHtml(isEdit && rule?.assembler_tg_id !== "*" ? rule.assembler_tg_id : "")}"
                placeholder="например: 123456789"
                style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid var(--border);
                       border-radius:8px;background:var(--surface);color:var(--ink);font-size:13px;">
            </div>
            <div style="margin-bottom:10px;">
              <label style="font-size:12px;color:var(--muted);">Имя сборщика (для отображения)</label>
              <input id="fAssemblerName" type="text" value="${escHtml(isEdit ? (rule?.assembler_name || "") : "")}"
                placeholder="Иванов Иван"
                style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid var(--border);
                       border-radius:8px;background:var(--surface);color:var(--ink);font-size:13px;">
            </div>
          </div>

          <!-- Ставки -->
          <div style="display:flex;gap:12px;margin-bottom:10px;">
            <div style="flex:1;">
              <label style="font-size:12px;color:var(--muted);">Клиенту %</label>
              <input id="fClientRate" type="number" step="0.1" min="1" max="100"
                value="${isEdit ? (rule?.client_rate_pct || DEFAULT_CLIENT) : DEFAULT_CLIENT}"
                style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid var(--border);
                       border-radius:8px;background:var(--surface);color:var(--ink);font-size:15px;font-weight:700;">
            </div>
            <div style="flex:1;">
              <label style="font-size:12px;color:var(--muted);">Сборщику %</label>
              <input id="fAssemblerRate" type="number" step="0.1" min="1" max="100"
                value="${isEdit ? (rule?.assembler_rate_pct || DEFAULT_ASSEMBLER) : DEFAULT_ASSEMBLER}"
                style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid var(--border);
                       border-radius:8px;background:var(--surface);color:var(--ink);font-size:15px;font-weight:700;">
            </div>
          </div>

          <!-- Живая маржа -->
          <div id="marginPreview" style="text-align:center;padding:8px;margin-bottom:12px;
               background:var(--surface-2,var(--surface));border-radius:8px;font-size:12px;color:var(--muted);">
            Маржа: <b id="marginVal">1%</b>
          </div>

          <!-- Примечание -->
          <div style="margin-bottom:16px;">
            <label style="font-size:12px;color:var(--muted);">Примечание (необязательно)</label>
            <input id="fNote" type="text" value="${escHtml(isEdit ? (rule?.note || "") : "")}"
              placeholder="Например: сезонная ставка"
              style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid var(--border);
                     border-radius:8px;background:var(--surface);color:var(--ink);font-size:13px;">
          </div>

          <div id="formErr" style="color:#C0392B;font-size:13px;margin-bottom:8px;display:none;"></div>

          <div style="display:flex;gap:10px;">
            <button id="fCancel" class="btn-secondary" style="flex:1;">Отмена</button>
            <button id="fSave" class="btn-primary" style="flex:2;">
              ${isEdit ? "Сохранить" : "Создать правило"}
            </button>
          </div>
        </div>
      </div>
    `);

    // Показываем/скрываем поля конкретного сборщика
    overlay.querySelectorAll('input[name="rateWho"]').forEach(radio => {
      radio.addEventListener("change", () => {
        const specificFields = overlay.querySelector("#specificFields");
        specificFields.style.display = radio.value === "specific" ? "" : "none";
      });
    });

    // Живая маржа
    const updateMargin = () => {
      const c = parseFloat(overlay.querySelector("#fClientRate").value) || 0;
      const a = parseFloat(overlay.querySelector("#fAssemblerRate").value) || 0;
      const m = (c - a).toFixed(1);
      const el_ = overlay.querySelector("#marginVal");
      if (el_) {
        el_.textContent = m + "%";
        el_.style.color = parseFloat(m) >= 0 ? "#27AE60" : "#C0392B";
      }
    };
    overlay.querySelector("#fClientRate").addEventListener("input", updateMargin);
    overlay.querySelector("#fAssemblerRate").addEventListener("input", updateMargin);
    updateMargin();

    // Отмена
    overlay.querySelector("#fCancel").addEventListener("click", () => {
      haptic && haptic("impact");
      overlay.remove();
    });
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

    // Сохранить
    overlay.querySelector("#fSave").addEventListener("click", async () => {
      const errEl = overlay.querySelector("#formErr");
      errEl.style.display = "none";

      const whoVal = overlay.querySelector('input[name="rateWho"]:checked')?.value || "all";
      const assemblerTgId = whoVal === "specific"
        ? (overlay.querySelector("#fAssemblerTgId").value || "").trim()
        : "*";
      const assemblerName = whoVal === "specific"
        ? (overlay.querySelector("#fAssemblerName").value || "").trim()
        : "Все сборщики";

      if (whoVal === "specific" && !assemblerTgId) {
        errEl.textContent = "Укажите Telegram ID сборщика";
        errEl.style.display = "";
        return;
      }

      const clientRate   = parseFloat(overlay.querySelector("#fClientRate").value);
      const assemblerRate = parseFloat(overlay.querySelector("#fAssemblerRate").value);
      if (isNaN(clientRate) || isNaN(assemblerRate)) {
        errEl.textContent = "Укажите ставки";
        errEl.style.display = "";
        return;
      }
      if (assemblerRate > clientRate) {
        errEl.textContent = "Ставка сборщика не может быть больше ставки клиента";
        errEl.style.display = "";
        return;
      }

      const saveBtn = overlay.querySelector("#fSave");
      saveBtn.disabled = true;
      saveBtn.textContent = "Сохраняем...";

      try {
        const res = await _api("assembly_rate_save", {
          rule_id: isEdit ? rule.rule_id : "",
          assembler_tg_id: assemblerTgId,
          assembler_name:  assemblerName,
          scope: "*",
          client_rate_pct:    clientRate,
          assembler_rate_pct: assemblerRate,
          note: (overlay.querySelector("#fNote").value || "").trim(),
        });
        if (res.error) {
          errEl.textContent = res.msg || res.error;
          errEl.style.display = "";
          saveBtn.disabled = false;
          saveBtn.textContent = isEdit ? "Сохранить" : "Создать правило";
          return;
        }
        haptic && haptic("success");
        overlay.remove();
        mount(container); // перезагружаем список
      } catch (e) {
        errEl.textContent = "Сеть: " + e.message;
        errEl.style.display = "";
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? "Сохранить" : "Создать правило";
      }
    });

    document.body.appendChild(overlay);
  }

  return { mount };
})();
