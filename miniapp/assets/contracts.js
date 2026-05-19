/* ============================================================
   Contracts — предпросмотр и подпись акта сдачи-приёмки №3
   mount(container, assemblyId)  |  route: #/assembly/:id/contract
   ============================================================ */

const Contracts = (function () {
  "use strict";

  /* ── Утилиты ─────────────────────────────────────────────── */
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
    const num = parseFloat(n) || 0;
    return num.toLocaleString("ru-RU", { minimumFractionDigits: 0 }) + " р.";
  }
  function today() {
    return new Date().toISOString().slice(0, 10);
  }
  function fmtDateParts(dateStr) {
    // "2026-05-19" → { day:"19", month:"мая", year:"2026" }
    if (!dateStr) {
      const d = new Date();
      dateStr = d.toISOString().slice(0, 10);
    }
    const months = [
      "января","февраля","марта","апреля","мая","июня",
      "июля","августа","сентября","октября","ноября","декабря"
    ];
    try {
      const parts = dateStr.split("-");
      return {
        day: String(parseInt(parts[2])),
        month: months[parseInt(parts[1]) - 1] || parts[1],
        year: parts[0],
      };
    } catch { return { day: "—", month: "—", year: "—" }; }
  }

  /* ── API ─────────────────────────────────────────────────── */
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
      if (e.name === "AbortError") throw new Error("Сервер не отвечает, попробуй ещё раз");
      throw e;
    } finally { clearTimeout(t); }
  }

  /* ── Шаблон акта ─────────────────────────────────────────── */
  function buildActHtml(fields) {
    const {
      contract_num, contract_date, client_name, address,
      total_sum, assembly_price, travel_spb, travel_outside, tech_list,
    } = fields;

    const dp = fmtDateParts(contract_date);
    const totalFmt    = fmtMoney(total_sum);
    const asmFmt      = fmtMoney(assembly_price);
    const spbFmt      = fmtMoney(travel_spb);
    const outsideFmt  = fmtMoney(travel_outside);

    const techBlock = tech_list && tech_list.trim()
      ? `<p style="margin:10px 0 4px;"><strong>Перечень техники, подлежащей бесплатной установке:</strong></p>
         <p style="white-space:pre-wrap;margin:0 0 10px;">${escHtml(tech_list.trim())}</p>`
      : "";

    return `
      <div style="font-family:'Courier New',Courier,monospace;font-size:13px;line-height:1.65;
                  color:var(--ink);padding:20px 22px;background:var(--surface);
                  border:1px solid var(--border);border-radius:10px;word-break:break-word;">

        <div style="text-align:center;margin-bottom:16px;">
          <strong style="font-size:15px;">АКТ СДАЧИ-ПРИЁМКИ РАБОТ</strong><br>
          <span>по договору на сборку и установку мебели</span><br>
          <span>№${escHtml(contract_num)} от ${escHtml(dp.day)} ${escHtml(dp.month)} ${escHtml(dp.year)} г.</span>
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:4px;">
          <span>г. Санкт-Петербург</span>
          <span>«${escHtml(dp.day)}» ${escHtml(dp.month)} ${escHtml(dp.year)} г.</span>
        </div>

        <p style="margin:0 0 12px;">
          Индивидуальный предприниматель, именуемый в дальнейшем «Исполнитель», с одной стороны
          и <strong>${escHtml(client_name || "—")}</strong>, именуемый(ая) в дальнейшем «Заказчик»
          с другой стороны, составили настоящий акт сдачи-приёмки работ о нижеследующем:
        </p>

        <p style="margin:0 0 12px;">
          Работы по установке мебели на объекте Заказчика по адресу: <strong>${escHtml(address || "—")}</strong>
          по договору №${escHtml(contract_num)} от ${escHtml(dp.day)} ${escHtml(dp.month)} ${escHtml(dp.year)} г.,
          на общую сумму <strong>${escHtml(totalFmt)}</strong>,
          выполнены Исполнителем в полном объёме надлежащего качества.
        </p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:13px;">
          <tr>
            <td style="padding:3px 0;">Стоимость услуг по сборке и установке:</td>
            <td style="text-align:right;white-space:nowrap;">${escHtml(asmFmt)}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;">Стоимость выезда сборщика по СПб:</td>
            <td style="text-align:right;white-space:nowrap;">${escHtml(spbFmt)}</td>
          </tr>
          <tr>
            <td style="padding:3px 0;">Стоимость выезда сборщика за пределы условной границы СПб:</td>
            <td style="text-align:right;white-space:nowrap;">${escHtml(outsideFmt)}</td>
          </tr>
        </table>

        <p style="margin:0 0 12px;">
          Стороны не имеют претензий друг к другу по исполнению Договора, в том числе
          по срокам выполнения работ, качеству и объёму работ.<br>
          Настоящий акт составлен в двух экземплярах.
        </p>

        ${techBlock}

        <p style="margin:12px 0 8px;font-size:12px;color:#c0392b;font-weight:bold;">
          ВНИМАНИЕ! Перед подписанием акта тщательно осмотрите мебель на предмет возможных
          недостатков. После подписания акта приёмки претензии по качеству не принимаются.
        </p>

        <p style="margin:0 0 16px;font-size:12px;">
          При наличии вопросов обращайтесь в отдел сервиса: +7-952-379-63-25
        </p>

        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-top:8px;">
          <div>ЗАКАЗЧИК _________________ / ${escHtml(client_name || "—")}</div>
          <div>ИСПОЛНИТЕЛЬ _______________ / Васильев Р.Г.</div>
        </div>

        <div style="margin-top:16px;text-align:right;">
          <button id="printActBtn" style="background:none;border:none;color:var(--accent);
                  font-size:13px;cursor:pointer;text-decoration:underline;padding:0;">
            📄 Предпросмотр акта
          </button>
        </div>
      </div>
    `;
  }

  /* ── Главный экран ─────────────────────────────────────────── */
  async function mount(container, assemblyId) {
    // Читаем id из параметра или из хэша
    const asmId = assemblyId || location.hash.split("/").pop();

    container.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    document.getElementById("bottom-nav")?.remove();

    /* Заголовок */
    const header = el(`
      <header class="podbor-header">
        <button class="podbor-back" aria-label="Назад">${(window.ICONS || {}).arrow_left || "‹"}</button>
        <div class="podbor-title">Акт сдачи-приёмки</div>
        <div style="width:32px;"></div>
      </header>
    `);
    header.querySelector(".podbor-back").addEventListener("click", () => {
      haptic && haptic("impact");
      history.back();
    });

    const screen = el(`<div class="podbor-screen" style="padding:12px 14px 40px;"></div>`);
    container.appendChild(header);
    container.appendChild(screen);

    /* Loader */
    screen.innerHTML = `<div class="loader-inline"><div class="spinner"></div>
      <div style="margin-top:8px;font-size:12px;color:var(--muted);">Загружаем данные…</div></div>`;

    /* Загружаем данные */
    let data;
    try {
      data = await _api("contract_preview", { assembly_id: asmId });
    } catch (e) {
      screen.innerHTML = `<div style="padding:24px;text-align:center;color:#e74c3c;">
        Ошибка загрузки:<br>${escHtml(e.message)}</div>`;
      return;
    }
    if (!data.ok) {
      screen.innerHTML = `<div style="padding:24px;text-align:center;color:#e74c3c;">
        ${escHtml(data.error || "Не удалось загрузить данные")}</div>`;
      return;
    }

    const asm      = data.assembly || {};
    const contract = data.contract || {};

    /* Начальные значения редактируемых полей */
    let extras = {
      contract_num:    contract.contract_num  || String(asmId),
      contract_date:   contract.contract_date || today(),
      travel_spb:      contract.travel_spb    != null ? contract.travel_spb    : 0,
      travel_outside:  contract.travel_outside != null ? contract.travel_outside : 0,
      tech_list:       contract.tech_list     || "",
    };

    /* Вычисляем total_sum */
    function calcTotal() {
      return (parseFloat(asm.assembly_price) || 0)
           + (parseFloat(extras.travel_spb) || 0)
           + (parseFloat(extras.travel_outside) || 0);
    }

    /* Рендерим всё */
    function render() {
      screen.innerHTML = "";

      /* === Блок: Акт === */
      const actSection = el(`<div></div>`);
      actSection.innerHTML = buildActHtml({
        contract_num:    extras.contract_num,
        contract_date:   extras.contract_date,
        client_name:     asm.client_name || "",
        address:         asm.address     || "",
        total_sum:       calcTotal(),
        assembly_price:  asm.assembly_price || 0,
        travel_spb:      extras.travel_spb,
        travel_outside:  extras.travel_outside,
        tech_list:       extras.tech_list,
      });
      actSection.querySelector("#printActBtn")?.addEventListener("click", () => {
        window.print();
      });
      screen.appendChild(actSection);

      /* === Блок: Статус подписи === */
      if (asm.signed_by_name) {
        const signedBadge = el(`
          <div style="margin-top:16px;padding:12px 16px;background:#eafaf1;border:1px solid #27ae60;
                      border-radius:10px;display:flex;align-items:center;gap:10px;font-size:13px;color:#1e8449;">
            <span style="font-size:20px;">✅</span>
            <div>
              <div><strong>Акт подписан</strong></div>
              <div style="color:var(--muted);font-size:12px;">
                ${escHtml(asm.signed_by_name)}
                ${asm.signed_at ? " · " + escHtml(asm.signed_at) : ""}
              </div>
            </div>
          </div>
        `);
        screen.appendChild(signedBadge);
      }

      /* === Блок: Дополнительные данные === */
      const extrasSection = el(`
        <div style="margin-top:20px;">
          <div class="section-head" style="font-size:12px;color:var(--muted);
               text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">
            ✏️ Дополнительные данные
          </div>

          <div class="field" style="margin-bottom:12px;">
            <label class="field-label" style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">
              Номер договора
            </label>
            <input id="inp_contract_num" type="text"
              value="${escHtml(extras.contract_num)}"
              style="width:100%;box-sizing:border-box;padding:9px 12px;
                     border:1px solid var(--border);border-radius:8px;
                     background:var(--surface);color:var(--ink);font-size:14px;">
          </div>

          <div class="field" style="margin-bottom:12px;">
            <label class="field-label" style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">
              Дата договора
            </label>
            <input id="inp_contract_date" type="date"
              value="${escHtml(extras.contract_date)}"
              style="width:100%;box-sizing:border-box;padding:9px 12px;
                     border:1px solid var(--border);border-radius:8px;
                     background:var(--surface);color:var(--ink);font-size:14px;">
          </div>

          <div class="field" style="margin-bottom:12px;">
            <label class="field-label" style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">
              Стоимость выезда по СПб (₽)
            </label>
            <input id="inp_travel_spb" type="number" min="0" step="100"
              value="${escHtml(String(extras.travel_spb))}"
              style="width:100%;box-sizing:border-box;padding:9px 12px;
                     border:1px solid var(--border);border-radius:8px;
                     background:var(--surface);color:var(--ink);font-size:14px;">
          </div>

          <div class="field" style="margin-bottom:12px;">
            <label class="field-label" style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">
              Стоимость выезда за пределы СПб (₽)
            </label>
            <input id="inp_travel_outside" type="number" min="0" step="100"
              value="${escHtml(String(extras.travel_outside))}"
              style="width:100%;box-sizing:border-box;padding:9px 12px;
                     border:1px solid var(--border);border-radius:8px;
                     background:var(--surface);color:var(--ink);font-size:14px;">
          </div>

          <div class="field" style="margin-bottom:16px;">
            <label class="field-label" style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">
              Перечень техники для бесплатной установки (необязательно)
            </label>
            <textarea id="inp_tech_list" rows="3"
              placeholder="Например: стиральная машина, посудомойка…"
              style="width:100%;box-sizing:border-box;padding:9px 12px;
                     border:1px solid var(--border);border-radius:8px;
                     background:var(--surface);color:var(--ink);font-size:14px;
                     resize:vertical;">${escHtml(extras.tech_list)}</textarea>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button id="btnSave" class="btn-secondary"
              style="flex:1;min-width:120px;padding:11px 0;border-radius:10px;
                     font-size:14px;font-weight:600;cursor:pointer;">
              Сохранить
            </button>
            ${!asm.signed_by_name ? `
            <button id="btnSign" class="btn-primary"
              style="flex:1;min-width:140px;padding:11px 0;border-radius:10px;
                     font-size:14px;font-weight:600;cursor:pointer;">
              ✍️ Подписать акт
            </button>` : ""}
          </div>

          <div id="saveStatus" style="margin-top:10px;font-size:13px;min-height:18px;"></div>
        </div>
      `);
      screen.appendChild(extrasSection);

      /* === Обработчики изменений — live-обновление акта === */
      const liveInputs = [
        ["inp_contract_num",   "contract_num",   false],
        ["inp_contract_date",  "contract_date",  false],
        ["inp_travel_spb",     "travel_spb",     true],
        ["inp_travel_outside", "travel_outside", true],
        ["inp_tech_list",      "tech_list",      false],
      ];
      liveInputs.forEach(([id, key, isNum]) => {
        const inp = screen.querySelector("#" + id);
        if (!inp) return;
        inp.addEventListener("input", () => {
          extras[key] = isNum ? (parseFloat(inp.value) || 0) : inp.value;
          // Обновляем только акт, не весь экран (чтобы не потерять фокус ввода)
          const actDiv = actSection.querySelector("div");
          if (actDiv) {
            const newInner = buildActHtml({
              contract_num:   extras.contract_num,
              contract_date:  extras.contract_date,
              client_name:    asm.client_name || "",
              address:        asm.address     || "",
              total_sum:      calcTotal(),
              assembly_price: asm.assembly_price || 0,
              travel_spb:     extras.travel_spb,
              travel_outside: extras.travel_outside,
              tech_list:      extras.tech_list,
            });
            const tmp = document.createElement("div");
            tmp.innerHTML = newInner;
            const newActDiv = tmp.firstElementChild;
            actDiv.replaceWith(newActDiv);
            newActDiv.querySelector("#printActBtn")?.addEventListener("click", () => window.print());
          }
        });
      });

      /* === Кнопка: Сохранить === */
      screen.querySelector("#btnSave")?.addEventListener("click", async () => {
        haptic && haptic("impact");
        const statusEl = screen.querySelector("#saveStatus");
        statusEl.textContent = "Сохраняем…";
        statusEl.style.color = "var(--muted)";
        try {
          const res = await _api("contract_save", {
            assembly_id:    asmId,
            contract_num:   extras.contract_num,
            contract_date:  extras.contract_date,
            travel_spb:     extras.travel_spb,
            travel_outside: extras.travel_outside,
            tech_list:      extras.tech_list,
          });
          if (res.ok) {
            statusEl.textContent = "✅ Сохранено";
            statusEl.style.color = "#27ae60";
            setTimeout(() => { statusEl.textContent = ""; }, 3000);
          } else {
            throw new Error(res.error || "Ошибка сервера");
          }
        } catch (e) {
          statusEl.textContent = "❌ " + e.message;
          statusEl.style.color = "#e74c3c";
        }
      });

      /* === Кнопка: Подписать акт === */
      screen.querySelector("#btnSign")?.addEventListener("click", () => {
        haptic && haptic("impact");
        if (typeof SignRequest !== "undefined") {
          SignRequest.open(asmId, {
            clientName:  asm.client_name  || "",
            clientTgId:  asm.client_tg_id || null,
            onSuccess: () => {
              // Перезагружаем экран после успешной подписи
              mount(container, asmId);
            },
          });
        } else {
          alert("Модуль подписания недоступен");
        }
      });
    } // end render()

    render();
  } // end mount()

  return { mount };
})();
