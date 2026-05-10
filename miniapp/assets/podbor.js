/* ============================================================
   Подбор техники — render, state, navigation, submit
   ============================================================ */

const Podbor = (function () {
  const STORAGE_KEY = "zov-podbor-v3";
  const STEPS = ["intro", "categories", "detail", "pricing", "infra", "priorities", "brands", "summary"];

  // Внутренний sub-state для шага «detail»: 'menu' | 'cat:<key>'
  let detailView = "menu";

  let state = loadState();
  let root = null;
  let currentStep = "intro";

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return defaultState();
  }

  function defaultState() {
    return {
      client_name: "",
      client_phone: "",
      address: "",
      categories: [],          // ['fridge','hob',...]
      per_cat: {},             // { fridge: { params: {type:'sbs',...}, features: ['nofrost'], notes: '' }, ... }
      price_ranges: {},        // { fridge: { from: 50000, to: 120000 }, ... }
      infra: { stove: "", vent: "" },
      priorities: [],          // ['balance','reviews',...]
      brands: {},              // { fridge: {Bosch:'preferred',...}, ... }
      notes: "",
    };
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function update(patch) {
    state = { ...state, ...patch };
    saveState();
  }

  /* ===================== Render entry ===================== */

  function mount(container) {
    root = container;
    document.body.classList.remove("has-bottom-nav");
    const oldNav = document.getElementById("bottom-nav");
    if (oldNav) oldNav.remove();
    render();
  }

  function go(step) {
    if (!STEPS.includes(step)) return;
    currentStep = step;
    detailView = "menu"; // на любой переход detail возвращается в меню
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    haptic && haptic("impact");
  }

  function render() {
    if (!root) return;
    root.innerHTML = "";
    root.appendChild(renderHeader());
    root.appendChild(renderProgress());
    const screen = el(`<div class="podbor-screen"></div>`);
    root.appendChild(screen);

    switch (currentStep) {
      case "intro":      screen.appendChild(renderIntro()); break;
      case "categories": screen.appendChild(renderCategories()); break;
      case "detail":     screen.appendChild(renderDetail()); break;
      case "pricing":    screen.appendChild(renderPricing()); break;
      case "infra":      screen.appendChild(renderInfra()); break;
      case "priorities": screen.appendChild(renderPriorities()); break;
      case "brands":     screen.appendChild(renderBrands()); break;
      case "summary":    screen.appendChild(renderSummary()); break;
    }
  }

  /* ===================== Header & progress ===================== */

  function renderHeader() {
    const h = el(`
      <header class="podbor-header">
        <button class="podbor-back" aria-label="Назад">${ICONS.arrow_left}</button>
        <div class="podbor-title">Подбор техники</div>
        <div style="width:28px"></div>
      </header>
    `);
    h.querySelector(".podbor-back").addEventListener("click", () => {
      const idx = STEPS.indexOf(currentStep);
      if (idx <= 0) {
        // Выход из подбора в главный экран кабинета
        location.hash = "";
        location.reload();
      } else {
        go(STEPS[idx - 1]);
      }
    });
    return h;
  }

  function renderProgress() {
    const idx = STEPS.indexOf(currentStep);
    const total = STEPS.length;
    const pct = Math.round(((idx + 1) / total) * 100);
    const labels = ["Старт", "Категории", "Параметры", "Цена", "Инфра", "Приоритеты", "Бренды", "Подбор"];
    return el(`
      <div class="podbor-progress">
        <div class="podbor-progress-bar"><div class="bar" style="width:${pct}%"></div></div>
        <div class="podbor-progress-meta">
          <span>${labels[idx]}</span><span class="num">${idx + 1}/${total}</span>
        </div>
      </div>
    `);
  }

  /* ===================== Step: intro ===================== */

  function renderIntro() {
    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">Подбор техники<br><span class="accent">для клиента</span></h2>
        <p class="lede">7 коротких шагов. Категории, ценовой коридор, инфраструктура и предпочтения. AI соберёт предложение.</p>

        <div class="form-row">
          <label class="field">
            <span class="field-label">Клиент</span>
            <input type="text" data-bind="client_name" value="${state.client_name || ""}" placeholder="Например: А. Пестова">
          </label>
        </div>
        <div class="form-row">
          <label class="field">
            <span class="field-label">Телефон</span>
            <input type="tel" data-bind="client_phone" value="${state.client_phone || ""}" placeholder="+7 ...">
          </label>
        </div>

        <div class="podbor-cta-row">
          <button class="btn-primary" data-go="categories">Начать</button>
        </div>
      </section>
    `);
    bindInputs(node);
    bindNav(node);
    return node;
  }

  /* ===================== Step: categories ===================== */

  function renderCategories() {
    const grid = PODBOR_CATEGORIES.map(c => `
      <button class="cat-card${state.categories.includes(c.key) ? " active" : ""}" data-cat="${c.key}">
        <div class="cat-icon">${ICONS[c.icon] || ""}</div>
        <div class="cat-label">${c.label}</div>
        ${state.categories.includes(c.key) ? `<div class="cat-check">${ICONS.check}</div>` : ""}
      </button>
    `).join("");

    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">Какую технику<br><span class="accent">подбираем?</span></h2>
        <p class="lede">Выберите все категории, что нужно подобрать клиенту.</p>
        <div class="cat-grid">${grid}</div>
        <div class="podbor-cta-row">
          <button class="btn-secondary" data-go="intro">Назад</button>
          <button class="btn-primary" data-go="detail">Дальше</button>
        </div>
      </section>
    `);
    node.querySelectorAll(".cat-card").forEach(card => {
      card.addEventListener("click", () => {
        const cat = card.dataset.cat;
        const next = state.categories.includes(cat)
          ? state.categories.filter(x => x !== cat)
          : [...state.categories, cat];
        update({ categories: next });
        render();
      });
    });
    bindNav(node);
    return node;
  }

  /* ===================== Step: detail — menu + per-category sub-screen ===================== */

  function isCategoryFilled(catKey) {
    const cat = state.per_cat[catKey];
    if (!cat || !cat.params) return false;
    const params = PODBOR_PARAMS[catKey]?.primary || [];
    return params.every(p => cat.params[p.key]);
  }

  function renderDetail() {
    if (!state.categories.length) {
      return el(`
        <section class="podbor-step">
          <div class="empty">Сначала выберите категории.</div>
          <div class="podbor-cta-row">
            <button class="btn-secondary" data-go="categories">Назад</button>
          </div>
        </section>
      `);
    }
    if (detailView !== "menu" && detailView.startsWith("cat:")) {
      const catKey = detailView.slice(4);
      return renderCategoryDetail(catKey);
    }
    return renderDetailMenu();
  }

  function renderDetailMenu() {
    const cards = state.categories.map(catKey => {
      const cat = PODBOR_CATEGORIES.find(x => x.key === catKey);
      const filled = isCategoryFilled(catKey);
      const summary = filled ? buildPerCatSummary(catKey) : "Заполнить параметры";
      return `
        <button class="detail-card${filled ? " done" : ""}" data-cat="${catKey}">
          <div class="detail-icon">${ICONS[cat.icon] || ""}</div>
          <div class="detail-text">
            <div class="detail-name">${cat.label}</div>
            <div class="detail-sum">${summary}</div>
          </div>
          <div class="detail-status">${filled ? ICONS.check : ICONS.chevron}</div>
        </button>
      `;
    }).join("");

    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">Параметры<br><span class="accent">по категориям</span></h2>
        <p class="lede">Только главное: тип, размер, цвет. Технические фичи — в «Подробнее ↓», по желанию.</p>
        <div class="detail-list">${cards}</div>
        <div class="podbor-cta-row">
          <button class="btn-secondary" data-go="categories">Назад</button>
          <button class="btn-primary" data-go="pricing">Дальше</button>
        </div>
      </section>
    `);
    node.querySelectorAll(".detail-card").forEach(c => {
      c.addEventListener("click", () => {
        detailView = "cat:" + c.dataset.cat;
        render();
      });
    });
    bindNav(node);
    return node;
  }

  function buildPerCatSummary(catKey) {
    const cat = state.per_cat[catKey];
    if (!cat || !cat.params) return "—";
    const params = PODBOR_PARAMS[catKey]?.primary || [];
    const labels = params
      .map(p => {
        const opt = p.options.find(o => o.key === cat.params[p.key]);
        return opt ? opt.label : null;
      })
      .filter(Boolean);
    return labels.join(" · ") || "—";
  }

  function renderCategoryDetail(catKey) {
    const cat = PODBOR_CATEGORIES.find(x => x.key === catKey);
    const config = PODBOR_PARAMS[catKey];
    if (!config) {
      return el(`<section class="podbor-step"><div class="empty">Параметры для «${cat?.label}» ещё не описаны.</div></section>`);
    }
    const catState = state.per_cat[catKey] || { params: {}, features: [], notes: "" };
    const isExpanded = catState._expanded || false;

    const primaryHtml = config.primary.map(p => {
      const cur = catState.params?.[p.key] || "";
      return `
        <div class="param-group">
          <div class="param-label">${p.label}</div>
          <div class="opt-list">
            ${p.options.map(o => `
              <button class="opt${cur === o.key ? " on" : ""}" data-param="${p.key}" data-val="${o.key}">${o.label}</button>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");

    const featuresHtml = config.features.map(f => {
      const on = (catState.features || []).includes(f.key);
      return `
        <button class="feature${on ? " on" : ""}" data-feat="${f.key}">
          <div class="feature-name">${f.label}</div>
          <div class="feature-hint">${f.hint}</div>
          <div class="feature-tick">${on ? ICONS.check : ""}</div>
        </button>
      `;
    }).join("");

    const node = el(`
      <section class="podbor-step podbor-cat-detail">
        <header class="cat-detail-header">
          <button class="podbor-back" aria-label="К меню">${ICONS.arrow_left}</button>
          <div class="cat-detail-icon">${ICONS[cat.icon] || ""}</div>
          <h2 class="cat-detail-title">${cat.label}</h2>
        </header>

        <div class="block">
          <div class="block-head">Главное</div>
          ${primaryHtml}
        </div>

        <button class="accordion-head" data-toggle="exp">
          <span>Подробнее</span>
          <span class="accordion-chev${isExpanded ? " open" : ""}">${ICONS.chevron}</span>
        </button>
        <div class="accordion-body${isExpanded ? " open" : ""}">
          <div class="hint">Технические фичи — необязательно. Если не отметите, AI выберет сам и пояснит в подборе.</div>
          <div class="feature-list">${featuresHtml}</div>
          <label class="field">
            <span class="field-label">Заметки по этой категории</span>
            <textarea data-bind="cat_notes" rows="2" placeholder="Что-то особенное?">${catState.notes || ""}</textarea>
          </label>
        </div>

        <div class="podbor-cta-row">
          <button class="btn-secondary" id="catBack">К списку</button>
          <button class="btn-primary" id="catSave">Сохранить</button>
        </div>
      </section>
    `);

    // Главное — radio
    node.querySelectorAll("[data-param]").forEach(b => {
      b.addEventListener("click", () => {
        const cs = state.per_cat[catKey] || { params: {}, features: [], notes: "" };
        cs.params = { ...(cs.params || {}), [b.dataset.param]: b.dataset.val };
        update({ per_cat: { ...state.per_cat, [catKey]: cs } });
        render();
      });
    });
    // Features — toggle
    node.querySelectorAll("[data-feat]").forEach(b => {
      b.addEventListener("click", () => {
        const cs = state.per_cat[catKey] || { params: {}, features: [], notes: "" };
        const cur = cs.features || [];
        cs.features = cur.includes(b.dataset.feat) ? cur.filter(x => x !== b.dataset.feat) : [...cur, b.dataset.feat];
        update({ per_cat: { ...state.per_cat, [catKey]: cs } });
        render();
      });
    });
    // Accordion
    node.querySelector("[data-toggle='exp']").addEventListener("click", () => {
      const cs = state.per_cat[catKey] || { params: {}, features: [], notes: "" };
      cs._expanded = !cs._expanded;
      update({ per_cat: { ...state.per_cat, [catKey]: cs } });
      render();
    });
    // Notes
    const ta = node.querySelector("textarea[data-bind='cat_notes']");
    if (ta) ta.addEventListener("input", e => {
      const cs = state.per_cat[catKey] || { params: {}, features: [], notes: "" };
      cs.notes = e.target.value;
      update({ per_cat: { ...state.per_cat, [catKey]: cs } });
    });
    // Back / save → menu
    node.querySelector(".podbor-back").addEventListener("click", () => { detailView = "menu"; render(); });
    node.querySelector("#catBack").addEventListener("click", () => { detailView = "menu"; render(); });
    node.querySelector("#catSave").addEventListener("click", () => { detailView = "menu"; render(); haptic && haptic("success"); });
    return node;
  }

  /* ===================== Step: pricing (ценовой коридор по категориям) ===================== */

  function renderPricing() {
    if (!state.categories.length) {
      return el(`
        <section class="podbor-step">
          <div class="empty">Сначала выберите категории.</div>
          <div class="podbor-cta-row">
            <button class="btn-secondary" data-go="detail">Назад</button>
          </div>
        </section>
      `);
    }
    // Подсчёт суммы коридоров
    let totalFrom = 0, totalTo = 0;
    state.categories.forEach(c => {
      const r = state.price_ranges[c] || {};
      if (r.from) totalFrom += parseInt(r.from, 10) || 0;
      if (r.to)   totalTo   += parseInt(r.to,   10) || 0;
    });

    const rows = state.categories.map(c => {
      const cat = PODBOR_CATEGORIES.find(x => x.key === c);
      const r = state.price_ranges[c] || {};
      return `
        <div class="price-row">
          <div class="price-label">${cat.label}</div>
          <div class="price-inputs">
            <input type="number" inputmode="numeric" data-price="${c}.from" value="${r.from || ""}" placeholder="от">
            <span class="dash">—</span>
            <input type="number" inputmode="numeric" data-price="${c}.to"   value="${r.to   || ""}" placeholder="до">
            <span class="rub">₽</span>
          </div>
        </div>
      `;
    }).join("");

    const totalLine = (totalFrom || totalTo)
      ? `<div class="price-total">Итого: <strong>${formatRub(totalFrom)} — ${formatRub(totalTo)} ₽</strong></div>`
      : `<div class="price-total muted">Сумма посчитается автоматически</div>`;

    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">Ценовой<br><span class="accent">коридор</span></h2>
        <p class="lede">«От — До» по каждой категории. AI подберёт варианты, которые попадают в коридор и совокупно укладываются в общий бюджет клиента.</p>
        <div class="block">
          <div class="block-head">По категориям, ₽</div>
          <div class="price-list">${rows}</div>
          ${totalLine}
        </div>
        <div class="podbor-cta-row">
          <button class="btn-secondary" data-go="detail">Назад</button>
          <button class="btn-primary" data-go="infra">Дальше</button>
        </div>
      </section>
    `);
    node.querySelectorAll("[data-price]").forEach(inp => {
      inp.addEventListener("input", e => {
        const [cat, key] = e.target.dataset.price.split(".");
        const next = { ...state.price_ranges, [cat]: { ...(state.price_ranges[cat] || {}), [key]: e.target.value } };
        update({ price_ranges: next });
        render();
      });
    });
    bindNav(node);
    return node;
  }

  function formatRub(n) {
    if (!n) return "—";
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  /* ===================== Step: infra ===================== */

  function renderInfra() {
    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">Инфраструктура<br><span class="accent">кухни</span></h2>
        <p class="lede">Газ или электрика — определит тип варочной (индукция / стеклокерамика / газ). Подключение вытяжки — нужны ли выводы или угольный фильтр.</p>
        <div class="block">
          <div class="block-head">Подключение варочной</div>
          <div class="opt-list">
            ${PODBOR_INFRA.stove.map(o => `
              <button class="opt${state.infra.stove === o.key ? " on" : ""}" data-infra="stove" data-val="${o.key}">${o.label}</button>
            `).join("")}
          </div>
        </div>
        <div class="block">
          <div class="block-head">Вытяжка → внутридомовая вентиляция?</div>
          <div class="opt-list">
            ${PODBOR_INFRA.vent.map(o => `
              <button class="opt${state.infra.vent === o.key ? " on" : ""}" data-infra="vent" data-val="${o.key}">${o.label}</button>
            `).join("")}
          </div>
          <div class="hint">Если «Нет» — менеджер закладывает угольный фильтр. Если «Да» — заранее планируем выводы.</div>
        </div>
        <div class="podbor-cta-row">
          <button class="btn-secondary" data-go="pricing">Назад</button>
          <button class="btn-primary" data-go="priorities">Дальше</button>
        </div>
      </section>
    `);
    node.querySelectorAll("[data-infra]").forEach(b => {
      b.addEventListener("click", () => {
        update({ infra: { ...state.infra, [b.dataset.infra]: b.dataset.val } });
        render();
      });
    });
    bindNav(node);
    return node;
  }

  /* ===================== Step: priorities (что важно при выборе) ===================== */

  function renderPriorities() {
    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">Что важно<br><span class="accent">при выборе?</span></h2>
        <p class="lede">Бюджет уже задал коридор. Здесь — что AI должен использовать как тай-брейк, когда варианты примерно равны по цене.</p>
        <div class="block">
          <div class="block-head">Приоритеты</div>
          <div class="opt-list">
            ${PODBOR_PRIORITIES.map(o => `
              <button class="opt${(state.priorities || []).includes(o.key) ? " on" : ""}" data-pri="${o.key}">${o.label}</button>
            `).join("")}
          </div>
          <div class="hint">Можно несколько · в порядке выбора</div>
        </div>
        <div class="podbor-cta-row">
          <button class="btn-secondary" data-go="infra">Назад</button>
          <button class="btn-primary" data-go="brands">Дальше</button>
        </div>
      </section>
    `);
    node.querySelectorAll("[data-pri]").forEach(b => {
      b.addEventListener("click", () => {
        const cur = state.priorities || [];
        const key = b.dataset.pri;
        const next = cur.includes(key) ? cur.filter(x => x !== key) : [...cur, key];
        update({ priorities: next });
        render();
      });
    });
    bindNav(node);
    return node;
  }

  /* ===================== Step: brands ===================== */

  function renderBrands() {
    if (!state.categories.length) {
      return el(`<section class="podbor-step"><div class="empty">Сначала выберите категории.</div></section>`);
    }
    const blocks = state.categories.map(catKey => {
      const cat = PODBOR_CATEGORIES.find(x => x.key === catKey);
      const brands = PODBOR_BRANDS[catKey] || { premium: [], middle: [], budget: [] };
      const catState = state.brands[catKey] || {};
      // Тиры остаются в данных (для аналитики «температуры» клиента),
      // но визуально просто разный цветовой оттенок чипа — без явного ярлыка.
      const tierGroup = (tier) => `
        <div class="brand-chips brand-tier-${tier}">
          ${(brands[tier] || []).map(b => {
            const status = catState[b] || "none";
            return `<button class="chip tier-${tier} status-${status}" data-cat="${catKey}" data-brand="${b}" data-tier="${tier}">${b}</button>`;
          }).join("")}
        </div>
      `;
      return `
        <div class="block">
          <div class="block-head">${cat.label}</div>
          ${tierGroup("premium")}${tierGroup("middle")}${tierGroup("budget")}
        </div>
      `;
    }).join("");

    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">Бренды<br><span class="accent">по категориям</span></h2>
        <p class="lede">Тап — ★ предпочтительно. Дабл — ✓ допустимо. Третий — снять. AI сначала пробует ★, потом ✓.</p>
        ${blocks}
        <div class="podbor-cta-row">
          <button class="btn-secondary" data-go="priorities">Назад</button>
          <button class="btn-primary" data-go="summary">Дальше</button>
        </div>
      </section>
    `);
    node.querySelectorAll(".chip[data-brand]").forEach(c => {
      c.addEventListener("click", () => {
        const catKey = c.dataset.cat, brand = c.dataset.brand;
        const cur = (state.brands[catKey] || {})[brand] || "none";
        const nextStatus = cur === "none" ? "preferred" : cur === "preferred" ? "acceptable" : "none";
        const catBrands = { ...(state.brands[catKey] || {}) };
        if (nextStatus === "none") delete catBrands[brand];
        else catBrands[brand] = nextStatus;
        update({ brands: { ...state.brands, [catKey]: catBrands } });
        render();
      });
    });
    bindNav(node);
    return node;
  }

  /* ===================== Step: summary + submit ===================== */

  function renderSummary() {
    let totalFrom = 0, totalTo = 0;
    state.categories.forEach(c => {
      const r = state.price_ranges[c] || {};
      totalFrom += parseInt(r.from || "0", 10) || 0;
      totalTo   += parseInt(r.to   || "0", 10) || 0;
    });
    const totalRange = (totalFrom || totalTo)
      ? `${formatRub(totalFrom)} — ${formatRub(totalTo)} ₽`
      : "—";
    const priorityLabels = (state.priorities || [])
      .map(k => PODBOR_PRIORITIES.find(p => p.key === k)?.label)
      .filter(Boolean).join(" · ");

    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">Готово<br><span class="accent">к подбору</span></h2>
        <p class="lede">Проверьте и отправьте — AI вернёт предложение в чат с ботом.</p>
        <div class="block summary-block">
          <div class="kv"><span>Клиент</span><strong>${state.client_name || "—"}</strong></div>
          <div class="kv"><span>Категорий</span><strong>${state.categories.length}</strong></div>
          <div class="kv"><span>Ценовой коридор</span><strong>${totalRange}</strong></div>
          <div class="kv"><span>Подключение</span><strong>${PODBOR_INFRA.stove.find(f => f.key === state.infra.stove)?.label || "—"}</strong></div>
          <div class="kv"><span>Вентиляция</span><strong>${PODBOR_INFRA.vent.find(f => f.key === state.infra.vent)?.label || "—"}</strong></div>
          <div class="kv"><span>Приоритеты</span><strong>${priorityLabels || "—"}</strong></div>
        </div>

        <label class="field">
          <span class="field-label">Дополнительные пожелания</span>
          <textarea data-bind="notes" rows="3" placeholder="Что-то особенное от клиента?">${state.notes || ""}</textarea>
        </label>

        <div class="podbor-cta-row">
          <button class="btn-secondary" data-go="brands">Назад</button>
          <button class="btn-primary" id="submitBtn">Отправить · AI подберёт</button>
        </div>

        <div id="submitResult" class="submit-result"></div>
      </section>
    `);
    bindInputs(node);
    bindNav(node);
    node.querySelector("#submitBtn").addEventListener("click", () => onSubmit(node));
    return node;
  }

  /* ===================== Submit ===================== */

  async function onSubmit(node) {
    const btn = node.querySelector("#submitBtn");
    const result = node.querySelector("#submitResult");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-inline"></span> AI думает...';
    result.innerHTML = "";

    if (!BACKEND_URL) {
      result.innerHTML = `<div class="error">BACKEND_URL не настроен (dev-режим).</div>`;
      btn.disabled = false; btn.textContent = "Отправить · AI подберёт"; return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/podbor`, {
        method: "POST",
        body: JSON.stringify({
          initData: tg?.initData || "",
          checklist: state,
          client_name: state.client_name,
        }),
      });
      const data = await res.json();
      if (data.error) {
        result.innerHTML = `<div class="error">Ошибка: ${data.error}</div>`;
      } else {
        result.innerHTML = `
          <div class="success">
            <div class="success-icon">${ICONS.check}</div>
            <div>
              <div class="success-title">Подбор отправлен в чат бота</div>
              <div class="success-sub">Лид #${(data.id || "").slice(0, 6)} · откройте Telegram</div>
            </div>
          </div>
        `;
        haptic && haptic("success");
      }
    } catch (e) {
      result.innerHTML = `<div class="error">Сеть: ${e.message}</div>`;
    }
    btn.disabled = false;
    btn.textContent = "Отправить ещё раз";
  }

  /* ===================== Helpers ===================== */

  function bindInputs(node) {
    node.querySelectorAll("[data-bind]").forEach(inp => {
      inp.addEventListener("input", e => {
        update({ [e.target.dataset.bind]: e.target.value });
      });
    });
  }

  function bindNav(node) {
    node.querySelectorAll("[data-go]").forEach(b => {
      b.addEventListener("click", () => go(b.dataset.go));
    });
  }

  return { mount, go, getState: () => state, reset: () => { state = defaultState(); saveState(); render(); } };
})();
