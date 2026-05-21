/* ============================================================
   Акт №4 — приёмка товара (экспедитор / сборщик)
   #/assembly/:id/act4
   ============================================================ */

const Act4Screen = (function () {
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

  async function _api(path, body = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(`${BACKEND_URL}/api/${path}`, {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: typeof Platform !== "undefined" ? Platform.initData : (window.tg?.initData || ""),
          initDataUnsafe: typeof Platform !== "undefined" ? Platform.initDataUnsafe : null,
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

  // Состояние акта
  let _state = {
    act_num: "", act_date: "", supplier: "", notes: "",
    items: [],  // [{id, name, qty, condition, note}]
    signed_by_name: "", signed_by_phone: "", signed_via: "",
  };
  let _data = {};  // данные с сервера
  let _container = null;
  let _assemblyId = "";

  function _itemId() {
    return "i" + Math.random().toString(36).slice(2, 8);
  }

  /* ── Главный mount ──────────────────────────────────────────── */
  async function mount(container, assemblyId) {
    _container = container;
    _assemblyId = assemblyId;
    container.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    document.getElementById("bottom-nav")?.remove();

    const h = el(`
      <header class="podbor-header">
        <button class="podbor-back">${(window.ICONS || {}).arrow_left || "‹"}</button>
        <div class="podbor-title">Акт №4 · Приёмка товара</div>
        <div style="width:36px"></div>
      </header>
    `);
    h.querySelector(".podbor-back").addEventListener("click", () => { haptic && haptic("impact"); history.back(); });
    container.appendChild(h);

    const screen = el(`<div class="podbor-screen" style="padding-bottom:32px;"></div>`);
    screen.innerHTML = `<div class="loader-inline"><div class="spinner"></div></div>`;
    container.appendChild(screen);

    try {
      const d = await _api("act4_preview", { assembly_id: assemblyId });
      if (d.error) { screen.innerHTML = `<div class="error" style="margin:16px;">${escHtml(d.error)}</div>`; return; }
      _data = d;
      _state = {
        act_num:  d.act_num  || `${assemblyId}-4`,
        act_date: d.act_date || new Date().toISOString().slice(0, 10),
        supplier: d.supplier || "",
        notes:    d.notes    || "",
        items:    (d.items || []).map(it => ({ ...it, id: it.id || _itemId() })),
        signed_by_name:  d.signed_by_name  || "",
        signed_by_phone: d.signed_by_phone || "",
        signed_via:      d.signed_via      || "",
      };
      _render(screen, d.is_signed);
    } catch (e) {
      screen.innerHTML = `<div class="error" style="margin:16px;">Ошибка: ${escHtml(e.message)}</div>`;
    }
  }

  /* ── Рендер ─────────────────────────────────────────────────── */
  function _render(screen, isSigned) {
    screen.innerHTML = "";

    // Баннер если подписан
    if (isSigned) {
      screen.appendChild(el(`
        <div style="margin:12px 16px;padding:12px 14px;background:#27AE6015;
                    border:1px solid #27AE60;border-radius:12px;">
          <div style="font-size:13px;font-weight:700;color:#27AE60;">✅ Акт подписан</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;">
            ${escHtml(_state.signed_by_name)}
            ${_state.signed_at ? " · " + escHtml(new Date(_state.signed_at).toLocaleDateString("ru-RU")) : ""}
          </div>
        </div>
      `));
    }

    // Данные клиента
    screen.appendChild(el(`
      <div style="margin:12px 16px 0;padding:12px;background:var(--surface);
                  border:1px solid var(--border);border-radius:12px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;
                    letter-spacing:.06em;color:var(--muted);margin-bottom:8px;">Клиент</div>
        <div style="font-size:14px;font-weight:600;color:var(--ink);">${escHtml(_data.client_name || "—")}</div>
        ${_data.address ? `<div style="font-size:12px;color:var(--muted);margin-top:2px;">${escHtml(_data.address)}</div>` : ""}
      </div>
    `));

    // Реквизиты акта
    const reqs = el(`
      <div style="margin:12px 16px 0;padding:0 12px;background:var(--surface);
                  border:1px solid var(--border);border-radius:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:12px;color:var(--muted);">Номер акта</div>
          <input id="a4-num" value="${escHtml(_state.act_num)}" ${isSigned ? "disabled" : ""}
                 style="border:none;background:transparent;text-align:right;font-size:13px;
                        font-weight:500;color:var(--ink);width:140px;padding:0;">
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:12px;color:var(--muted);">Дата</div>
          <input id="a4-date" type="date" value="${escHtml(_state.act_date)}" ${isSigned ? "disabled" : ""}
                 style="border:none;background:transparent;text-align:right;font-size:13px;
                        font-weight:500;color:var(--ink);">
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;">
          <div style="font-size:12px;color:var(--muted);">Поставщик</div>
          <input id="a4-supplier" value="${escHtml(_state.supplier)}" placeholder="Название магазина/склада"
                 ${isSigned ? "disabled" : ""}
                 style="border:none;background:transparent;text-align:right;font-size:13px;
                        color:var(--ink);width:180px;padding:0;">
        </div>
      </div>
    `);
    screen.appendChild(reqs);

    if (!isSigned) {
      reqs.querySelector("#a4-num").addEventListener("input",      e => { _state.act_num  = e.target.value; });
      reqs.querySelector("#a4-date").addEventListener("change",    e => { _state.act_date = e.target.value; });
      reqs.querySelector("#a4-supplier").addEventListener("input", e => { _state.supplier = e.target.value; });
    }

    // === Список позиций ===
    const itemsHead = el(`
      <div style="display:flex;justify-content:space-between;align-items:center;
                  margin:16px 16px 0;padding-bottom:6px;border-bottom:1px solid var(--border);">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;
                    letter-spacing:.06em;color:var(--muted);">Позиции</div>
        ${!isSigned ? `<button id="a4-add-item" style="background:none;border:none;cursor:pointer;
            font-size:13px;font-weight:600;color:var(--accent);padding:4px 8px;">+ Добавить</button>` : ""}
      </div>
    `);
    screen.appendChild(itemsHead);

    const itemsList = el(`<div id="a4-items-list" style="margin:0 16px;"></div>`);
    screen.appendChild(itemsList);
    _renderItemsList(itemsList, isSigned);

    if (!isSigned) {
      itemsHead.querySelector("#a4-add-item")?.addEventListener("click", () => {
        haptic && haptic("impact");
        _state.items.push({ id: _itemId(), name: "", qty: 1, condition: "ok", note: "" });
        _renderItemsList(itemsList, false);
      });
    }

    // Итог
    const totalEl = el(`<div id="a4-total" style="margin:8px 16px 0;"></div>`);
    screen.appendChild(totalEl);
    _renderTotal(totalEl);

    // Примечание
    const noteWrap = el(`
      <div style="margin:12px 16px 0;">
        <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Примечания</div>
        <textarea id="a4-notes" rows="2" ${isSigned ? "disabled" : ""}
                  placeholder="Общие замечания по доставке…"
                  style="width:100%;box-sizing:border-box;padding:10px;
                         border:1px solid var(--border);border-radius:10px;
                         background:var(--surface);color:var(--ink);font-size:13px;
                         resize:none;">${escHtml(_state.notes)}</textarea>
      </div>
    `);
    screen.appendChild(noteWrap);
    if (!isSigned) {
      noteWrap.querySelector("#a4-notes").addEventListener("input", e => { _state.notes = e.target.value; });
    }

    // Блок подписи
    if (!isSigned) {
      const signWrap = el(`
        <div style="margin:16px 16px 0;padding:14px;background:var(--surface);
                    border:1px solid var(--border);border-radius:12px;">
          <div style="font-size:12px;color:var(--muted);margin-bottom:10px;font-weight:600;">
            Подпись принявшего
          </div>
          <div style="margin-bottom:8px;">
            <input id="a4-sign-name" placeholder="ФИО принявшего"
                   value="${escHtml(_state.signed_by_name)}"
                   style="width:100%;box-sizing:border-box;padding:10px;
                          border:1px solid var(--border);border-radius:8px;
                          background:var(--surface);color:var(--ink);font-size:14px;">
          </div>
          <div>
            <input id="a4-sign-phone" placeholder="Телефон (необязательно)"
                   type="tel" value="${escHtml(_state.signed_by_phone)}"
                   style="width:100%;box-sizing:border-box;padding:10px;
                          border:1px solid var(--border);border-radius:8px;
                          background:var(--surface);color:var(--ink);font-size:14px;">
          </div>
        </div>
      `);
      screen.appendChild(signWrap);
      signWrap.querySelector("#a4-sign-name").addEventListener("input",  e => { _state.signed_by_name  = e.target.value; });
      signWrap.querySelector("#a4-sign-phone").addEventListener("input", e => { _state.signed_by_phone = e.target.value; });

      // Кнопки
      const btns = el(`
        <div style="margin:12px 16px 0;display:flex;gap:10px;">
          <button id="a4-save-btn" class="btn-secondary" style="flex:1;padding:12px;font-size:14px;">
            💾 Сохранить
          </button>
          <button id="a4-sign-btn" class="btn-primary" style="flex:2;padding:12px;font-size:14px;">
            ✅ Подтвердить приёмку
          </button>
        </div>
      `);
      screen.appendChild(btns);
      const statusEl = el(`<div id="a4-status" style="margin:8px 16px;font-size:12px;text-align:center;color:var(--muted);"></div>`);
      screen.appendChild(statusEl);

      btns.querySelector("#a4-save-btn").addEventListener("click",  () => _doSave(false, statusEl));
      btns.querySelector("#a4-sign-btn").addEventListener("click",  () => _doSave(true,  statusEl));
    }
  }

  /* ── Список позиций ─────────────────────────────────────────── */
  function _renderItemsList(container, isSigned) {
    container.innerHTML = "";

    if (!_state.items.length) {
      container.appendChild(el(`
        <div style="padding:16px 0;text-align:center;color:var(--muted);font-size:13px;">
          ${isSigned ? "Позиции не добавлены" : "Нажмите «+ Добавить» чтобы внести позиции"}
        </div>
      `));
      return;
    }

    _state.items.forEach((item, idx) => {
      const row = el(`
        <div data-item-id="${item.id}"
             style="padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <input class="it-name" placeholder="Наименование (шкаф, столешница…)"
                   value="${escHtml(item.name)}" ${isSigned ? "disabled" : ""}
                   style="flex:1;border:1px solid var(--border);border-radius:8px;
                          padding:8px 10px;background:var(--surface);color:var(--ink);font-size:13px;">
            ${!isSigned ? `<button class="it-del" style="background:none;border:none;cursor:pointer;
                font-size:18px;color:var(--muted);padding:4px;">✕</button>` : ""}
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <div style="flex:1;">
              <div style="font-size:11px;color:var(--muted);margin-bottom:3px;">Кол-во</div>
              <input class="it-qty" type="number" min="1" value="${escHtml(String(item.qty || 1))}"
                     ${isSigned ? "disabled" : ""}
                     style="width:60px;border:1px solid var(--border);border-radius:8px;
                            padding:7px 8px;background:var(--surface);color:var(--ink);font-size:13px;">
            </div>
            <div style="flex:2;">
              <div style="font-size:11px;color:var(--muted);margin-bottom:3px;">Состояние</div>
              <div class="it-cond-wrap" style="display:flex;gap:6px;">
                <button class="cond-btn ${item.condition !== "damaged" ? "cond-active-ok" : ""}"
                        data-cond="ok" ${isSigned ? "disabled" : ""}
                        style="flex:1;padding:7px;border-radius:8px;font-size:12px;font-weight:600;
                               border:1px solid ${item.condition !== "damaged" ? "#27AE60" : "var(--border)"};
                               background:${item.condition !== "damaged" ? "#27AE6015" : "var(--surface)"};
                               color:${item.condition !== "damaged" ? "#27AE60" : "var(--muted)"};cursor:pointer;">
                  ✅ Цело
                </button>
                <button class="cond-btn ${item.condition === "damaged" ? "cond-active-dmg" : ""}"
                        data-cond="damaged" ${isSigned ? "disabled" : ""}
                        style="flex:1;padding:7px;border-radius:8px;font-size:12px;font-weight:600;
                               border:1px solid ${item.condition === "damaged" ? "#E74C3C" : "var(--border)"};
                               background:${item.condition === "damaged" ? "#E74C3C15" : "var(--surface)"};
                               color:${item.condition === "damaged" ? "#E74C3C" : "var(--muted)"};cursor:pointer;">
                  ⚠️ Повреждено
                </button>
              </div>
            </div>
          </div>
          ${item.condition === "damaged" && !isSigned ? `
          <div style="margin-top:6px;">
            <input class="it-note" placeholder="Описание повреждения…"
                   value="${escHtml(item.note || "")}"
                   style="width:100%;box-sizing:border-box;border:1px solid #E74C3C;border-radius:8px;
                          padding:7px 10px;background:var(--surface);color:var(--ink);font-size:12px;">
          </div>` : (item.note && isSigned ? `<div style="font-size:12px;color:#E74C3C;margin-top:4px;">${escHtml(item.note)}</div>` : "")}
        </div>
      `);

      if (!isSigned) {
        row.querySelector(".it-name").addEventListener("input", e => {
          _state.items[idx].name = e.target.value;
        });
        row.querySelector(".it-qty").addEventListener("input", e => {
          _state.items[idx].qty = parseInt(e.target.value) || 1;
          _renderTotal(document.getElementById("a4-total"));
        });
        row.querySelector(".it-del").addEventListener("click", () => {
          haptic && haptic("impact");
          _state.items.splice(idx, 1);
          _renderItemsList(container, false);
          _renderTotal(document.getElementById("a4-total"));
        });
        row.querySelectorAll(".cond-btn").forEach(btn => {
          btn.addEventListener("click", () => {
            haptic && haptic("selection");
            _state.items[idx].condition = btn.dataset.cond;
            _renderItemsList(container, false);
            _renderTotal(document.getElementById("a4-total"));
          });
        });
        row.querySelector(".it-note")?.addEventListener("input", e => {
          _state.items[idx].note = e.target.value;
        });
      }

      container.appendChild(row);
    });
  }

  function _renderTotal(container) {
    if (!container) return;
    const total   = _state.items.reduce((s, it) => s + (parseInt(it.qty) || 1), 0);
    const damaged = _state.items.filter(it => it.condition === "damaged")
                                .reduce((s, it) => s + (parseInt(it.qty) || 1), 0);
    container.innerHTML = damaged > 0
      ? `<div style="padding:10px 0;font-size:13px;color:#E74C3C;font-weight:600;">
           Итого: ${total} позиций · <span style="color:#E74C3C;">⚠️ Повреждений: ${damaged}</span>
         </div>`
      : `<div style="padding:10px 0;font-size:13px;color:var(--muted);">
           Итого: ${total} позиций · ✅ Без повреждений
         </div>`;
  }

  /* ── Сохранение / подпись ───────────────────────────────────── */
  async function _doSave(withSign, statusEl) {
    haptic && haptic("impact");
    if (withSign && !_state.signed_by_name.trim()) {
      if (statusEl) { statusEl.style.color = "#E74C3C"; statusEl.textContent = "Укажите ФИО принявшего"; }
      return;
    }
    if (statusEl) { statusEl.style.color = "var(--muted)"; statusEl.textContent = "Сохраняем…"; }

    const payload = {
      assembly_id:     _assemblyId,
      act_num:         _state.act_num,
      act_date:        _state.act_date,
      supplier:        _state.supplier,
      items:           _state.items,
      notes:           _state.notes,
    };
    if (withSign) {
      payload.signed_by_name  = _state.signed_by_name;
      payload.signed_by_phone = _state.signed_by_phone;
      payload.signed_via      = "manual";
    }

    try {
      const res = await _api("act4_save", payload);
      if (res.error) {
        if (statusEl) { statusEl.style.color = "#E74C3C"; statusEl.textContent = "Ошибка: " + res.error; }
        return;
      }
      if (withSign) {
        // Перезагружаем экран — покажет баннер «Подписан»
        mount(_container, _assemblyId);
      } else {
        if (statusEl) { statusEl.style.color = "#27AE60"; statusEl.textContent = "✅ Сохранено"; }
        setTimeout(() => { if (statusEl) statusEl.textContent = ""; }, 3000);
      }
    } catch (e) {
      if (statusEl) { statusEl.style.color = "#E74C3C"; statusEl.textContent = "Ошибка: " + e.message; }
    }
  }

  return { mount };
})();
