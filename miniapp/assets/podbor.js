/* ============================================================
   Подбор техники — render, state, navigation, submit
   ============================================================ */

const Podbor = (function () {
  const STORAGE_KEY = "zov-podbor-v4";
  const STEPS = ["intro", "categories", "detail", "brand", "budget", "strategy", "infra", "summary"];
  const STEP_LABELS = ["Старт", "Категории", "Параметры", "Бренд", "Бюджет", "Стратегия", "Инфра", "Итог"];

  // Внутренний sub-state для шага «detail»: 'menu' | 'cat:<key>'
  let detailView = "menu";

  let state = loadState();
  let root = null;
  let currentStep = "intro";

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Мерж с дефолтами для совместимости с новыми полями
        return { ...defaultState(), ...parsed };
      }
    } catch (e) {}
    return defaultState();
  }

  function defaultState() {
    return {
      client_name: "",
      client_phone: "",
      address: "",
      categories: [],          // ['fridge','hob',...]
      per_cat: {},             // { fridge: { answers: {install:'built_in',...}, notes: '', _step: 0 } }
      brand_strategy: "",      // 'ai' | 'single' | 'different'
      single_brand: "",        // key из PODBOR_SINGLE_BRAND_OPTIONS, если brand_strategy === 'single'
      brands: {},              // если brand_strategy === 'different' — { fridge: {Bosch:'preferred'|'acceptable'|'avoid'} }
      budget_preset: "",       // 'luxe'|'premium'|'middle'|'budget'|'exact'
      price_ranges: {},        // только если budget_preset === 'exact'
      pick_strategies: [],     // ['reviews','balance','tech',...] — multi
      model_count: "5",        // '3' | '5' | '7' — сколько моделей в каждой категории
      infra: { stove: "", vent: "" },
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
    const strip = renderCategoryStrip();
    if (strip) root.appendChild(strip);
    const screen = el(`<div class="podbor-screen"></div>`);
    root.appendChild(screen);

    switch (currentStep) {
      case "intro":      screen.appendChild(renderIntro()); break;
      case "categories": screen.appendChild(renderCategories()); break;
      case "detail":     screen.appendChild(renderDetail()); break;
      case "brand":      screen.appendChild(renderBrand()); break;
      case "budget":     screen.appendChild(renderBudget()); break;
      case "strategy":   screen.appendChild(renderStrategy()); break;
      case "infra":      screen.appendChild(renderInfra()); break;
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

  /* Лента выбранных категорий — видна на шагах после "categories" */
  function renderCategoryStrip() {
    if (!state.categories.length) return null;
    if (currentStep === "intro" || currentStep === "categories") return null;
    // Активная категория — если внутри wizard'а одной из них
    let activeCat = null;
    if (currentStep === "detail" && detailView.startsWith("cat:")) {
      activeCat = detailView.slice(4);
    }
    const chips = state.categories.map(catKey => {
      const cat = PODBOR_CATEGORIES.find(c => c.key === catKey);
      const filled = isCategoryFilled(catKey);
      const isActive = catKey === activeCat;
      return `
        <button class="cat-strip-chip${isActive ? " active" : ""}${filled ? " filled" : ""}" data-cat="${catKey}">
          <span class="cat-strip-icon">${ICONS[cat.icon] || ""}</span>
          <span class="cat-strip-label">${cat.label}</span>
          ${filled ? `<span class="cat-strip-tick">${ICONS.check}</span>` : ""}
        </button>
      `;
    }).join("");
    const node = el(`<div class="cat-strip">${chips}</div>`);
    node.querySelectorAll(".cat-strip-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const cat = btn.dataset.cat;
        currentStep = "detail";
        detailView = "cat:" + cat;
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
        haptic && haptic("impact");
      });
    });
    return node;
  }

  function renderProgress() {
    const idx = STEPS.indexOf(currentStep);
    const total = STEPS.length;
    const pct = Math.round(((idx + 1) / total) * 100);
    return el(`
      <div class="podbor-progress">
        <div class="podbor-progress-bar"><div class="bar" style="width:${pct}%"></div></div>
        <div class="podbor-progress-meta">
          <span>${STEP_LABELS[idx] || ""}</span><span class="num">${idx + 1}/${total}</span>
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
            <span class="field-error" id="nameError"></span>
          </label>
        </div>
        <div class="form-row">
          <label class="field">
            <span class="field-label">Телефон</span>
            <input type="tel" data-bind="client_phone" value="${state.client_phone || ""}" placeholder="+7 900 123-45-67">
            <span class="field-hint">Формат: +7, 8, или 10 цифр начиная с 9</span>
            <span class="field-error" id="phoneError"></span>
          </label>
        </div>

        <div class="podbor-cta-row">
          <button class="btn-primary" id="introNext">Начать</button>
        </div>
      </section>
    `);
    bindInputs(node);

    const phoneInput = node.querySelector("input[data-bind='client_phone']");
    const phoneError = node.querySelector("#phoneError");
    const nameInput = node.querySelector("input[data-bind='client_name']");
    const nameError = node.querySelector("#nameError");

    // Валидация на blur — мягкие подсказки
    phoneInput.addEventListener("blur", () => {
      const v = phoneInput.value.trim();
      if (v && !isValidPhone(v)) {
        phoneError.textContent = "Похоже на неполный номер. Нужно 11 цифр (или 10 с цифры 9)";
      } else {
        phoneError.textContent = "";
      }
    });

    node.querySelector("#introNext").addEventListener("click", () => {
      // Имя
      const name = (state.client_name || "").trim();
      if (!name) {
        nameError.textContent = "Укажите имя клиента";
        nameInput.focus();
        haptic && haptic("warning");
        return;
      } else {
        nameError.textContent = "";
      }

      // Телефон
      const phone = (state.client_phone || "").trim();
      if (!phone) {
        phoneError.textContent = "Укажите телефон клиента";
        phoneInput.focus();
        haptic && haptic("warning");
        return;
      }
      if (!isValidPhone(phone)) {
        phoneError.textContent = "Неверный формат. Пример: +7 900 123-45-67 или 89001234567";
        phoneInput.focus();
        haptic && haptic("warning");
        return;
      }
      // Нормализуем перед переходом
      const normalized = normalizePhone(phone);
      if (normalized !== phone) {
        update({ client_phone: normalized });
      }
      go("categories");
    });

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
    const cs = state.per_cat[catKey];
    if (!cs) return false;
    const config = PODBOR_PARAMS[catKey];
    if (!config) return false;
    // Новая схема: все активные single-шаги должны иметь ответ. Multi (features) — необязательно.
    if (config.steps) {
      const ans = cs.answers || {};
      return config.steps.every(step => {
        if (!isStepActive(step, ans)) return true; // неактивный пропускаем
        if (step.type === "multi") return true;     // multi необязателен
        return !!ans[step.key];
      });
    }
    // Старая схема
    if (!cs.params) return false;
    const params = config.primary || [];
    return params.every(p => cs.params[p.key]);
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
      const config = PODBOR_PARAMS[catKey];
      // Новая иерархическая схема → wizard. Старая → legacy-форма.
      if (config?.steps) return renderCategoryWizard(catKey);
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
          <button class="btn-primary" data-go="brand">Дальше</button>
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
    const cs = state.per_cat[catKey];
    if (!cs) return "—";
    const config = PODBOR_PARAMS[catKey];
    // Новая схема
    if (config?.steps) {
      const ans = cs.answers || {};
      const labels = [];
      for (const step of config.steps) {
        if (step.type === "multi") continue;
        if (!isStepActive(step, ans)) continue;
        const val = ans[step.key];
        if (!val) continue;
        const opts = resolveStepOptions(step, ans);
        const opt = opts.find(o => o.key === val);
        if (opt) labels.push(opt.label);
      }
      return labels.join(" · ") || "—";
    }
    // Старая схема
    if (!cs.params) return "—";
    const params = config?.primary || [];
    const labels = params
      .map(p => {
        const opt = p.options.find(o => o.key === cs.params[p.key]);
        return opt ? opt.label : null;
      })
      .filter(Boolean);
    return labels.join(" · ") || "—";
  }

  /* Возвращает реальный options[] для шага с учётом optionsBy */
  function resolveStepOptions(step, answers) {
    if (step.options) return step.options;
    if (step.optionsBy) {
      const depVal = answers[step.optionsBy.dependsOn];
      return (step.optionsBy.map && step.optionsBy.map[depVal]) || [];
    }
    return [];
  }

  /* Активен ли шаг (выполняется ли condition) */
  function isStepActive(step, answers) {
    if (!step.condition) return true;
    for (const [key, expected] of Object.entries(step.condition)) {
      const actual = answers[key];
      const ok = Array.isArray(expected) ? expected.includes(actual) : actual === expected;
      if (!ok) return false;
    }
    return true;
  }

  /* Найти следующий активный шаг (или steps.length если все после inactive) */
  function findNextActiveIdx(steps, fromIdx, answers) {
    for (let i = fromIdx + 1; i < steps.length; i++) {
      if (isStepActive(steps[i], answers)) return i;
    }
    return steps.length;
  }

  /* Найти предыдущий активный (или -1) */
  function findPrevActiveIdx(steps, fromIdx, answers) {
    for (let i = fromIdx - 1; i >= 0; i--) {
      if (isStepActive(steps[i], answers)) return i;
    }
    return -1;
  }

  /* ===================== Иерархический wizard внутри категории ===================== */

  function getCatState(catKey) {
    const cs = state.per_cat[catKey];
    if (cs && cs.answers) {
      // Чистим ответы для шагов, которых больше нет в текущей схеме
      // (нужно при обновлении логики категории: например убрали класс энерго у ПММ)
      const config = PODBOR_PARAMS[catKey];
      if (config?.steps) {
        const validKeys = new Set(config.steps.map(s => s.key));
        const filtered = {};
        for (const [k, v] of Object.entries(cs.answers)) {
          if (validKeys.has(k)) filtered[k] = v;
        }
        if (Object.keys(filtered).length !== Object.keys(cs.answers).length) {
          cs.answers = filtered;
        }
      }
      return cs;
    }
    // Миграция / инициализация
    return { answers: {}, notes: cs?.notes || "", _step: 0 };
  }

  function setCatState(catKey, patch) {
    const prev = getCatState(catKey);
    const next = { ...prev, ...patch };
    update({ per_cat: { ...state.per_cat, [catKey]: next } });
  }

  function renderCategoryWizard(catKey) {
    const cat = PODBOR_CATEGORIES.find(x => x.key === catKey);
    const config = PODBOR_PARAMS[catKey];
    const cs = getCatState(catKey);
    let stepIdx = Math.max(0, Math.min(cs._step || 0, config.steps.length));

    // Нормализация: пропускаем неактивные шаги вперёд
    while (stepIdx < config.steps.length && !isStepActive(config.steps[stepIdx], cs.answers)) {
      stepIdx++;
    }

    // Финальный экран категории — обзор + заметки + кнопка "Готово"
    if (stepIdx >= config.steps.length) {
      return renderCategoryReview(catKey);
    }

    const step = config.steps[stepIdx];
    const options = resolveStepOptions(step, cs.answers);
    const isMulti = step.type === "multi";
    const currentVal = cs.answers[step.key];
    const currentArr = isMulti ? (Array.isArray(currentVal) ? currentVal : []) : null;

    // Чипы прошлых ответов (single-шаги)
    const prevChips = config.steps.slice(0, stepIdx)
      .filter(s => s.type !== "multi")
      .map(s => {
        const v = cs.answers[s.key];
        if (!v) return "";
        const opts = resolveStepOptions(s, cs.answers);
        const o = opts.find(x => x.key === v);
        return o ? `<span class="wiz-chip" data-jump="${s.key}">${o.label}</span>` : "";
      }).join("");

    // Определяем layout: если ни у одной опции нет pict — компактные пин-кнопки,
    // иначе — крупные карточки с пиктограммами.
    const hasPicts = options.some(o => o.pict && PODBOR_PICTS[o.pict]);
    const gridMode = hasPicts ? "cards" : "pins";

    const cardsHtml = options.map(o => {
      const isOn = isMulti ? currentArr.includes(o.key) : currentVal === o.key;
      const pict = o.pict && PODBOR_PICTS[o.pict];
      const cardCls = "wiz-card" + (hasPicts ? "" : " wiz-card--pin") + (isOn ? " on" : "") + (o.star ? " star" : "");
      if (hasPicts) {
        return `
          <button class="${cardCls}" data-val="${o.key}">
            ${pict ? `<div class="wiz-pict">${pict}</div>` : `<div class="wiz-pict wiz-pict-placeholder"></div>`}
            <div class="wiz-label">${o.label}</div>
            ${o.hint ? `<div class="wiz-hint">${o.hint}</div>` : ""}
            ${isOn ? `<div class="wiz-tick">${ICONS.check}</div>` : ""}
          </button>
        `;
      }
      // Пин-режим: компактная inline-кнопка с label, опц. hint мелкий справа
      return `
        <button class="${cardCls}" data-val="${o.key}">
          <span class="wiz-label">${o.label}</span>
          ${o.hint ? `<span class="wiz-hint">${o.hint}</span>` : ""}
          ${isOn ? `<span class="wiz-tick">${ICONS.check}</span>` : ""}
        </button>
      `;
    }).join("");

    const stepNum = stepIdx + 1;
    const stepTotal = config.steps.length;

    const node = el(`
      <section class="podbor-step podbor-wizard">
        <header class="wiz-header">
          <button class="podbor-back" aria-label="Назад">${ICONS.arrow_left}</button>
          <div class="wiz-header-meta">
            <div class="wiz-cat">${cat.label}</div>
            <div class="wiz-progress">Шаг ${stepNum} из ${stepTotal}</div>
          </div>
          <div class="wiz-cat-icon">${ICONS[cat.icon] || ""}</div>
        </header>

        ${prevChips ? `<div class="wiz-chips">${prevChips}</div>` : ""}

        <h3 class="wiz-title">${step.title}${isMulti ? ' <span class="wiz-multi">· можно несколько</span>' : ""}</h3>

        <div class="wiz-grid wiz-grid--${gridMode}">${cardsHtml}</div>

        <div class="podbor-cta-row">
          ${stepIdx > 0
            ? `<button class="btn-secondary" id="wizPrev">Назад</button>`
            : `<button class="btn-secondary" id="wizMenu">К списку</button>`
          }
          ${isMulti
            ? `<button class="btn-primary" id="wizNext">Дальше</button>`
            : (currentVal ? `<button class="btn-primary" id="wizNext">Дальше</button>` : "")
          }
        </div>
      </section>
    `);

    // Клик по карточке
    node.querySelectorAll(".wiz-card").forEach(card => {
      card.addEventListener("click", () => {
        const val = card.dataset.val;
        const cs2 = getCatState(catKey);
        const newAns = { ...cs2.answers };
        if (isMulti) {
          const arr = Array.isArray(newAns[step.key]) ? newAns[step.key] : [];
          newAns[step.key] = arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
        } else {
          newAns[step.key] = val;
          // Если меняем answer для шага, от которого зависят следующие — сбросим их answers
          for (let i = stepIdx + 1; i < config.steps.length; i++) {
            const s = config.steps[i];
            if (s.optionsBy && s.optionsBy.dependsOn === step.key) {
              delete newAns[s.key];
            }
            if (s.condition && Object.prototype.hasOwnProperty.call(s.condition, step.key)) {
              delete newAns[s.key];
            }
          }
        }
        setCatState(catKey, { answers: newAns });
        // Single-select: автопереход на следующий АКТИВНЫЙ шаг
        if (!isMulti) {
          const nextIdx = findNextActiveIdx(config.steps, stepIdx, newAns);
          setCatState(catKey, { _step: nextIdx });
          haptic && haptic("impact");
        }
        render();
      });
    });

    // Чипы — клик возвращает к шагу
    node.querySelectorAll(".wiz-chip[data-jump]").forEach(chip => {
      chip.addEventListener("click", () => {
        const targetKey = chip.dataset.jump;
        const targetIdx = config.steps.findIndex(s => s.key === targetKey);
        if (targetIdx >= 0) {
          setCatState(catKey, { _step: targetIdx });
          render();
        }
      });
    });

    // Кнопки — через активные шаги
    const wizPrev = node.querySelector("#wizPrev");
    if (wizPrev) wizPrev.addEventListener("click", () => {
      const prevIdx = findPrevActiveIdx(config.steps, stepIdx, cs.answers);
      setCatState(catKey, { _step: Math.max(0, prevIdx) });
      render();
    });
    const wizMenu = node.querySelector("#wizMenu");
    if (wizMenu) wizMenu.addEventListener("click", () => { detailView = "menu"; render(); });
    const wizNext = node.querySelector("#wizNext");
    if (wizNext) wizNext.addEventListener("click", () => {
      const nextIdx = findNextActiveIdx(config.steps, stepIdx, cs.answers);
      setCatState(catKey, { _step: nextIdx });
      haptic && haptic("impact");
      render();
    });
    // Header back — на предыдущий активный или к меню
    node.querySelector(".podbor-back").addEventListener("click", () => {
      const prevIdx = findPrevActiveIdx(config.steps, stepIdx, cs.answers);
      if (prevIdx >= 0) {
        setCatState(catKey, { _step: prevIdx });
        render();
      } else {
        detailView = "menu";
        render();
      }
    });

    return node;
  }

  function renderCategoryReview(catKey) {
    const cat = PODBOR_CATEGORIES.find(x => x.key === catKey);
    const config = PODBOR_PARAMS[catKey];
    const cs = getCatState(catKey);

    const rows = config.steps.filter(step => isStepActive(step, cs.answers)).map(step => {
      const v = cs.answers[step.key];
      const opts = resolveStepOptions(step, cs.answers);
      if (step.type === "multi") {
        const arr = Array.isArray(v) ? v : [];
        const labels = arr.map(k => opts.find(o => o.key === k)?.label).filter(Boolean);
        return `
          <div class="rev-row">
            <div class="rev-label">${step.title}</div>
            <div class="rev-val">${labels.length ? labels.join(" · ") : '<span class="muted">не выбрано</span>'}</div>
          </div>
        `;
      }
      const opt = opts.find(o => o.key === v);
      return `
        <div class="rev-row">
          <div class="rev-label">${step.title}</div>
          <div class="rev-val">${opt ? opt.label : '<span class="muted">—</span>'}</div>
        </div>
      `;
    }).join("");

    const node = el(`
      <section class="podbor-step podbor-wizard">
        <header class="wiz-header">
          <button class="podbor-back" aria-label="Назад">${ICONS.arrow_left}</button>
          <div class="wiz-header-meta">
            <div class="wiz-cat">${cat.label}</div>
            <div class="wiz-progress">Готово</div>
          </div>
          <div class="wiz-cat-icon">${ICONS[cat.icon] || ""}</div>
        </header>

        <h3 class="wiz-title">Проверьте ответы</h3>

        <div class="rev-list">${rows}</div>

        <label class="field">
          <span class="field-label">Заметки по категории</span>
          <textarea data-bind="cat_notes" rows="2" placeholder="Особые пожелания клиента?">${cs.notes || ""}</textarea>
        </label>

        <div class="podbor-cta-row">
          <button class="btn-secondary" id="wizEdit">Изменить</button>
          <button class="btn-primary" id="wizDone">К списку категорий</button>
        </div>
      </section>
    `);
    node.querySelector("#wizEdit").addEventListener("click", () => {
      setCatState(catKey, { _step: 0 });
      render();
    });
    node.querySelector("#wizDone").addEventListener("click", () => {
      detailView = "menu";
      haptic && haptic("success");
      render();
    });
    node.querySelector(".podbor-back").addEventListener("click", () => {
      setCatState(catKey, { _step: config.steps.length - 1 });
      render();
    });
    const ta = node.querySelector("textarea[data-bind='cat_notes']");
    if (ta) ta.addEventListener("input", e => {
      setCatState(catKey, { notes: e.target.value });
    });
    return node;
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

  function formatRub(n) {
    if (!n) return "—";
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  /* Универсальный рендер пин-карточек (label + hint, single или multi) */
  function renderPinCards(items, getStatus, onClick, opts = {}) {
    const html = items.map(o => {
      const status = getStatus(o); // 'on' | 'on-star' | ''
      const isOn = status === "on" || status === "on-star";
      const cls = "wiz-card wiz-card--pin" + (isOn ? " on" : "") + (o.recommended ? " star" : "");
      return `
        <button class="${cls}" data-key="${o.key}">
          <span class="wiz-label">${o.label}</span>
          ${o.hint ? `<span class="wiz-hint">${o.hint}</span>` : ""}
          ${isOn ? `<span class="wiz-tick">${ICONS.check}</span>` : ""}
        </button>
      `;
    }).join("");
    const wrap = el(`<div class="wiz-grid wiz-grid--pins">${html}</div>`);
    wrap.querySelectorAll(".wiz-card").forEach(btn => {
      btn.addEventListener("click", () => {
        onClick(btn.dataset.key);
      });
    });
    return wrap;
  }

  /* ===================== Step: brand (бренд-стратегия + выбор) ===================== */

  function renderBrand() {
    const bs = state.brand_strategy || "";
    const strategyGrid = renderPinCards(
      PODBOR_BRAND_STRATEGY,
      o => (bs === o.key ? "on" : ""),
      key => { update({ brand_strategy: key }); render(); }
    );

    // Подблок зависит от выбранной стратегии
    let subBlock = "";
    if (bs === "single") {
      const sb = state.single_brand || "";
      const cardsHtml = PODBOR_SINGLE_BRAND_OPTIONS.map(o => {
        const on = sb === o.key;
        return `
          <button class="wiz-card wiz-card--pin${on ? " on" : ""}${o.recommended ? " star" : ""}" data-sb="${o.key}">
            <span class="wiz-label">${o.label}</span>
            ${o.tier ? `<span class="wiz-hint">${tierLabel(o.tier)}</span>` : ""}
            ${on ? `<span class="wiz-tick">${ICONS.check}</span>` : ""}
          </button>
        `;
      }).join("");
      subBlock = `
        <div class="block">
          <div class="block-head">Какая марка</div>
          <div class="wiz-grid wiz-grid--pins">${cardsHtml}</div>
        </div>
      `;
    } else if (bs === "different") {
      // Чипы по категориям с 4-state статусами (none → preferred → acceptable → avoid → none)
      const blocks = state.categories.map(catKey => {
        const cat = PODBOR_CATEGORIES.find(x => x.key === catKey);
        const brands = PODBOR_BRANDS[catKey] || { premium: [], middle: [], budget: [] };
        const catState = state.brands[catKey] || {};
        const tierGroup = (tier) => `
          <div class="brand-chips brand-tier-${tier}">
            ${(brands[tier] || []).map(b => {
              const status = catState[b] || "none";
              return `<button class="chip tier-${tier} status-${status}" data-cat="${catKey}" data-brand="${b}">${b}</button>`;
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
      subBlock = `
        <div class="hint">Тап — ★ хочу · повторно — ✓ согласен · третий — ✗ не хочу · четвёртый — снять</div>
        ${blocks}
      `;
    } else if (bs === "ai") {
      subBlock = `
        <div class="block">
          <div class="hint">AI подберёт оптимальный микс брендов под выбранный бюджет и стратегию. Можно ничего больше не указывать.</div>
        </div>
      `;
    }

    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">Бренд<br><span class="accent">стратегия</span></h2>
        <p class="lede">Хочет ли клиент всю технику от одной марки, или собираем оптимальный микс?</p>
      </section>
    `);
    node.appendChild(strategyGrid);
    if (subBlock) {
      const sub = el(`<div>${subBlock}</div>`);
      node.appendChild(sub);
      // Single-brand chips
      sub.querySelectorAll("[data-sb]").forEach(b => {
        b.addEventListener("click", () => {
          update({ single_brand: b.dataset.sb });
          render();
        });
      });
      // Different-brand 4-state cycle
      sub.querySelectorAll(".chip[data-brand]").forEach(c => {
        c.addEventListener("click", () => {
          const catKey = c.dataset.cat, brand = c.dataset.brand;
          const cur = (state.brands[catKey] || {})[brand] || "none";
          const nextStatus = cur === "none" ? "preferred"
                          : cur === "preferred" ? "acceptable"
                          : cur === "acceptable" ? "avoid"
                          : "none";
          const catBrands = { ...(state.brands[catKey] || {}) };
          if (nextStatus === "none") delete catBrands[brand];
          else catBrands[brand] = nextStatus;
          update({ brands: { ...state.brands, [catKey]: catBrands } });
          render();
        });
      });
    }
    const cta = el(`
      <div class="podbor-cta-row">
        <button class="btn-secondary" data-go="detail">Назад</button>
        <button class="btn-primary" data-go="budget"${bs ? "" : " disabled"}>Дальше</button>
      </div>
    `);
    node.appendChild(cta);
    bindNav(node);
    return node;
  }

  function tierLabel(tier) {
    return tier === "premium" ? "премиум" : tier === "middle" ? "средний" : tier === "budget" ? "бюджет" : "";
  }

  /* ===================== Step: budget (пресет или точные цифры) ===================== */

  function renderBudget() {
    const bp = state.budget_preset || "";

    // Считаем суммарную долю выбранных категорий от полного комплекта
    const share = (state.categories || []).reduce(
      (s, c) => s + (PODBOR_BUDGET_SHARES[c] || 0), 0
    ) / 100;
    const shareSafe = share > 0 ? share : 1;

    // Подмешиваем hint с реальной вилкой для выбранных категорий
    const presetsWithRange = PODBOR_BUDGET_PRESETS.map(o => {
      if (o.key === "exact") return { ...o, hint: o.desc };
      const r = PODBOR_BUDGET_RANGES[o.key];
      if (!r) return { ...o, hint: o.desc };
      const from = Math.round(r.from * shareSafe);
      const to   = Math.round(r.to   * shareSafe);
      const label = from >= 1000 ? `${(from/1000).toFixed(1)}–${(to/1000).toFixed(1)}М ₽` : `${from}–${to} тыс ₽`;
      return { ...o, hint: `${label} · ${o.desc}` };
    });

    const presetGrid = renderPinCards(
      presetsWithRange,
      o => (bp === o.key ? "on" : ""),
      key => { update({ budget_preset: key }); render(); }
    );

    // Если "exact" — показываем поля от-до по категориям
    let exactBlock = null;
    if (bp === "exact") {
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
      exactBlock = el(`
        <div class="block">
          <div class="block-head">По категориям, ₽</div>
          <div class="price-list">${rows}</div>
          <div class="price-total" id="priceTotalLine">${
            (totalFrom || totalTo)
              ? `Итого: <strong>${formatRub(totalFrom)} — ${formatRub(totalTo)} ₽</strong>`
              : `<span class="muted">Сумма посчитается автоматически</span>`
          }</div>
        </div>
      `);
      // Внимание: НЕ вызываем render() на input — иначе клавиатура слетает
      exactBlock.querySelectorAll("[data-price]").forEach(inp => {
        inp.addEventListener("input", e => {
          const [cat, key] = e.target.dataset.price.split(".");
          const next = { ...state.price_ranges, [cat]: { ...(state.price_ranges[cat] || {}), [key]: e.target.value } };
          update({ price_ranges: next });
          // Локально пересчитываем сумму
          let tf = 0, tt = 0;
          state.categories.forEach(c => {
            const r = state.price_ranges[c] || {};
            if (r.from) tf += parseInt(r.from, 10) || 0;
            if (r.to)   tt += parseInt(r.to, 10) || 0;
          });
          const line = exactBlock.querySelector("#priceTotalLine");
          if (line) {
            line.innerHTML = (tf || tt)
              ? `Итого: <strong>${formatRub(tf)} — ${formatRub(tt)} ₽</strong>`
              : `<span class="muted">Сумма посчитается автоматически</span>`;
          }
        });
      });
    }

    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">Бюджет<br><span class="accent">на технику</span></h2>
        <p class="lede">Выбери диапазон. AI сам распределит бюджет по категориям (холодильник ~25%, варочная ~15%, духовка ~15% и т.д.).</p>
      </section>
    `);
    node.appendChild(presetGrid);
    if (exactBlock) node.appendChild(exactBlock);
    const cta = el(`
      <div class="podbor-cta-row">
        <button class="btn-secondary" data-go="brand">Назад</button>
        <button class="btn-primary" data-go="strategy"${bp ? "" : " disabled"}>Дальше</button>
      </div>
    `);
    node.appendChild(cta);
    bindNav(node);
    return node;
  }

  /* ===================== Step: strategy (что важно при подборе — multi) ===================== */

  function renderStrategy() {
    const cur = state.pick_strategies || [];
    const grid = renderPinCards(
      PODBOR_PICK_STRATEGIES,
      o => (cur.includes(o.key) ? "on" : ""),
      key => {
        const next = cur.includes(key) ? cur.filter(x => x !== key) : [...cur, key];
        update({ pick_strategies: next });
        render();
      }
    );

    // Количество моделей в категории
    const mc = state.model_count || "5";
    const countGrid = renderPinCards(
      PODBOR_MODEL_COUNTS,
      o => (mc === o.key ? "on" : ""),
      key => { update({ model_count: key }); render(); }
    );

    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">Стратегия<br><span class="accent">подбора</span></h2>
        <p class="lede">Что для клиента важно при выборе? Можно несколько — AI учтёт всё.</p>
      </section>
    `);
    node.appendChild(grid);

    const countHead = el(`
      <div class="block">
        <div class="block-head">Сколько моделей предложить</div>
      </div>
    `);
    countHead.appendChild(countGrid);
    node.appendChild(countHead);

    const cta = el(`
      <div class="podbor-cta-row">
        <button class="btn-secondary" data-go="budget">Назад</button>
        <button class="btn-primary" data-go="infra">Дальше</button>
      </div>
    `);
    node.appendChild(cta);
    bindNav(node);
    return node;
  }

  /* ===================== Step: infra ===================== */

  function renderInfra() {
    const cats = state.categories || [];
    const askStove = cats.includes("hob");
    const askVent  = cats.includes("hood");

    // Если ни одна из релевантных категорий не выбрана — пропускаем шаг
    if (!askStove && !askVent) {
      // Автопереход на summary через микропаузу (чтобы пользователь увидел)
      setTimeout(() => { go("summary"); }, 50);
      return el(`
        <section class="podbor-step">
          <p class="lede" style="text-align:center;padding:30px;">
            Инфраструктурные вопросы для выбранных категорий не требуются — переходим к итогу...
          </p>
        </section>
      `);
    }

    const stoveBlock = askStove ? `
      <div class="block">
        <div class="block-head">Подключение варочной</div>
        <div class="opt-list">
          ${PODBOR_INFRA.stove.map(o => `
            <button class="opt${state.infra.stove === o.key ? " on" : ""}" data-infra="stove" data-val="${o.key}">${o.label}</button>
          `).join("")}
        </div>
      </div>
    ` : "";

    const ventBlock = askVent ? `
      <div class="block">
        <div class="block-head">Вытяжка → внутридомовая вентиляция?</div>
        <div class="opt-list">
          ${PODBOR_INFRA.vent.map(o => `
            <button class="opt${state.infra.vent === o.key ? " on" : ""}" data-infra="vent" data-val="${o.key}">${o.label}</button>
          `).join("")}
        </div>
        <div class="hint">Если «Нет» — менеджер закладывает угольный фильтр. Если «Да» — заранее планируем выводы.</div>
      </div>
    ` : "";

    const lede = (askStove && askVent)
      ? "Газ или электрика — определит тип варочной. Подключение вытяжки — нужны ли выводы или угольный фильтр."
      : askStove
      ? "Газ или электрика — определит тип варочной (индукция / стеклокерамика / газ)."
      : "Подключение вытяжки — нужны ли выводы в вентшахту или угольный фильтр.";

    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">Инфраструктура<br><span class="accent">кухни</span></h2>
        <p class="lede">${lede}</p>
        ${stoveBlock}
        ${ventBlock}
        <div class="podbor-cta-row">
          <button class="btn-secondary" data-go="strategy">Назад</button>
          <button class="btn-primary" data-go="summary">Дальше</button>
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

  /* ===================== Step: summary + submit ===================== */

  function renderSummary() {
    // Бренд-стратегия
    const bs = state.brand_strategy;
    const bsLabel = PODBOR_BRAND_STRATEGY.find(s => s.key === bs)?.label || "—";
    let brandDetail = "";
    if (bs === "single") {
      const sb = PODBOR_SINGLE_BRAND_OPTIONS.find(o => o.key === state.single_brand);
      brandDetail = sb ? ` · ${sb.label}` : "";
    } else if (bs === "different") {
      const totalBrands = Object.values(state.brands || {}).reduce((s, c) => s + Object.keys(c || {}).length, 0);
      brandDetail = totalBrands ? ` · ${totalBrands} отметок` : "";
    }

    // Бюджет
    const bp = state.budget_preset;
    const bpDef = PODBOR_BUDGET_PRESETS.find(p => p.key === bp);
    let budgetLabel = bpDef?.label || "—";
    if (bp === "exact") {
      let totalFrom = 0, totalTo = 0;
      state.categories.forEach(c => {
        const r = state.price_ranges[c] || {};
        totalFrom += parseInt(r.from || "0", 10) || 0;
        totalTo   += parseInt(r.to   || "0", 10) || 0;
      });
      if (totalFrom || totalTo) budgetLabel = `${formatRub(totalFrom)} — ${formatRub(totalTo)} ₽`;
    } else if (bpDef?.hint) {
      budgetLabel = `${bpDef.label} · ${bpDef.hint}`;
    }

    // Стратегия подбора
    const strategyLabels = (state.pick_strategies || [])
      .map(k => PODBOR_PICK_STRATEGIES.find(s => s.key === k)?.label)
      .filter(Boolean).join(" · ");

    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">Готово<br><span class="accent">к подбору</span></h2>
        <p class="lede">Проверьте и отправьте — AI вернёт предложение в чат с ботом.</p>
        <div class="block summary-block">
          <div class="kv"><span>Клиент</span><strong>${state.client_name || "—"}</strong></div>
          <div class="kv"><span>Категорий</span><strong>${state.categories.length}</strong></div>
          <div class="kv"><span>Бренд</span><strong>${bsLabel}${brandDetail}</strong></div>
          <div class="kv"><span>Бюджет</span><strong>${budgetLabel}</strong></div>
          <div class="kv"><span>Стратегия</span><strong>${strategyLabels || "—"}</strong></div>
          ${state.categories.includes("hob") ? `<div class="kv"><span>Подключение</span><strong>${PODBOR_INFRA.stove.find(f => f.key === state.infra.stove)?.label || "—"}</strong></div>` : ""}
          ${state.categories.includes("hood") ? `<div class="kv"><span>Вентиляция</span><strong>${PODBOR_INFRA.vent.find(f => f.key === state.infra.vent)?.label || "—"}</strong></div>` : ""}
        </div>

        <label class="field">
          <span class="field-label">Дополнительные пожелания</span>
          <textarea data-bind="notes" rows="3" placeholder="Что-то особенное от клиента?">${state.notes || ""}</textarea>
        </label>

        <div class="podbor-cta-row">
          <button class="btn-secondary" id="summaryBack">Назад</button>
          <button class="btn-primary" id="submitBtn">Отправить · AI подберёт</button>
        </div>

        <div id="submitResult" class="submit-result"></div>
      </section>
    `);
    bindInputs(node);
    bindNav(node);
    // Кнопка "Назад" — обходим infra если она авто-пропускается
    node.querySelector("#summaryBack").addEventListener("click", () => {
      const cats = state.categories || [];
      const goTo = (cats.includes("hob") || cats.includes("hood")) ? "infra" : "strategy";
      go(goTo);
    });
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
      // Финальная нормализация телефона перед отправкой
      const normPhone = normalizePhone(state.client_phone || "");
      if (normPhone && normPhone !== state.client_phone) {
        update({ client_phone: normPhone });
      }
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
        // Успех + красивый inline-отчёт под кнопкой
        const headSuccess = `
          <div class="success">
            <div class="success-icon">${ICONS.check}</div>
            <div>
              <div class="success-title">Подбор готов</div>
              <div class="success-sub">Лид #${(data.id || "").slice(0, 6)} · также отправлен в Telegram</div>
            </div>
          </div>
        `;
        result.innerHTML = headSuccess;
        // Рендер отчёта (если AI вернул by_category)
        if (data.ai) {
          const reportNode = renderReport(data.ai, data.id || "");
          result.appendChild(reportNode);
        }
        haptic && haptic("success");
        // Скроллим к отчёту
        setTimeout(() => result.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    } catch (e) {
      result.innerHTML = `<div class="error">Сеть: ${e.message}</div>`;
    }
    btn.disabled = false;
    btn.textContent = "Отправить ещё раз";
  }

  /* ===================== Отчёт (inline, в шаге summary) ===================== */

  function renderReport(ai, leadId) {
    const summary = ai.summary || "";
    const byCat = ai.by_category || {};
    const total = ai.total_price_estimate_rub || {};
    const budgetStatus = ai.budget_status || "";
    const warnings = ai.warnings || [];

    const wrap = el(`<section class="report"></section>`);

    // Шапка
    wrap.appendChild(el(`
      <div class="report-head">
        <div class="kicker">Отчёт · ${leadId.slice(0, 8)}</div>
        ${summary ? `<p class="report-summary">${_esc(summary)}</p>` : ""}
      </div>
    `));

    // Категории
    for (const [catKey, catData] of Object.entries(byCat)) {
      const catMeta = PODBOR_CATEGORIES.find(c => c.key === catKey);
      const catLabel = catMeta?.label || catKey;
      const catIcon = catMeta?.icon;
      const models = (catData && catData.models) || [];
      const catAnalysis = (catData && catData.analysis) || "";
      if (!models.length) continue;

      const catNode = el(`
        <div class="report-cat">
          <h3 class="report-cat-head">
            <span class="report-cat-icon">${(catIcon && ICONS[catIcon]) || ""}</span>
            ${_esc(catLabel)}
          </h3>
          ${catAnalysis ? `<div class="report-cat-analysis">${_esc(catAnalysis)}</div>` : ""}
        </div>
      `);

      // Сравнение цен — основной блок, всегда вверху
      const matrixNode = _renderPriceMatrix(models);
      if (matrixNode) catNode.appendChild(matrixNode);

      // Детальные карточки с pros/cons
      const modelsWrap = el(`<div class="report-models"></div>`);
      for (const m of models) {
        modelsWrap.appendChild(_renderModelCard(m));
      }
      catNode.appendChild(modelsWrap);

      wrap.appendChild(catNode);
    }

    // Итого
    if (total && (total.min || total.max)) {
      const tmin = total.min, tmax = total.max;
      const range = (tmin && tmax && tmin !== tmax)
        ? `${formatRub(tmin)} — ${formatRub(tmax)} ₽`
        : `${formatRub(tmin || tmax)} ₽`;
      wrap.appendChild(el(`
        <div class="report-total">
          <span class="lbl">ИТОГО</span>
          <strong>${range}</strong>
          ${budgetStatus ? `<span class="status">${_esc(budgetStatus)}</span>` : ""}
        </div>
      `));
    }

    // Предупреждения
    if (warnings.length) {
      const wn = el(`<div class="report-warnings"></div>`);
      warnings.forEach(w => wn.appendChild(el(`<div>⚠️ ${_esc(w)}</div>`)));
      wrap.appendChild(wn);
    }

    // Кнопки экспорта в конце
    const exportNode = el(`
      <div class="report-export">
        <div class="report-export-head">Сохранить отчёт</div>
        <div class="report-export-buttons">
          <button class="btn-export" id="exportHtml">⬇ Скачать HTML</button>
          <button class="btn-export" id="exportPrint">🖨 Печать → PDF</button>
        </div>
        <div class="report-export-hint">HTML удобно отправить клиенту в мессенджер · PDF — для печати или вложения</div>
      </div>
    `);
    exportNode.querySelector("#exportHtml").addEventListener("click", () => _exportReportHtml(ai, leadId));
    exportNode.querySelector("#exportPrint").addEventListener("click", () => _exportReportPrint(wrap, leadId));
    wrap.appendChild(exportNode);

    return wrap;
  }

  /* Экспорт: HTML файл с inline стилями и данными — скачивается */
  function _exportReportHtml(ai, leadId) {
    // Создаём stand-alone HTML вокруг текущего DOM отчёта
    const reportEl = document.querySelector(".report");
    if (!reportEl) return;
    // Копируем все стили со страницы (link + style)
    const stylesheets = [];
    document.querySelectorAll("link[rel='stylesheet'], style").forEach(s => stylesheets.push(s.outerHTML));
    const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Подбор техники · ${leadId.slice(0,8)}</title>
${stylesheets.join("\n")}
<style>
  body { background: #FBF7F0; padding: 20px; max-width: 900px; margin: 0 auto; }
  .report-export { display: none; }
  .podbor-header, .podbor-progress, .cat-strip, #submitResult > .success { display: none; }
</style>
</head>
<body>
<h1 style="font-family: 'Newsreader', serif; font-style: italic; color: #1F1A14;">Подбор техники · клиент: ${_esc(state.client_name || "—")}</h1>
${reportEl.outerHTML}
<footer style="margin-top: 40px; padding: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #888; font-family: 'JetBrains Mono', monospace;">
  Отчёт сгенерирован ${new Date().toLocaleString("ru-RU")} · ZOV Tech Picker · Lead ID: ${leadId}
</footer>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `podbor-${leadId.slice(0,8)}-${(state.client_name || "client").replace(/\s+/g, "_")}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    haptic && haptic("success");
  }

  /* Экспорт: открываем системный print диалог — пользователь сохраняет как PDF */
  function _exportReportPrint(reportNode, leadId) {
    // Открываем новое окно с чистой версткой отчёта только
    const reportEl = document.querySelector(".report");
    if (!reportEl) return;
    const stylesheets = [];
    document.querySelectorAll("link[rel='stylesheet'], style").forEach(s => stylesheets.push(s.outerHTML));
    const w = window.open("", "_blank");
    if (!w) { alert("Браузер заблокировал окно. Разрешите всплывающие окна."); return; }
    w.document.write(`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Подбор техники · ${leadId.slice(0,8)} · Печать</title>
${stylesheets.join("\n")}
<style>
  body { background: #fff; padding: 20px; max-width: 900px; margin: 0 auto; }
  .report-export, .podbor-header, .podbor-progress, .cat-strip { display: none; }
  @media print {
    body { padding: 10px; }
    .report-model { page-break-inside: avoid; }
    .report-cat { page-break-after: auto; }
  }
</style>
</head>
<body>
<h1 style="font-family: 'Newsreader', serif; font-style: italic;">Подбор техники · ${_esc(state.client_name || "—")}</h1>
${reportEl.outerHTML}
<script>setTimeout(() => window.print(), 500);<\/script>
</body>
</html>`);
    w.document.close();
    haptic && haptic("success");
  }

  function _renderModelCard(m) {
    const enriched = m.enriched || {};
    const pMin = enriched.price_min_rub || m.price_min_rub;
    const pMax = enriched.price_max_rub || m.price_max_rub;
    const img = enriched.image_url;
    const rating = enriched.rating_max;
    const reviews = enriched.reviews_total;
    const stores = enriched.stores_count;

    const priceHtml = (pMin && pMax && pMin !== pMax)
      ? `<strong>${formatRub(pMin)}</strong> — <strong>${formatRub(pMax)}</strong> ₽`
      : pMin ? `<strong>${formatRub(pMin)}</strong> ₽`
      : `<span class="muted">цена уточняется</span>`;

    const metaParts = [];
    if (rating) metaParts.push(`<span class="rating">★ ${Number(rating).toFixed(1)}</span>`);
    if (reviews) metaParts.push(`<span class="reviews">${reviews} отзыв.</span>`);
    if (stores) metaParts.push(`<span class="stores">${stores} магазинов</span>`);

    // Бейджи источников + ссылки
    const sourcesData = [
      { key: "ozon",     label: "OZON",        item: enriched.ozon },
      { key: "citilink", label: "Citilink",    item: enriched.citilink },
      { key: "wb",       label: "Wildberries", item: enriched.wb },
      { key: "yamarket", label: "Я.Маркет",    item: enriched.yamarket },
      { key: "dns",      label: "DNS",         item: enriched.dns },
    ];
    const sourceLinks = sourcesData
      .filter(s => s.item && s.item.url)
      .map(s => `<a href="${_esc(s.item.url)}" target="_blank" rel="noopener noreferrer" class="report-link report-link--${s.key}">${s.label}${s.item.price_min_rub ? ` · ${formatRub(s.item.price_min_rub)} ₽` : ""}</a>`);

    const card = el(`
      <article class="report-model">
        <div class="report-model-img${img ? "" : " placeholder"}">${img ? `<img src="${_esc(img)}" alt="" loading="lazy">` : ""}</div>
        <div class="report-model-body">
          <div class="report-model-brand">${_esc(m.brand || "")}</div>
          <div class="report-model-name">${_esc(m.model || "")}</div>
          ${metaParts.length ? `<div class="report-model-meta">${metaParts.join(" · ")}</div>` : ""}
          <div class="report-model-price">${priceHtml}</div>
          ${(m.highlights || []).length ? `<div class="report-highlights">✓ ${m.highlights.map(_esc).join(" · ")}</div>` : ""}

          ${(m.pros || []).length ? `
            <div class="report-pros-block">
              <div class="pc-head">Плюсы</div>
              <ul class="pc-list">${m.pros.slice(0, 4).map(p => `<li>${_esc(p)}</li>`).join("")}</ul>
            </div>
          ` : ""}

          ${(m.cons || []).length ? `
            <div class="report-cons-block">
              <div class="pc-head">Минусы</div>
              <ul class="pc-list">${m.cons.slice(0, 3).map(c => `<li>${_esc(c)}</li>`).join("")}</ul>
            </div>
          ` : ""}

          ${_renderSpecsBlock(m.specs || {})}

          ${m.reasoning ? `<div class="report-reasoning">💡 ${_esc(m.reasoning)}</div>` : ""}

          ${_renderUtilityLinks(m)}

          ${sourceLinks.length ? `
            <div class="report-links">
              <div class="report-links-head">${sourceLinks.length} ${_pluralStores(sourceLinks.length)} нашли товар:</div>
              ${sourceLinks.join("")}
            </div>
          ` : `<div class="report-links-empty">— не найден в подключённых магазинах</div>`}
        </div>
      </article>
    `);
    return card;
  }

  /* Спеки технические: габариты, объём, шум, класс энергии, цвет.
     Габариты — критично для проектирования кухни. */
  function _renderSpecsBlock(specs) {
    if (!specs || Object.keys(specs).length === 0) return "";
    const items = [];
    if (specs.dimensions_mm) items.push({ label: "Габариты ШхГxВ", value: `${specs.dimensions_mm} мм`, highlight: true });
    if (specs.volume_l)      items.push({ label: "Объём",          value: `${specs.volume_l} л` });
    if (specs.weight_kg)     items.push({ label: "Вес",            value: `${specs.weight_kg} кг` });
    if (specs.noise_db)      items.push({ label: "Шум",            value: `${specs.noise_db} дБ` });
    if (specs.energy_class)  items.push({ label: "Класс энергии",  value: specs.energy_class });
    if (specs.color)         items.push({ label: "Цвет / материал", value: specs.color });

    if (!items.length) return "";

    return `
      <div class="report-specs">
        <div class="report-specs-head">Характеристики</div>
        <div class="report-specs-grid">
          ${items.map(i => `
            <div class="spec-item${i.highlight ? " highlight" : ""}">
              <div class="spec-label">${_esc(i.label)}</div>
              <div class="spec-value">${_esc(i.value)}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  /* Кнопки "Инструкция" (Google поиск) + "Габариты" (если есть в specs). */
  function _renderUtilityLinks(m) {
    const buttons = [];
    const manualQuery = m.manual_search_query
      || `${m.brand || ""} ${m.model || ""} manual инструкция pdf`.trim();
    if (manualQuery && manualQuery.length > 5) {
      const url = `https://www.google.com/search?q=${encodeURIComponent(manualQuery)}`;
      buttons.push(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="util-link util-link--manual">📄 Инструкция</a>`);
    }
    const dims = (m.specs || {}).dimensions_mm;
    if (dims) {
      const url = `https://www.google.com/search?q=${encodeURIComponent(`${m.brand} ${m.model} габариты схема установки`)}`;
      buttons.push(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="util-link util-link--dims">📐 Схема установки</a>`);
    }
    if (!buttons.length) return "";
    return `<div class="report-util-links">${buttons.join("")}</div>`;
  }

  function _pluralStores(n) {
    const last = n % 10, lastTwo = n % 100;
    if (lastTwo >= 11 && lastTwo <= 14) return "магазинов";
    if (last === 1) return "магазин";
    if (last >= 2 && last <= 4) return "магазина";
    return "магазинов";
  }

  /* Матрица цен: rows = models, cols = магазины, cells = цены, лучшая подсвечена */
  function _renderPriceMatrix(models) {
    if (!models || !models.length) return null;

    const STORES = [
      { key: "ozon",     label: "OZON" },
      { key: "citilink", label: "Citilink" },
      { key: "wb",       label: "Wildberries" },
      { key: "yamarket", label: "Я.Маркет" },
      { key: "dns",      label: "DNS" },
    ];

    // Определяем какие магазины имеют хоть какую-то цену — только их колонки
    const activeStores = STORES.filter(s =>
      models.some(m => (m.enriched || {})[s.key] && ((m.enriched || {})[s.key].price_min_rub || (m.enriched || {})[s.key].url))
    );

    // Если ни один store не дал цены — показываем простую таблицу с AI-ценами
    const showStoresCols = activeStores.length > 0;

    const head = `
      <thead>
        <tr>
          <th class="col-model">Модель</th>
          ${showStoresCols
            ? activeStores.map(s => `<th class="col-store">${s.label}</th>`).join("")
            : `<th class="col-store">Цена (AI)</th>`}
          <th class="col-best">Мин</th>
        </tr>
      </thead>
    `;

    const rows = models.map(m => {
      const enriched = m.enriched || {};
      // Собираем цены по каждому активному магазину
      const cellPrices = showStoresCols
        ? activeStores.map(s => {
            const item = enriched[s.key];
            return {
              store: s.key,
              price: item && item.price_min_rub,
              url: item && item.url,
            };
          })
        : [{ store: "ai", price: enriched.price_min_rub || m.price_min_rub, url: enriched.best_url || null }];

      const validPrices = cellPrices.map(c => c.price).filter(p => p && p > 0);
      const bestPrice = validPrices.length ? Math.min(...validPrices) : null;

      const modelCell = `
        <td class="col-model">
          <div class="m-brand">${_esc(m.brand || "")}</div>
          <div class="m-name">${_esc(m.model || "")}</div>
        </td>
      `;
      const storeCells = cellPrices.map(c => {
        if (!c.price) {
          return c.url
            ? `<td class="cell-price"><a href="${_esc(c.url)}" target="_blank" rel="noopener noreferrer" class="cell-noprice-link">смотреть →</a></td>`
            : `<td class="cell-price empty">—</td>`;
        }
        const isBest = bestPrice && c.price === bestPrice;
        const priceHtml = `<strong>${formatRub(c.price)}</strong> ₽`;
        const cellInner = c.url
          ? `<a href="${_esc(c.url)}" target="_blank" rel="noopener noreferrer">${priceHtml}${isBest ? ' <span class="best-mark">✓</span>' : ''}</a>`
          : `${priceHtml}${isBest ? ' <span class="best-mark">✓</span>' : ''}`;
        return `<td class="cell-price${isBest ? ' best' : ''}">${cellInner}</td>`;
      }).join("");
      const bestCell = `<td class="col-best">${bestPrice ? `<strong>${formatRub(bestPrice)}</strong>` : "—"}</td>`;

      return `<tr>${modelCell}${storeCells}${bestCell}</tr>`;
    }).join("");

    return el(`
      <div class="report-matrix-wrap">
        <div class="report-matrix-head">Цены по магазинам — лучшая отмечена ✓</div>
        <div class="report-matrix-scroll">
          <table class="report-matrix">
            ${head}
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${!showStoresCols ? `<div class="report-matrix-hint">Магазины ещё не нашли товар. Цены — оценка AI на основе текущих рыночных данных.</div>` : ""}
      </div>
    `);
  }

  function _renderCompareTable(models) {
    const rows = models.map(m => {
      const e = m.enriched || {};
      const p = m.price_min_rub || e.price_min_rub;
      return `
        <tr>
          <td><strong>${_esc(m.brand || "")}</strong> ${_esc(m.model || "")}</td>
          <td>${p ? formatRub(p) + " ₽" : "—"}</td>
          <td>${e.reviews_total || "—"}</td>
          <td>${e.rating_max ? Number(e.rating_max).toFixed(1) : "—"}</td>
        </tr>
      `;
    }).join("");

    return el(`
      <details class="report-compare">
        <summary>Сравнить модели</summary>
        <table>
          <thead>
            <tr><th>Модель</th><th>Цена от</th><th>Отзывов</th><th>★</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </details>
    `);
  }

  function _esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ===================== Helpers ===================== */

  function bindInputs(node) {
    node.querySelectorAll("[data-bind]").forEach(inp => {
      inp.addEventListener("input", e => {
        update({ [e.target.dataset.bind]: e.target.value });
      });
      // Нормализация телефона на blur
      if (inp.dataset.bind === "client_phone") {
        inp.addEventListener("blur", e => {
          const normalized = normalizePhone(e.target.value);
          if (normalized && normalized !== e.target.value) {
            e.target.value = normalized;
            update({ client_phone: normalized });
          }
        });
      }
    });
  }

  /* Приводим телефон к единому формату +7 XXX XXX-XX-XX.
     Принимает: 8XXXXXXXXXX, 7XXXXXXXXXX, +7XXXXXXXXXX, 9XXXXXXXXX (без префикса). */
  function normalizePhone(raw) {
    if (!raw) return "";
    const digits = raw.replace(/\D/g, "");
    let d = digits;
    if (d.length === 11 && d.startsWith("8")) d = "7" + d.slice(1);
    if (d.length === 10 && d.startsWith("9")) d = "7" + d; // мобильный без префикса
    if (d.length !== 11 || !d.startsWith("7")) return raw.trim(); // не похоже на РФ-номер — не трогаем
    return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
  }

  /* Проверка: получится ли валидный РФ-номер из введённого. */
  function isValidPhone(raw) {
    if (!raw) return false;
    let d = raw.replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("8")) d = "7" + d.slice(1);
    if (d.length === 10 && d.startsWith("9")) d = "7" + d;
    return d.length === 11 && d.startsWith("7");
  }

  function bindNav(node) {
    node.querySelectorAll("[data-go]").forEach(b => {
      b.addEventListener("click", () => go(b.dataset.go));
    });
  }

  return { mount, go, getState: () => state, reset: () => { state = defaultState(); saveState(); render(); } };
})();
