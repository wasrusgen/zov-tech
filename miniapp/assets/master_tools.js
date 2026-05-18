/* ============================================================
   MasterTools — шпаргалки сборщика
   #/master/tools        → меню инструментов
   #/master/tools/rails  → калькулятор реек
   #/master/tools/shelves→ калькулятор полкодержателей
   #/master/tools/price  → прайс на доп. работы 2025
   ============================================================ */

const MasterTools = (function () {
  "use strict";

  /* ── Helpers ─────────────────────────────────────────────── */
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }
  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fmt(n) { return Math.round(n).toLocaleString("ru-RU"); }

  function _header(title, backHash) {
    const h = el(`
      <header class="podbor-header">
        <button class="podbor-back" aria-label="Назад">${(window.ICONS||{}).arrow_left||"‹"}</button>
        <div class="podbor-title">${escHtml(title)}</div>
        <div style="width:36px"></div>
      </header>
    `);
    h.querySelector(".podbor-back").addEventListener("click", () => {
      haptic && haptic("impact");
      location.hash = backHash || "#/master";
    });
    return h;
  }

  function _screen(container) {
    container.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    document.getElementById("bottom-nav")?.remove();
    return container;
  }

  function _numInput(id, label, value, placeholder, hint = "") {
    return `
      <div class="form-row" style="margin-bottom:10px;">
        <label class="field">
          <span class="field-label">${escHtml(label)}</span>
          <input type="number" id="${id}" value="${escHtml(String(value))}"
                 placeholder="${escHtml(placeholder)}" inputmode="numeric"
                 style="font-size:18px;font-weight:700;letter-spacing:0.03em;">
          ${hint ? `<span class="field-hint">${escHtml(hint)}</span>` : ""}
        </label>
      </div>`;
  }

  /* ================================================================
     МЕНЮ
     ================================================================ */
  function mountMenu(container) {
    _screen(container);
    container.appendChild(_header("Шпаргалки сборщика", "#/master"));

    const wrap = el(`<div class="podbor-screen"></div>`);
    wrap.appendChild(el(`
      <div style="padding:16px 16px 8px;">
        <p class="lede">Расчётные таблицы и прайс — всё под рукой.</p>
      </div>
    `));

    const tools = [
      { hash: "#/master/tools/rails",  icon: "📏", title: "Рейки на стену",
        sub: "Расстояние от нулевой точки по количеству реек и ширине проёма" },
      { hash: "#/master/tools/shelves", icon: "📐", title: "Полкодержатели",
        sub: "Расстояния внутри корпуса по высоте и количеству полок" },
      { hash: "#/master/tools/price",  icon: "💰", title: "Прайс доп. работ 2025",
        sub: "Все позиции с ценами — введите количество, получите итог" },
    ];

    tools.forEach(t => {
      const card = el(`
        <div style="margin:0 16px 12px;padding:14px 16px;background:var(--surface);
                    border:1px solid var(--border);border-radius:12px;cursor:pointer;
                    display:flex;align-items:center;gap:14px;">
          <div style="font-size:32px;flex-shrink:0;">${t.icon}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:15px;font-weight:700;color:var(--ink);">${escHtml(t.title)}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;line-height:1.4;">${escHtml(t.sub)}</div>
          </div>
          <div style="color:var(--muted);font-size:20px;">›</div>
        </div>
      `);
      card.addEventListener("click", () => {
        haptic && haptic("impact");
        location.hash = t.hash;
      });
      wrap.appendChild(card);
    });

    container.appendChild(wrap);
  }

  /* ================================================================
     РЕЙКИ НА СТЕНУ
     Алгоритм (из !1! РЕЙКИ.xlsx):
       gap = (openingWidth − railCount × railWidth) / (railCount − 1)
       position[0] = 0
       position[i] = round(i × (railWidth + gap))
     ================================================================ */
  function mountRails(container) {
    _screen(container);
    container.appendChild(_header("Рейки на стену", "#/master/tools"));

    let inputs = { width: 0, count: 8, railW: 51 };

    const wrap = el(`<div class="podbor-screen"></div>`);

    // Inputs
    const formEl = el(`
      <div style="padding:16px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;
                    letter-spacing:.07em;color:var(--muted);margin-bottom:12px;">Параметры</div>
        ${_numInput("rt-width", "Длина проёма (мм)", "", "например: 2400")}
        ${_numInput("rt-count", "Количество реек", 8, "например: 8")}
        ${_numInput("rt-railw", "Ширина рейки (мм)", 51, "стандарт 51 мм", "Стандартная рейка ЗОВ — 51 мм")}
        <button class="btn-primary" id="rt-calc" style="width:100%;margin-top:4px;">
          Рассчитать
        </button>
      </div>
    `);
    wrap.appendChild(formEl);

    // Result
    const resultEl = el(`<div id="rt-result" style="padding:0 16px 24px;"></div>`);
    wrap.appendChild(resultEl);
    container.appendChild(wrap);

    // Events
    ["rt-width","rt-count","rt-railw"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", () => _calcRails(inputs, resultEl));
    });
    document.getElementById("rt-calc")?.addEventListener("click", () => {
      haptic && haptic("impact");
      _calcRails(inputs, resultEl);
    });

    function _calcRails(inp, out) {
      const w  = parseFloat(document.getElementById("rt-width")?.value) || 0;
      const n  = parseInt(document.getElementById("rt-count")?.value)   || 0;
      const rw = parseFloat(document.getElementById("rt-railw")?.value) || 51;
      out.innerHTML = "";

      if (!w || w <= 0) { out.innerHTML = `<div class="error">Укажите длину проёма</div>`; return; }
      if (n < 2)        { out.innerHTML = `<div class="error">Минимум 2 рейки</div>`; return; }
      if (rw <= 0)      { out.innerHTML = `<div class="error">Укажите ширину рейки</div>`; return; }
      if (n * rw >= w)  { out.innerHTML = `<div class="error">Рейки не помещаются в проём</div>`; return; }

      const gap = (w - n * rw) / (n - 1);
      const positions = Array.from({ length: n }, (_, i) =>
        i === 0 ? 0 : Math.round(i * (rw + gap))
      );

      let rows = positions.map((p, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:13px;color:var(--muted);">Рейка ${i + 1}</div>
          <div style="font-size:18px;font-weight:700;color:var(--ink);font-family:var(--font-mono,monospace);">
            ${p === 0 ? "0" : fmt(p)} <span style="font-size:12px;font-weight:400;">мм</span>
          </div>
        </div>
      `).join("");

      out.innerHTML = `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;
                    padding:0 14px;margin-bottom:12px;">
          <div style="padding:10px 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;
                      letter-spacing:.07em;color:var(--muted);">Расстояния от нулевой точки</div>
          ${rows}
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;
                    padding:12px 14px;font-size:12px;color:var(--muted);line-height:1.5;">
          Межреечное расстояние: <b>${fmt(gap)} мм</b> ·
          Итого рейками: <b>${fmt(n * rw)} мм</b> ·
          Итого зазорами: <b>${fmt(w - n * rw)} мм</b>
        </div>
      `;
    }
  }

  /* ================================================================
     ПОЛКОДЕРЖАТЕЛИ
     Алгоритм (из !!! ПОЛКОДЕРЖАТЕЛИ.xlsx):
       step = height / shelfCount
       position[i] = (i+1) × step − drop
     ================================================================ */
  function mountShelves(container) {
    _screen(container);
    container.appendChild(_header("Полкодержатели", "#/master/tools"));

    const wrap = el(`<div class="podbor-screen"></div>`);

    const formEl = el(`
      <div style="padding:16px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;
                    letter-spacing:.07em;color:var(--muted);margin-bottom:12px;">Параметры</div>
        ${_numInput("sh-height", "Высота проёма корпуса (мм)", "", "например: 915")}
        ${_numInput("sh-count",  "Количество полок", 3, "например: 3")}
        ${_numInput("sh-drop",   "Опуск на полкодержатель (мм)", 5, "стандарт 5 мм",
                    "Стандартное значение — 5 мм")}
        <button class="btn-primary" id="sh-calc" style="width:100%;margin-top:4px;">
          Рассчитать
        </button>
      </div>
    `);
    wrap.appendChild(formEl);

    const resultEl = el(`<div id="sh-result" style="padding:0 16px 24px;"></div>`);
    wrap.appendChild(resultEl);
    container.appendChild(wrap);

    document.getElementById("sh-calc")?.addEventListener("click", () => {
      haptic && haptic("impact");
      _calcShelves(resultEl);
    });
    ["sh-height","sh-count","sh-drop"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", () => _calcShelves(resultEl));
    });

    function _calcShelves(out) {
      const h    = parseFloat(document.getElementById("sh-height")?.value) || 0;
      const n    = parseInt(document.getElementById("sh-count")?.value)    || 0;
      const drop = parseFloat(document.getElementById("sh-drop")?.value)   ?? 5;
      out.innerHTML = "";

      if (!h || h <= 0) { out.innerHTML = `<div class="error">Укажите высоту проёма</div>`; return; }
      if (n < 1)        { out.innerHTML = `<div class="error">Минимум 1 полка</div>`; return; }

      const step = h / n;
      const positions = Array.from({ length: n }, (_, i) =>
        Math.round((i + 1) * step - drop)
      );

      const rows = positions.map((p, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:13px;color:var(--muted);">Полка ${i + 1}</div>
          <div style="font-size:18px;font-weight:700;color:var(--ink);font-family:var(--font-mono,monospace);">
            ${fmt(p)} <span style="font-size:12px;font-weight:400;">мм</span>
          </div>
        </div>
      `).join("");

      out.innerHTML = `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;
                    padding:0 14px;margin-bottom:12px;">
          <div style="padding:10px 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;
                      letter-spacing:.07em;color:var(--muted);">Расстояния от нижней кромки корпуса</div>
          ${rows}
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;
                    padding:12px 14px;font-size:12px;color:var(--muted);">
          Шаг между полками: <b>${fmt(step)} мм</b>
        </div>
      `;
    }
  }

  /* ================================================================
     ПРАЙС НА ДОП. РАБОТЫ 2025
     Формула: стоимость = цена × количество (если кол-во введено)
     Итог = сумма всех позиций
     ================================================================ */

  const PRICE_SECTIONS = [
    { id: "general", title: "Общие работы", items: [
      { id:"g1",  name:"Выезд мастера в магазин по просьбе клиента (>5км +40р/км)", price:800 },
      { id:"g2",  name:"Доп. срочный выезд мастера по просьбе клиента в течение 24 часов", price:3000 },
      { id:"g3",  name:"Технологический выпил (один выпил в одной детали)", price:100 },
      { id:"g4",  name:"Ложный выезд или ожидание заказчика более 45 мин", price:1500 },
      { id:"g5",  name:"Вынос картонной упаковки в коридор", price:0, free:true },
      { id:"g6",  name:"Вынос упаковки в мусорный контейнер (лифт + до 100м)", price:0, free:true },
    ]},
    { id: "light", title: "Подсветка", items: [
      { id:"l1", name:"Подключение светодиодной ленты по наружной части мебели, за пм", price:600 },
      { id:"l2", name:"Подключение светодиодной ленты внутри мебели, за 1 линию", price:400 },
      { id:"l3", name:"Монтаж декоративных планок на стену, руб./метр", price:370 },
      { id:"l4", name:"Фрезеровка канала для врезной подсветки, руб./метр", price:1000 },
    ]},
    { id: "sink", title: "Зона мойки", items: [
      { id:"s1",  name:"Выпил в столешнице / стенке ЛДСП под трубы", price:300 },
      { id:"s2",  name:"Демонтаж обесточенной розетки", price:50 },
      { id:"s3",  name:"Переделка модуля по месту (от), за шт.", price:1500 },
      { id:"s4",  name:"Изготовление отверстия в керамограните (с предоставлением сверла)", price:300 },
      { id:"s5",  name:"Демонтаж старой мойки", price:500 },
      { id:"s6",  name:"Врезка накладной мойки Покупателя с обработкой выпила (без подкл.)", price:800 },
      { id:"s7",  name:"Установка мойки Покупателя (без подключения)", price:500 },
      { id:"s8",  name:"Вырез отверстия под смеситель (металл)", price:300 },
      { id:"s9",  name:"Вырез отверстия под смеситель (искусственный камень)", price:500 },
      { id:"s10", name:"Установка встраиваемой посудомоечной машины Покупателя (без подкл.)", price:2000 },
      { id:"s11", name:"Установка встраиваемой стиральной машины Покупателя (без подкл.)", price:2000 },
      { id:"s12", name:"Установка НЕ встраиваемой стиральной машины Покупателя (без подкл.)", price:400 },
      { id:"s13", name:"Изготовление отверстия в столешнице компакт-плита (варочная/мойка/розетка/диспенсер)", price:2000 },
      { id:"s14", name:"Установка мойки подстольного монтажа", price:3000 },
    ]},
    { id: "fridge", title: "Установка холодильника", items: [
      { id:"f1", name:"Установка холодильника Покупателя без перенавески дверей (без подкл.)", price:2500 },
      { id:"f2", name:"Перенавеска дверей холодильника без электроники", price:500 },
      { id:"f3", name:"Перенавеска дверей холодильника с электроникой", price:800 },
      { id:"f4", name:"Демонтаж обесточенной розетки", price:50 },
    ]},
    { id: "hob", title: "Варочная поверхность", items: [
      { id:"h1", name:"Технологический выпил", price:300 },
      { id:"h2", name:"Переделка модуля по месту (от)", price:1000 },
      { id:"h3", name:"Врезка варочной поверхности Покупателя с обработкой выпила (без подкл.)", price:800 },
      { id:"h4", name:"Установка варочной панели Покупателя (без подключения)", price:500 },
      { id:"h5", name:"Вырез в столешнице под шахту / выступ", price:500 },
    ]},
    { id: "hood", title: "Зона вытяжки", items: [
      { id:"ho1", name:"Технологический выпил", price:100 },
      { id:"ho2", name:"Вырез под розетку", price:200 },
      { id:"ho3", name:"Установка купольной вытяжки 60 см (без подключения)", price:1500 },
      { id:"ho4", name:"Установка купольной вытяжки 90 см (без подключения)", price:2000 },
      { id:"ho5", name:"Установка плоской вытяжки (без подключения)", price:300 },
      { id:"ho6", name:"Установка встраиваемой вытяжки (без подключения)", price:1500 },
      { id:"ho7", name:"Установка полновстроенной вытяжки (без подключения)", price:1500 },
      { id:"ho8", name:"Установка островной вытяжки (без подключения)", price:3000 },
      { id:"ho9", name:"Подключение гофрированного воздуховода к вытяжке, шт.", price:400 },
      { id:"ho10",name:"Подключение пластикового воздуховода к вытяжке с монтажом, руб./метр", price:800 },
      { id:"ho11",name:"Установка фланца", price:300 },
    ]},
    { id: "oven", title: "Духовой шкаф / микроволновка", items: [
      { id:"o1", name:"Вырез под розетку", price:200 },
      { id:"o2", name:"Переделка модуля по месту (от)", price:700 },
      { id:"o3", name:"Установка духового шкафа Покупателя в модуль (без подключения)", price:600 },
      { id:"o4", name:"Установка встраиваемой микроволновой печи Покупателя (без подкл.)", price:1000 },
    ]},
    { id: "wall", title: "Зона стеновой панели", items: [
      { id:"w1",  name:"Вырез под розетку в стеновой панели", price:200 },
      { id:"w2",  name:"Вырез под розетку в стеновой панели компакт-плита, шт.", price:500 },
      { id:"w3",  name:"Перепил одного декоративного элемента за деталь", price:400 },
      { id:"w4",  name:"Переделка модуля по месту (от)", price:700 },
      { id:"w5",  name:"Врезка круглых светильников Покупателя (без подключения), шт.", price:70 },
      { id:"w6",  name:"Установка релинга Покупателя (1 пм или 1 шт)", price:300 },
      { id:"w7",  name:"Продольный пил цоколя по вине Покупателя за 1 пм", price:200 },
      { id:"w8",  name:"Изготовление подиума под плиту (материалами заказчика)", price:400 },
      { id:"w9",  name:"Демонтаж/монтаж пристеночного плинтуса, руб./метр", price:200 },
      { id:"w10", name:"Присадка ручек Покупателя за 1 отверстие", price:40 },
      { id:"w11", name:"Установка ручек Покупателя за 1 шт", price:40 },
      { id:"w12", name:"Планировка розеток на место установки кухни", price:2500 },
    ]},
    { id: "cabinet", title: "Шкаф", items: [
      { id:"c1", name:"Монтаж доборов для установки натяжного потолка, р/мп", price:2000 },
      { id:"c2", name:"Демонтаж обесточенной розетки", price:50 },
      { id:"c3", name:"Вырез под розетку / коммуникации", price:200 },
      { id:"c4", name:"Перепил одного декоративного элемента за деталь", price:400 },
      { id:"c5", name:"Переделка модуля по месту (от)", price:2000 },
      { id:"c6", name:"Врезка круглых светильников Покупателя (без подключения), шт.", price:70 },
      { id:"c7", name:"Продольный пил цоколя по вине Покупателя за 1 пм", price:200 },
      { id:"c8", name:"Присадка ручек Покупателя за 1 отверстие", price:40 },
      { id:"c9", name:"Установка ручек Покупателя за 1 шт", price:40 },
    ]},
    { id: "extra", title: "Доп. работы мастер Васильев Р.Г.", items: [
      { id:"e1",  name:"Установка и подключение розетки", price:200 },
      { id:"e2",  name:"Подключение варочной поверхности", price:800 },
      { id:"e3",  name:"Подключение посудомоечной машины", price:1600 },
      { id:"e4",  name:"Подключение стиральной машины", price:1600 },
      { id:"e5",  name:"Установка сушильной машины", price:1000 },
      { id:"e6",  name:"Подключение смесителя", price:1600 },
      { id:"e7",  name:"Подключение слива мойки", price:1000 },
      { id:"e8",  name:"Установка и подключение измельчителя", price:2500 },
      { id:"e9",  name:"Установка и подключение фильтра для воды", price:1000 },
      { id:"e10", name:"Установка дозатора", price:500 },
      { id:"e11", name:"Установка фасадной петли", price:200 },
      { id:"e12", name:"Вырез под вентрешетку", price:400 },
      { id:"e13", name:"Вырез в ЛДСП с кромлением", price:1000 },
      { id:"e14", name:"Переделка сантехнической подводки / водоподготовка", price:1000 },
      { id:"e15", name:"Установка столешницы с заходом в подоконник, от р.", price:3000 },
      { id:"e16", name:"Монтаж и вырезы в панели в зоне инсталляции (примыкания силиконом)", price:3500 },
      { id:"e17", name:"Вырез под коммуникации (трубы), от р.", price:200 },
      { id:"e18", name:"Распаковка / установка / подключение отдельностоящего холодильника", price:500 },
      { id:"e19", name:"Монтаж вешалки (Заказчика)", price:200 },
      { id:"e20", name:"Монтаж брючницы на направляющей (Заказчика)", price:700 },
      { id:"e21", name:"Присадка и монтаж полки скрытого монтажа", price:700 },
    ]},
    { id: "transport", title: "Транспортные расходы", special: "transport", items: [
      { id:"t1", name:"Выезд за КАД, руб./км × дней (40 р/км)", price:40, special:"transport" },
    ]},
  ];

  // Состояние калькулятора (qty по каждому item id)
  let _priceQty = {};
  let _transKm = 0;
  let _transDays = 1;

  function mountPrice(container) {
    _screen(container);
    _priceQty = {};
    _transKm = 0; _transDays = 1;
    container.appendChild(_header("Прайс доп. работ 2025", "#/master/tools"));

    const wrap = el(`<div class="podbor-screen" style="padding-bottom:100px;"></div>`);

    wrap.appendChild(el(`
      <div style="padding:12px 16px 4px;">
        <p class="lede" style="font-size:12px;">
          Введите количество в нужных строках — итог пересчитается автоматически.
        </p>
      </div>
    `));

    PRICE_SECTIONS.forEach(section => {
      const secEl = el(`
        <div style="margin:0 16px 14px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;
                      color:var(--muted);padding:6px 0 6px;border-bottom:2px solid var(--border);
                      margin-bottom:0;">${escHtml(section.title)}</div>
        </div>
      `);

      if (section.special === "transport") {
        // Особый блок: км × дней
        const transEl = el(`
          <div style="margin:0 16px 14px;padding:12px 14px;background:var(--surface);
                      border:1px solid var(--border);border-radius:10px;">
            <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">
              Выезд за КАД — 40 руб/км, за каждый день
            </div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <label class="field" style="flex:1;min-width:80px;">
                <span class="field-label">Км</span>
                <input type="number" id="pr-km" value="0" min="0" inputmode="numeric">
              </label>
              <label class="field" style="flex:1;min-width:60px;">
                <span class="field-label">Дней</span>
                <input type="number" id="pr-days" value="1" min="1" inputmode="numeric">
              </label>
              <div style="padding-top:18px;font-size:13px;font-weight:700;color:var(--accent);
                          min-width:80px;text-align:right;" id="pr-trans-sum">0 ₽</div>
            </div>
          </div>
        `);
        secEl.appendChild(transEl);
        wrap.appendChild(secEl);

        document.getElementById("pr-km")?.addEventListener("input", e => {
          _transKm = parseFloat(e.target.value) || 0;
          _updateTransSum(); _updateTotal();
        });
        document.getElementById("pr-days")?.addEventListener("input", e => {
          _transDays = parseFloat(e.target.value) || 1;
          _updateTransSum(); _updateTotal();
        });
        return;
      }

      wrap.appendChild(secEl);

      section.items.forEach(item => {
        const rowEl = el(`
          <div style="margin:0 16px;display:flex;align-items:center;gap:10px;
                      padding:10px 0;border-bottom:1px solid var(--border);">
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;color:var(--ink);line-height:1.4;">
                ${escHtml(item.name)}
              </div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px;">
                ${item.free ? "Бесплатно" : fmt(item.price) + " ₽"}
              </div>
            </div>
            ${item.free ? `<div style="font-size:12px;color:var(--accent);font-weight:600;min-width:36px;text-align:right;">—</div>` : `
              <input type="number" id="qty-${item.id}" min="0" value=""
                     placeholder="0" inputmode="numeric"
                     style="width:52px;text-align:center;font-size:15px;font-weight:700;
                            padding:6px 4px;border:1px solid var(--border);border-radius:7px;
                            background:var(--surface);color:var(--ink);">
              <div id="sum-${item.id}"
                   style="font-size:13px;font-weight:700;color:var(--accent);
                          min-width:60px;text-align:right;"></div>
            `}
          </div>
        `);

        if (!item.free) {
          const inp = rowEl.querySelector(`#qty-${item.id}`);
          inp?.addEventListener("input", e => {
            const q = parseFloat(e.target.value) || 0;
            _priceQty[item.id] = q;
            const sumEl = document.getElementById(`sum-${item.id}`);
            if (sumEl) sumEl.textContent = q > 0 ? fmt(item.price * q) + " ₽" : "";
            _updateTotal();
          });
        }
        wrap.appendChild(rowEl);
      });
    });

    // Итого (sticky внизу)
    const totalBar = el(`
      <div style="position:fixed;bottom:0;left:0;right:0;z-index:50;
                  background:var(--surface);border-top:1px solid var(--border);
                  padding:12px 20px env(safe-area-inset-bottom,8px);
                  display:flex;justify-content:space-between;align-items:center;
                  box-shadow:0 -4px 16px rgba(0,0,0,.1);">
        <div style="font-size:13px;color:var(--muted);">Итого работ</div>
        <div id="pr-total" style="font-size:22px;font-weight:800;color:var(--ink);">0 ₽</div>
      </div>
    `);
    container.appendChild(wrap);
    container.appendChild(totalBar);

    function _updateTotal() {
      let total = 0;
      PRICE_SECTIONS.forEach(sec => {
        if (sec.special === "transport") {
          total += _transKm * 40 * (_transDays || 1);
          return;
        }
        sec.items.forEach(item => {
          if (!item.free) total += (item.price * (_priceQty[item.id] || 0));
        });
      });
      const el = document.getElementById("pr-total");
      if (el) el.textContent = fmt(total) + " ₽";
    }

    function _updateTransSum() {
      const el = document.getElementById("pr-trans-sum");
      const sum = _transKm * 40 * (_transDays || 1);
      if (el) el.textContent = sum > 0 ? fmt(sum) + " ₽" : "0 ₽";
    }
  }

  return { mountMenu, mountRails, mountShelves, mountPrice };
})();
