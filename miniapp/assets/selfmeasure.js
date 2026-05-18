/* ============================================================
   Самозамер кухни — #/c/selfmeasure
   5-шаговый мастер: тип кухни → стены → коммуникации → фото → контакт
   ============================================================ */

const SelfMeasureScreen = (function () {

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
        body: JSON.stringify({ initData: tg?.initData || "", initDataUnsafe: tg?.initDataUnsafe || null, ...body }),
      });
      if (!res.ok) throw new Error(`Ошибка сервера (${res.status})`);
      return await res.json();
    } catch (e) {
      if (e.name === "AbortError") throw new Error("Сервер не отвечает");
      throw e;
    } finally { clearTimeout(t); }
  }

  /* ---- SVG schematics for kitchen types ---- */
  const KITCHEN_SVGS = {
    straight: `<svg viewBox="0 0 100 80" width="100" height="80" fill="none" stroke="#3D7AB5" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
      <!-- Room outline -->
      <rect x="8" y="8" width="84" height="64" rx="1" stroke="#aaa" stroke-width="1" stroke-dasharray="3,3"/>
      <!-- Wall top -->
      <line x1="8" y1="8" x2="92" y2="8" stroke="#3D7AB5" stroke-width="3"/>
      <!-- Cabinets along top wall -->
      <rect x="10" y="10" width="16" height="10" rx="1"/>
      <rect x="30" y="10" width="16" height="10" rx="1"/>
      <rect x="50" y="10" width="16" height="10" rx="1"/>
      <rect x="70" y="10" width="16" height="10" rx="1"/>
      <!-- Label -->
      <text x="50" y="36" text-anchor="middle" font-size="10" fill="#3D7AB5" stroke="none" font-family="sans-serif">А</text>
      <line x1="14" y1="30" x2="86" y2="30" stroke="#3D7AB5" stroke-width="1" marker-end="url(#arr)"/>
    </svg>`,

    l_shape: `<svg viewBox="0 0 100 80" width="100" height="80" fill="none" stroke="#3D7AB5" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
      <!-- Room outline -->
      <rect x="8" y="8" width="84" height="64" rx="1" stroke="#aaa" stroke-width="1" stroke-dasharray="3,3"/>
      <!-- Wall top (А) -->
      <line x1="8" y1="8" x2="92" y2="8" stroke="#3D7AB5" stroke-width="3"/>
      <!-- Wall left (Б) -->
      <line x1="8" y1="8" x2="8" y2="72" stroke="#3D7AB5" stroke-width="3"/>
      <!-- Cabinets top -->
      <rect x="10" y="10" width="16" height="10" rx="1"/>
      <rect x="30" y="10" width="16" height="10" rx="1"/>
      <rect x="50" y="10" width="16" height="10" rx="1"/>
      <rect x="70" y="10" width="16" height="10" rx="1"/>
      <!-- Cabinets left -->
      <rect x="10" y="25" width="10" height="14" rx="1"/>
      <rect x="10" y="43" width="10" height="14" rx="1"/>
      <rect x="10" y="60" width="10" height="10" rx="1"/>
      <!-- Labels -->
      <text x="54" y="34" text-anchor="middle" font-size="9" fill="#3D7AB5" stroke="none" font-family="sans-serif">А</text>
      <text x="28" y="50" text-anchor="middle" font-size="9" fill="#3D7AB5" stroke="none" font-family="sans-serif">Б</text>
    </svg>`,

    u_shape: `<svg viewBox="0 0 100 80" width="100" height="80" fill="none" stroke="#3D7AB5" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
      <!-- Room outline -->
      <rect x="8" y="8" width="84" height="64" rx="1" stroke="#aaa" stroke-width="1" stroke-dasharray="3,3"/>
      <!-- Wall top (А) -->
      <line x1="8" y1="8" x2="92" y2="8" stroke="#3D7AB5" stroke-width="3"/>
      <!-- Wall left (Б) -->
      <line x1="8" y1="8" x2="8" y2="72" stroke="#3D7AB5" stroke-width="3"/>
      <!-- Wall right (В) -->
      <line x1="92" y1="8" x2="92" y2="72" stroke="#3D7AB5" stroke-width="3"/>
      <!-- Cabinets top -->
      <rect x="10" y="10" width="14" height="10" rx="1"/>
      <rect x="28" y="10" width="14" height="10" rx="1"/>
      <rect x="46" y="10" width="14" height="10" rx="1"/>
      <rect x="64" y="10" width="14" height="10" rx="1"/>
      <!-- Cabinets left -->
      <rect x="10" y="25" width="10" height="12" rx="1"/>
      <rect x="10" y="41" width="10" height="12" rx="1"/>
      <rect x="10" y="57" width="10" height="12" rx="1"/>
      <!-- Cabinets right -->
      <rect x="82" y="25" width="10" height="12" rx="1"/>
      <rect x="82" y="41" width="10" height="12" rx="1"/>
      <rect x="82" y="57" width="10" height="12" rx="1"/>
      <!-- Labels -->
      <text x="50" y="34" text-anchor="middle" font-size="9" fill="#3D7AB5" stroke="none" font-family="sans-serif">А</text>
      <text x="28" y="52" text-anchor="middle" font-size="9" fill="#3D7AB5" stroke="none" font-family="sans-serif">Б</text>
      <text x="72" y="52" text-anchor="middle" font-size="9" fill="#3D7AB5" stroke="none" font-family="sans-serif">В</text>
    </svg>`,

    island: `<svg viewBox="0 0 100 80" width="100" height="80" fill="none" stroke="#3D7AB5" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
      <!-- Room outline -->
      <rect x="8" y="8" width="84" height="64" rx="1" stroke="#aaa" stroke-width="1" stroke-dasharray="3,3"/>
      <!-- Wall top (А) -->
      <line x1="8" y1="8" x2="92" y2="8" stroke="#3D7AB5" stroke-width="3"/>
      <!-- Wall left (Б) -->
      <line x1="8" y1="8" x2="8" y2="72" stroke="#3D7AB5" stroke-width="3"/>
      <!-- Cabinets top -->
      <rect x="10" y="10" width="16" height="10" rx="1"/>
      <rect x="30" y="10" width="16" height="10" rx="1"/>
      <rect x="50" y="10" width="16" height="10" rx="1"/>
      <rect x="70" y="10" width="16" height="10" rx="1"/>
      <!-- Cabinets left -->
      <rect x="10" y="25" width="10" height="14" rx="1"/>
      <rect x="10" y="43" width="10" height="14" rx="1"/>
      <!-- Island -->
      <rect x="32" y="42" width="40" height="22" rx="2" stroke-dasharray="0"/>
      <text x="52" y="56" text-anchor="middle" font-size="8" fill="#3D7AB5" stroke="none" font-family="sans-serif">Остров</text>
      <!-- Labels -->
      <text x="54" y="34" text-anchor="middle" font-size="9" fill="#3D7AB5" stroke="none" font-family="sans-serif">А</text>
      <text x="28" y="52" text-anchor="middle" font-size="9" fill="#3D7AB5" stroke="none" font-family="sans-serif">Б</text>
    </svg>`,
  };

  const KITCHEN_LABELS = {
    straight: "Прямая",
    l_shape:  "Угловая Г",
    u_shape:  "Угловая П",
    island:   "Островная",
  };

  /* ---- Walls by kitchen type ---- */
  function getWalls(type) {
    if (type === "straight") return ["А"];
    if (type === "island")   return ["А", "Б"];
    if (type === "l_shape")  return ["А", "Б"];
    if (type === "u_shape")  return ["А", "Б", "В"];
    return ["А"];
  }

  /* ---- Price info block ---- */
  const PRICE_INFO_HTML = `
    <div style="margin:12px 16px 0;padding:12px 14px;border-radius:10px;
                background:#FFF8E7;border:1px solid #F5A623;">
      <div style="font-size:12px;font-weight:700;color:#B7770A;margin-bottom:4px;">💰 Стоимость выезда специалиста</div>
      <div style="font-size:13px;color:#5C4800;line-height:1.5;">
        В черте КАД Санкт-Петербурга — <strong>2 500 ₽</strong><br>
        За пределами КАД — <strong>2 500 ₽ + 40 ₽/км</strong> от кольцевой до адреса
      </div>
    </div>`;

  /* ---- Step 1: Kitchen type ---- */
  function renderStep1(state) {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      ${PRICE_INFO_HTML}
      <div class="block" style="margin:12px 16px 0;">
        <div class="block-head">Выберите тип кухни</div>
      </div>
    `;
    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 16px;";
    ["straight", "l_shape", "u_shape", "island"].forEach(type => {
      const card = document.createElement("button");
      card.style.cssText = `
        display:flex;flex-direction:column;align-items:center;gap:6px;
        padding:12px 8px;border-radius:12px;border:2px solid var(--border);
        background:var(--surface);cursor:pointer;transition:border-color 0.2s,background 0.2s;
      `;
      if (state.kitchenType === type) {
        card.style.borderColor = "var(--accent)";
        card.style.background = "var(--accent-faint, rgba(61,122,181,0.08))";
      }
      card.innerHTML = `
        ${KITCHEN_SVGS[type]}
        <div style="font-size:12px;font-weight:600;color:var(--ink);text-align:center;">
          ${escHtml(KITCHEN_LABELS[type])}
        </div>
      `;
      card.addEventListener("click", () => {
        haptic && haptic("impact");
        state.kitchenType = type;
        // Re-render step
        const parent = wrap.parentNode;
        const newStep = renderStep1(state);
        parent.replaceChild(newStep, wrap);
      });
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    return wrap;
  }

  /* ---- Step 2: Wall dimensions ---- */
  function renderStep2(state) {
    const walls = getWalls(state.kitchenType);
    const wrap = document.createElement("div");

    // SVG diagram
    const svgDiagram = buildWallDiagramSVG(state.kitchenType, walls);

    wrap.innerHTML = `
      <div class="block" style="margin:16px 16px 0;">
        <div class="block-head">Размеры стен</div>
        <div style="text-align:center;padding:8px 0 4px;">${svgDiagram}</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:10px;">
          Измеряйте каждую стену от угла до угла (в сантиметрах).
        </div>
      </div>
    `;

    const fieldsWrap = document.createElement("div");
    fieldsWrap.style.cssText = "padding:0 16px;display:flex;flex-direction:column;gap:10px;";

    if (!state.walls) state.walls = {};

    walls.forEach(w => {
      const row = document.createElement("div");
      row.innerHTML = `
        <label style="display:block;font-size:13px;font-weight:600;color:var(--ink);margin-bottom:4px;">
          Стена ${escHtml(w)}
        </label>
        <input type="number" inputmode="numeric" min="1" max="99999"
          class="sm-input"
          placeholder="длина в см"
          value="${escHtml(state.walls[w] || "")}"
          style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;
                 border:1.5px solid var(--border);background:var(--surface);
                 color:var(--ink);font-size:15px;outline:none;">
      `;
      const inp = row.querySelector("input");
      inp.addEventListener("input", () => {
        state.walls[w] = inp.value.trim();
      });
      fieldsWrap.appendChild(row);
    });

    if (state.kitchenType === "island") {
      const note = document.createElement("div");
      note.style.cssText = "font-size:12px;color:var(--muted);padding:4px 0;";
      note.textContent = "Для островной кухни укажите длину основной рабочей зоны (стены А и Б). Размеры острова уточним отдельно.";
      fieldsWrap.appendChild(note);
    }

    wrap.appendChild(fieldsWrap);
    return wrap;
  }

  function buildWallDiagramSVG(type, walls) {
    const w = 200, h = 140;
    const common = `viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" fill="none" xmlns="http://www.w3.org/2000/svg"`;

    if (type === "straight") {
      return `<svg ${common}>
        <line x1="20" y1="30" x2="180" y2="30" stroke="#3D7AB5" stroke-width="3"/>
        <line x1="20" y1="30" x2="20" y2="110" stroke="#aaa" stroke-width="1" stroke-dasharray="4,3"/>
        <line x1="180" y1="30" x2="180" y2="110" stroke="#aaa" stroke-width="1" stroke-dasharray="4,3"/>
        <!-- arrow -->
        <line x1="30" y1="70" x2="170" y2="70" stroke="#3D7AB5" stroke-width="1.5" stroke-dasharray="5,3"/>
        <polygon points="170,66 180,70 170,74" fill="#3D7AB5"/>
        <polygon points="30,66 20,70 30,74" fill="#3D7AB5"/>
        <text x="100" y="90" text-anchor="middle" font-size="14" fill="#3D7AB5" font-weight="600" font-family="sans-serif">А</text>
      </svg>`;
    }
    if (type === "l_shape") {
      return `<svg ${common}>
        <!-- А — top wall -->
        <line x1="30" y1="20" x2="180" y2="20" stroke="#3D7AB5" stroke-width="3"/>
        <!-- Б — left wall -->
        <line x1="30" y1="20" x2="30" y2="120" stroke="#3D7AB5" stroke-width="3"/>
        <!-- corner dot -->
        <circle cx="30" cy="20" r="3" fill="#3D7AB5"/>
        <!-- А arrow -->
        <line x1="40" y1="45" x2="170" y2="45" stroke="#3D7AB5" stroke-width="1.5" stroke-dasharray="5,3"/>
        <polygon points="170,41 180,45 170,49" fill="#3D7AB5"/>
        <polygon points="40,41 30,45 40,49" fill="#3D7AB5"/>
        <text x="105" y="65" text-anchor="middle" font-size="13" fill="#3D7AB5" font-weight="600" font-family="sans-serif">А</text>
        <!-- Б arrow -->
        <line x1="55" y1="30" x2="55" y2="110" stroke="#3D7AB5" stroke-width="1.5" stroke-dasharray="5,3"/>
        <polygon points="51,110 55,120 59,110" fill="#3D7AB5"/>
        <polygon points="51,30 55,20 59,30" fill="#3D7AB5"/>
        <text x="72" y="80" text-anchor="middle" font-size="13" fill="#3D7AB5" font-weight="600" font-family="sans-serif">Б</text>
      </svg>`;
    }
    if (type === "u_shape") {
      return `<svg ${common}>
        <!-- А — top wall -->
        <line x1="30" y1="20" x2="170" y2="20" stroke="#3D7AB5" stroke-width="3"/>
        <!-- Б — left wall -->
        <line x1="30" y1="20" x2="30" y2="120" stroke="#3D7AB5" stroke-width="3"/>
        <!-- В — right wall -->
        <line x1="170" y1="20" x2="170" y2="120" stroke="#3D7AB5" stroke-width="3"/>
        <circle cx="30" cy="20" r="3" fill="#3D7AB5"/>
        <circle cx="170" cy="20" r="3" fill="#3D7AB5"/>
        <!-- А arrow -->
        <line x1="40" y1="48" x2="160" y2="48" stroke="#3D7AB5" stroke-width="1.5" stroke-dasharray="5,3"/>
        <polygon points="160,44 170,48 160,52" fill="#3D7AB5"/>
        <polygon points="40,44 30,48 40,52" fill="#3D7AB5"/>
        <text x="100" y="66" text-anchor="middle" font-size="13" fill="#3D7AB5" font-weight="600" font-family="sans-serif">А</text>
        <!-- Б arrow -->
        <line x1="54" y1="30" x2="54" y2="110" stroke="#3D7AB5" stroke-width="1.5" stroke-dasharray="5,3"/>
        <polygon points="50,110 54,120 58,110" fill="#3D7AB5"/>
        <polygon points="50,30 54,20 58,30" fill="#3D7AB5"/>
        <text x="69" y="82" text-anchor="middle" font-size="13" fill="#3D7AB5" font-weight="600" font-family="sans-serif">Б</text>
        <!-- В arrow -->
        <line x1="146" y1="30" x2="146" y2="110" stroke="#3D7AB5" stroke-width="1.5" stroke-dasharray="5,3"/>
        <polygon points="142,110 146,120 150,110" fill="#3D7AB5"/>
        <polygon points="142,30 146,20 150,30" fill="#3D7AB5"/>
        <text x="131" y="82" text-anchor="middle" font-size="13" fill="#3D7AB5" font-weight="600" font-family="sans-serif">В</text>
      </svg>`;
    }
    // island
    return `<svg ${common}>
      <!-- А — top wall -->
      <line x1="30" y1="20" x2="170" y2="20" stroke="#3D7AB5" stroke-width="3"/>
      <!-- Б — left wall -->
      <line x1="30" y1="20" x2="30" y2="120" stroke="#3D7AB5" stroke-width="3"/>
      <circle cx="30" cy="20" r="3" fill="#3D7AB5"/>
      <!-- island rect -->
      <rect x="70" y="70" width="80" height="40" rx="3" stroke="#3D7AB5" stroke-dasharray="4,3"/>
      <text x="110" y="94" text-anchor="middle" font-size="10" fill="#3D7AB5" font-family="sans-serif">Остров</text>
      <!-- А label -->
      <text x="100" y="50" text-anchor="middle" font-size="13" fill="#3D7AB5" font-weight="600" font-family="sans-serif">А</text>
      <!-- Б label -->
      <text x="52" y="80" text-anchor="middle" font-size="13" fill="#3D7AB5" font-weight="600" font-family="sans-serif">Б</text>
    </svg>`;
  }

  /* ---- Step 3: Communications ---- */
  function renderStep3(state) {
    const walls = getWalls(state.kitchenType);
    if (!state.comms) state.comms = { water: {}, gas: {}, electric: {} };
    if (state.commsSkipped === undefined) state.commsSkipped = false;

    const wrap = document.createElement("div");

    // Skip button
    const skipBtn = document.createElement("button");
    skipBtn.className = "btn-secondary";
    skipBtn.style.cssText = "margin:16px 16px 0;width:calc(100% - 32px);display:block;";
    skipBtn.textContent = "⏭ Пропустить — только предварительный расчёт";
    skipBtn.addEventListener("click", () => {
      haptic && haptic("impact");
      state.commsSkipped = true;
      refreshStep3(wrap, state, walls);
    });
    wrap.appendChild(skipBtn);

    const contentDiv = document.createElement("div");
    contentDiv.id = "step3-content";
    wrap.appendChild(contentDiv);

    refreshStep3(wrap, state, walls);
    return wrap;
  }

  function refreshStep3(wrap, state, walls) {
    const contentDiv = wrap.querySelector("#step3-content");
    contentDiv.innerHTML = "";

    if (state.commsSkipped) {
      // Disclaimer
      const disc = document.createElement("div");
      disc.className = "block";
      disc.style.cssText = "margin:12px 16px 0;";
      disc.innerHTML = `
        <div class="block-head">Пропустить коммуникации</div>
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:8px 0;">
          <input type="checkbox" id="commsSkipCheck" style="margin-top:3px;width:18px;height:18px;flex-shrink:0;"
            ${state.commsSkipConfirmed ? "checked" : ""}>
          <span style="font-size:13px;color:var(--ink);line-height:1.5;">
            Понимаю, что точность замера на моей ответственности. Коммуникации замерит специалист.
          </span>
        </label>
        <button class="btn-secondary btn-sm" style="margin-top:6px;" id="commsUnskipBtn">
          ← Ввести коммуникации
        </button>
      `;
      disc.querySelector("#commsSkipCheck").addEventListener("change", e => {
        state.commsSkipConfirmed = e.target.checked;
      });
      disc.querySelector("#commsUnskipBtn").addEventListener("click", () => {
        haptic && haptic("impact");
        state.commsSkipped = false;
        state.commsSkipConfirmed = false;
        refreshStep3(wrap, state, walls);
      });
      contentDiv.appendChild(disc);
    } else {
      // Full comms form
      const block = document.createElement("div");
      block.className = "block";
      block.style.cssText = "margin:12px 16px 0;";
      block.innerHTML = `
        <div class="block-head">Коммуникации</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:10px;line-height:1.5;">
          Укажите расположение коммуникаций. Измеряйте расстояние от левого угла стены (смотря на стену лицом).
        </div>
        <div style="text-align:center;margin-bottom:10px;">
          ${buildCommsHintSVG()}
        </div>
      `;
      contentDiv.appendChild(block);

      // Water (always shown)
      contentDiv.appendChild(buildCommsSection("Вода 🚿", "water", state, walls, true));
      // Gas
      contentDiv.appendChild(buildCommsSectionGas(state, walls));
      // Electric
      contentDiv.appendChild(buildCommsSection("Электрика ⚡", "electric", state, walls, true));
    }
  }

  function buildCommsHintSVG() {
    return `<svg viewBox="0 0 200 60" width="180" height="54" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="10" y1="10" x2="190" y2="10" stroke="#3D7AB5" stroke-width="3"/>
      <line x1="10" y1="10" x2="10" y2="50" stroke="#aaa" stroke-width="1" stroke-dasharray="3,2"/>
      <line x1="190" y1="10" x2="190" y2="50" stroke="#aaa" stroke-width="1" stroke-dasharray="3,2"/>
      <line x1="10" y1="38" x2="100" y2="38" stroke="#3D7AB5" stroke-width="1.5" stroke-dasharray="4,2"/>
      <polygon points="95,34 105,38 95,42" fill="#3D7AB5"/>
      <circle cx="105" cy="14" r="5" fill="#3D7AB5" opacity="0.7"/>
      <text x="105" y="55" text-anchor="middle" font-size="10" fill="#3D7AB5" font-family="sans-serif">от левого угла →</text>
    </svg>`;
  }

  function buildCommsSection(title, key, state, walls, alwaysShow) {
    if (!state.comms[key]) state.comms[key] = {};
    const section = document.createElement("div");
    section.className = "block";
    section.style.cssText = "margin:8px 16px 0;";
    section.innerHTML = `<div class="block-head">${escHtml(title)}</div>`;

    const wallOpts = walls.map(w => `<option value="${w}" ${state.comms[key].wall === w ? "selected" : ""}>${w}</option>`).join("");

    const posOpts = ["Левый угол", "Центр", "Правый угол"].map(p =>
      `<option value="${p}" ${state.comms[key].pos === p ? "selected" : ""}>${p}</option>`
    ).join("");

    const form = document.createElement("div");
    form.style.cssText = "display:flex;flex-direction:column;gap:8px;";
    form.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;">
        <label style="font-size:12px;color:var(--muted);width:60px;flex-shrink:0;">Стена</label>
        <select style="flex:1;padding:8px;border-radius:8px;border:1.5px solid var(--border);background:var(--surface);color:var(--ink);font-size:13px;" data-field="wall">
          ${wallOpts}
        </select>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <label style="font-size:12px;color:var(--muted);width:60px;flex-shrink:0;">Позиция</label>
        <select style="flex:1;padding:8px;border-radius:8px;border:1.5px solid var(--border);background:var(--surface);color:var(--ink);font-size:13px;" data-field="pos">
          ${posOpts}
        </select>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <label style="font-size:12px;color:var(--muted);width:60px;flex-shrink:0;">Расстояние</label>
        <input type="number" inputmode="numeric" placeholder="от левого угла, см" data-field="dist"
          value="${escHtml(state.comms[key].dist || "")}"
          style="flex:1;padding:8px 10px;border-radius:8px;border:1.5px solid var(--border);background:var(--surface);color:var(--ink);font-size:13px;">
      </div>
    `;
    form.querySelectorAll("[data-field]").forEach(inp => {
      const ev = inp.tagName === "SELECT" ? "change" : "input";
      inp.addEventListener(ev, () => {
        state.comms[key][inp.dataset.field] = inp.value;
      });
      // Init state
      if (!state.comms[key][inp.dataset.field] && inp.tagName === "SELECT") {
        state.comms[key][inp.dataset.field] = inp.value;
      }
    });
    section.appendChild(form);
    return section;
  }

  function buildCommsSectionGas(state, walls) {
    if (!state.comms.gas) state.comms.gas = {};
    const section = document.createElement("div");
    section.className = "block";
    section.style.cssText = "margin:8px 16px 0;";

    const hasGas = !!state.comms.gas.enabled;

    section.innerHTML = `
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:4px 0;" class="block-head">
        <input type="checkbox" id="gasCheck" ${hasGas ? "checked" : ""} style="width:18px;height:18px;">
        <span>Газ 🔥</span>
      </label>
    `;

    const gasFields = document.createElement("div");
    gasFields.id = "gas-fields";
    gasFields.style.display = hasGas ? "block" : "none";
    section.appendChild(gasFields);

    if (hasGas) {
      const inner = buildCommsSection("", "gas", state, walls, false);
      inner.style.margin = "0";
      inner.querySelector(".block-head") && (inner.querySelector(".block-head").style.display = "none");
      gasFields.appendChild(inner);
    }

    section.querySelector("#gasCheck").addEventListener("change", e => {
      state.comms.gas.enabled = e.target.checked;
      if (e.target.checked) {
        gasFields.style.display = "block";
        gasFields.innerHTML = "";
        const inner = buildCommsSection("", "gas", state, walls, false);
        inner.style.margin = "0";
        const bh = inner.querySelector(".block-head");
        if (bh) bh.style.display = "none";
        gasFields.appendChild(inner);
      } else {
        gasFields.style.display = "none";
      }
    });

    return section;
  }

  /* ---- Step 4: Photos ---- */
  function renderStep4() {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="block" style="margin:16px 16px 0;">
        <div class="block-head">Фотографии</div>
        <div style="text-align:center;padding:20px 0 8px;font-size:40px;">📸</div>
        <div style="font-size:14px;color:var(--ink);line-height:1.6;margin-bottom:12px;">
          Сфотографируйте каждую стену с рулеткой.
        </div>
        <div style="font-size:13px;color:var(--muted);line-height:1.5;padding:10px 12px;
                    background:var(--surface-2,var(--surface));border-radius:8px;border:1px solid var(--border);">
          📤 Загрузка фото — только через Telegram. После отправки замера прикрепите фото ответным сообщением в чате с менеджером.
        </div>
      </div>
    `;
    return wrap;
  }

  /* ---- Step 5: Contact + submit ---- */
  function renderStep5(state, onSubmit) {
    if (!state.contact) state.contact = {};
    const wrap = document.createElement("div");

    wrap.innerHTML = `
      ${PRICE_INFO_HTML}
      <div class="block" style="margin:12px 16px 0;">
        <div class="block-head">Контактные данные</div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px;">
          <div>
            <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:4px;">Имя *</label>
            <input type="text" id="sm-name" placeholder="Ваше имя"
              value="${escHtml(state.contact.name || "")}"
              style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;
                     border:1.5px solid var(--border);background:var(--surface);
                     color:var(--ink);font-size:15px;">
          </div>
          <div>
            <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:4px;">Телефон *</label>
            <input type="tel" id="sm-phone" placeholder="+7 (___) ___-__-__"
              value="${escHtml(state.contact.phone || "")}"
              style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;
                     border:1.5px solid var(--border);background:var(--surface);
                     color:var(--ink);font-size:15px;">
          </div>
          <div>
            <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:4px;">Адрес *</label>
            <input type="text" id="sm-address" placeholder="Улица, дом, кв."
              value="${escHtml(state.contact.address || "")}"
              style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;
                     border:1.5px solid var(--border);background:var(--surface);
                     color:var(--ink);font-size:15px;">
          </div>
        </div>
      </div>
    `;

    wrap.querySelector("#sm-name").addEventListener("input", e => state.contact.name = e.target.value.trim());
    wrap.querySelector("#sm-phone").addEventListener("input", e => state.contact.phone = e.target.value.trim());
    wrap.querySelector("#sm-address").addEventListener("input", e => state.contact.address = e.target.value.trim());

    return wrap;
  }

  /* ---- Validation ---- */
  function validateStep(step, state) {
    if (step === 1) {
      return !!state.kitchenType;
    }
    if (step === 2) {
      const walls = getWalls(state.kitchenType);
      return walls.every(w => state.walls && parseInt(state.walls[w]) > 0);
    }
    if (step === 3) {
      if (state.commsSkipped) return !!state.commsSkipConfirmed;
      return true; // comms are optional when not skipped
    }
    if (step === 4) {
      return true; // photos always optional
    }
    if (step === 5) {
      const c = state.contact || {};
      return !!(c.name && c.phone && c.address);
    }
    return true;
  }

  function getValidationMessage(step, state) {
    if (step === 1) return "Выберите тип кухни";
    if (step === 2) {
      const walls = getWalls(state.kitchenType);
      const missing = walls.filter(w => !state.walls || !parseInt(state.walls[w]));
      return `Введите длину стены: ${missing.join(", ")}`;
    }
    if (step === 3 && state.commsSkipped && !state.commsSkipConfirmed) {
      return "Подтвердите понимание или введите коммуникации";
    }
    if (step === 5) {
      const c = state.contact || {};
      if (!c.name) return "Введите имя";
      if (!c.phone) return "Введите телефон";
      if (!c.address) return "Введите адрес";
    }
    return "";
  }

  const STEP_TITLES = [
    "Тип кухни",
    "Размеры стен",
    "Коммуникации",
    "Фотографии",
    "Контакт",
  ];

  /* ---- Main mount ---- */
  async function mount(container) {
    container.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    const oldNav = document.getElementById("bottom-nav");
    if (oldNav) oldNav.remove();

    // State
    const state = {
      kitchenType: null,
      walls: {},
      commsSkipped: false,
      commsSkipConfirmed: false,
      comms: { water: {}, gas: {}, electric: {} },
      contact: {},
      step: 1,
    };

    // Try pre-fill contact from /api/me
    try {
      const me = await _api("me");
      if (me && !me.error && me.user) {
        state.contact.name = me.user.full_name || "";
        state.contact.phone = me.user.phone || "";
      }
    } catch (e) { /* ignore */ }

    // Header
    const header = document.createElement("header");
    header.className = "podbor-header";
    header.innerHTML = `
      <button class="podbor-back" aria-label="Назад">${(window.ICONS || {}).arrow_left || "‹"}</button>
      <div class="podbor-title" id="sm-header-title">Шаг 1 / 5 — ${escHtml(STEP_TITLES[0])}</div>
      <div style="width:36px"></div>
    `;
    header.querySelector(".podbor-back").addEventListener("click", () => {
      haptic && haptic("impact");
      if (state.step > 1) {
        state.step--;
        renderCurrentStep();
      } else {
        history.back();
      }
    });
    container.appendChild(header);

    // Progress bar
    const progressBar = document.createElement("div");
    progressBar.style.cssText = "height:3px;background:var(--border);margin:0;";
    const progressFill = document.createElement("div");
    progressFill.style.cssText = "height:3px;background:var(--accent);transition:width 0.3s;";
    progressBar.appendChild(progressFill);
    container.appendChild(progressBar);

    // Screen
    const screen = document.createElement("div");
    screen.className = "podbor-screen";
    screen.style.cssText = "padding-bottom:80px;";
    container.appendChild(screen);

    // Bottom navigation
    const bottomNav = document.createElement("div");
    bottomNav.style.cssText = `
      position:fixed;bottom:0;left:0;right:0;z-index:100;
      padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));
      background:var(--bg);border-top:1px solid var(--border);
      display:flex;gap:8px;
    `;
    bottomNav.innerHTML = `
      <button class="btn-secondary" id="sm-back-btn" style="flex:1;">← Назад</button>
      <button class="btn-primary" id="sm-next-btn" style="flex:2;">Далее →</button>
    `;
    container.appendChild(bottomNav);

    const errorDiv = document.createElement("div");
    errorDiv.style.cssText = "color:#C0392B;font-size:13px;text-align:center;padding:4px 16px;min-height:20px;";
    container.insertBefore(errorDiv, bottomNav);

    function renderCurrentStep() {
      screen.innerHTML = "";
      errorDiv.textContent = "";

      // Update header
      const titleEl = container.querySelector("#sm-header-title");
      if (titleEl) titleEl.textContent = `Шаг ${state.step} / 5 — ${STEP_TITLES[state.step - 1]}`;

      // Progress
      progressFill.style.width = `${(state.step / 5) * 100}%`;

      // Back button
      const backBtn = container.querySelector("#sm-back-btn");
      const nextBtn = container.querySelector("#sm-next-btn");

      if (state.step === 5) {
        nextBtn.textContent = "Отправить замер";
      } else {
        nextBtn.textContent = "Далее →";
      }

      backBtn.style.display = state.step === 1 ? "none" : "";

      // Render step content
      let stepEl;
      if (state.step === 1) stepEl = renderStep1(state);
      else if (state.step === 2) stepEl = renderStep2(state);
      else if (state.step === 3) stepEl = renderStep3(state);
      else if (state.step === 4) stepEl = renderStep4();
      else if (state.step === 5) stepEl = renderStep5(state);
      if (stepEl) screen.appendChild(stepEl);
    }

    // Next button handler
    container.querySelector("#sm-next-btn").addEventListener("click", async () => {
      haptic && haptic("impact");
      errorDiv.textContent = "";

      if (!validateStep(state.step, state)) {
        errorDiv.textContent = getValidationMessage(state.step, state);
        return;
      }

      if (state.step === 5) {
        await doSubmit();
        return;
      }

      state.step++;
      renderCurrentStep();
    });

    // Back button handler
    container.querySelector("#sm-back-btn").addEventListener("click", () => {
      haptic && haptic("impact");
      if (state.step > 1) {
        state.step--;
        renderCurrentStep();
      }
    });

    async function doSubmit() {
      const nextBtn = container.querySelector("#sm-next-btn");
      nextBtn.disabled = true;
      nextBtn.textContent = "Отправляем…";
      errorDiv.textContent = "";

      const payload = {
        kitchen_type: state.kitchenType,
        walls: state.walls,
        comms_skipped: state.commsSkipped,
        comms_skip_confirmed: state.commsSkipConfirmed,
        communications: state.commsSkipped ? null : state.comms,
        client_name: state.contact.name,
        client_phone: state.contact.phone,
        address: state.contact.address,
      };

      try {
        const res = await _api("self_measure_submit", payload);
        if (res.error) throw new Error(res.error);

        // Success screen
        screen.innerHTML = "";
        container.querySelector("#sm-back-btn").style.display = "none";
        nextBtn.style.display = "none";
        errorDiv.textContent = "";

        const success = document.createElement("div");
        success.style.cssText = "text-align:center;padding:40px 24px;";
        success.innerHTML = `
          <div style="font-size:56px;margin-bottom:16px;">✅</div>
          <div style="font-size:20px;font-weight:700;color:var(--ink);margin-bottom:10px;">Замер отправлен!</div>
          <div style="font-size:14px;color:var(--muted);line-height:1.6;margin-bottom:24px;">
            Менеджер свяжется с вами в ближайшее время.
          </div>
          <button class="btn-secondary" id="sm-done-btn">← В кабинет</button>
        `;
        success.querySelector("#sm-done-btn").addEventListener("click", () => {
          haptic && haptic("success");
          location.hash = "#/c/cabinet";
        });
        screen.appendChild(success);
        haptic && haptic("success");
      } catch (e) {
        errorDiv.textContent = "Ошибка: " + e.message;
        nextBtn.disabled = false;
        nextBtn.textContent = "Отправить замер";
      }
    }

    renderCurrentStep();
  }

  return { mount };
})();
