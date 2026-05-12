/* ============================================================
   Замеры кухни — wizard для менеджера
   ============================================================ */

const Measurements = (function () {
  const STORAGE_KEY = "zov-measurement-draft";
  const STEPS = ["client", "layout", "size", "openings", "photos", "summary"];
  const STEP_LABELS = ["Клиент", "Форма", "Размеры", "Окна/двери", "Фото", "Готово"];

  // Фото держим только в памяти (data-URL'ы тяжёлые, localStorage не годится)
  let photos = []; // Array<{ name: string, dataUrl: string, size: number }>

  const LAYOUTS = [
    { key: "linear",     label: "Прямая",      hint: "одна стена",      pict: "layout_linear" },
    { key: "l_shape",    label: "Угловая Г",   hint: "две стены, угол", pict: "layout_l_shape" },
    { key: "u_shape",    label: "П-образная",  hint: "три стены",       pict: "layout_u_shape" },
    { key: "island",     label: "С островом",  hint: "линейная + блок", pict: "layout_island" },
    { key: "peninsula",  label: "Полуостров",  hint: "Г + барная",      pict: "layout_peninsula" },
  ];

  let state = loadState();
  let root = null;
  let currentStep = "client";

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
      client_tg_id: "",
      layout: "",
      area_m2: "",
      ceiling_mm: "",
      walls: {},          // { wall1: 3200, wall2: 4100, ... } — мм
      openings: {
        window: "",       // расположение окна
        door: "",         // расположение двери
      },
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

  function reset() {
    state = defaultState();
    saveState();
    photos = [];
  }

  /* ===================== Mount + Render ===================== */

  function mount(container) {
    root = container;
    document.body.classList.remove("has-bottom-nav");
    const oldNav = document.getElementById("bottom-nav");
    if (oldNav) oldNav.remove();
    currentStep = "client";
    photos = []; // на старте нового замера — чистый список
    render();
  }

  function go(step) {
    if (!STEPS.includes(step)) return;
    currentStep = step;
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
      case "client":   screen.appendChild(renderClient()); break;
      case "layout":   screen.appendChild(renderLayout()); break;
      case "size":     screen.appendChild(renderSize()); break;
      case "openings": screen.appendChild(renderOpenings()); break;
      case "photos":   screen.appendChild(renderPhotos()); break;
      case "summary":  screen.appendChild(renderSummary()); break;
    }
  }

  function renderHeader() {
    const h = el(`
      <header class="podbor-header">
        <button class="podbor-back" aria-label="Назад">${ICONS.arrow_left || "‹"}</button>
        <div class="podbor-title">Новый замер</div>
        <div style="width:28px"></div>
      </header>
    `);
    h.querySelector(".podbor-back").addEventListener("click", () => {
      const idx = STEPS.indexOf(currentStep);
      if (idx <= 0) {
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
    const pct = Math.round(((idx + 1) / STEPS.length) * 100);
    return el(`
      <div class="podbor-progress">
        <div class="podbor-progress-bar"><div class="bar" style="width:${pct}%"></div></div>
        <div class="podbor-progress-meta">
          <span>${STEP_LABELS[idx]}</span><span class="num">${idx + 1}/${STEPS.length}</span>
        </div>
      </div>
    `);
  }

  /* ===================== Шаг 1: Клиент ===================== */

  function renderClient() {
    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">Для какого<br><span class="accent">клиента?</span></h2>
        <p class="lede">Имя и телефон клиента, для которого делается замер.</p>

        <div class="form-row">
          <label class="field">
            <span class="field-label">Имя клиента</span>
            <input type="text" data-bind="client_name" value="${escAttr(state.client_name)}" placeholder="Например: А. Пестова">
            <span class="field-error" id="nameError"></span>
          </label>
        </div>
        <div class="form-row">
          <label class="field">
            <span class="field-label">Телефон</span>
            <input type="tel" data-bind="client_phone" value="${escAttr(state.client_phone)}" placeholder="+7 900 123-45-67">
            <span class="field-hint">Можно без +7, нормализуем</span>
            <span class="field-error" id="phoneError"></span>
          </label>
        </div>

        <div class="podbor-cta-row">
          <button class="btn-primary" id="next">Дальше</button>
        </div>
      </section>
    `);

    bindInputs(node);

    node.querySelector("#next").addEventListener("click", () => {
      const name = (state.client_name || "").trim();
      const phone = (state.client_phone || "").trim();
      if (!name) {
        node.querySelector("#nameError").textContent = "Укажите имя";
        return;
      }
      // Используем нормализацию из podbor
      if (phone && window.Podbor && typeof normalizePhoneShared === "function") {
        // not exposed — поэтому минимальная локальная проверка
      }
      if (phone && phone.replace(/\D/g, "").length < 10) {
        node.querySelector("#phoneError").textContent = "Слишком короткий номер";
        return;
      }
      go("layout");
    });
    return node;
  }

  /* ===================== Шаг 2: Форма ===================== */

  function renderLayout() {
    const cur = state.layout || "";
    const cards = LAYOUTS.map(o => {
      const isOn = cur === o.key;
      const pict = PODBOR_PICTS[o.pict] || "";
      return `
        <button class="wiz-card${isOn ? " on" : ""}" data-val="${o.key}">
          <div class="wiz-pict">${pict}</div>
          <div class="wiz-label">${o.label}</div>
          ${o.hint ? `<div class="wiz-hint">${o.hint}</div>` : ""}
          ${isOn ? `<div class="wiz-tick">${ICONS.check}</div>` : ""}
        </button>
      `;
    }).join("");

    const node = el(`
      <section class="podbor-step podbor-wizard">
        <h3 class="wiz-title">Форма кухни</h3>
        <p class="lede" style="margin:0 0 8px;">Как расположены гарнитуры?</p>
        <div class="wiz-grid wiz-grid--cards">${cards}</div>
        <div class="podbor-cta-row">
          <button class="btn-secondary" id="back">Назад</button>
        </div>
      </section>
    `);
    node.querySelectorAll(".wiz-card").forEach(card => {
      card.addEventListener("click", () => {
        update({ layout: card.dataset.val });
        haptic && haptic("impact");
        go("size");
      });
    });
    node.querySelector("#back").addEventListener("click", () => go("client"));
    return node;
  }

  /* ===================== Шаг 3: Размеры ===================== */

  function renderSize() {
    // По выбранной планировке — определяем сколько стен
    const wallsCount = {
      linear: 1, l_shape: 2, u_shape: 3, island: 1, peninsula: 2,
    }[state.layout] || 1;

    const wallInputs = [];
    for (let i = 1; i <= wallsCount; i++) {
      const v = (state.walls && state.walls[`wall${i}`]) || "";
      const label = wallsCount === 1 ? "Длина стены, мм"
                  : `Стена ${i} (${i === 1 ? "основная" : "доп."}), мм`;
      wallInputs.push(`
        <div class="form-row">
          <label class="field">
            <span class="field-label">${label}</span>
            <input type="number" inputmode="numeric" data-wall="wall${i}" value="${v}" placeholder="например 3200">
          </label>
        </div>
      `);
    }

    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">Размеры<br><span class="accent">кухни</span></h2>
        <p class="lede">Длины стен в миллиметрах + высота потолка.</p>

        ${wallInputs.join("")}

        <div class="form-row two-col">
          <label class="field">
            <span class="field-label">Площадь, м²</span>
            <input type="number" inputmode="decimal" step="0.1" data-bind="area_m2" value="${state.area_m2}" placeholder="12.5">
          </label>
          <label class="field">
            <span class="field-label">Потолок, мм</span>
            <input type="number" inputmode="numeric" data-bind="ceiling_mm" value="${state.ceiling_mm}" placeholder="2700">
          </label>
        </div>

        <div class="podbor-cta-row">
          <button class="btn-secondary" id="back">Назад</button>
          <button class="btn-primary" id="next">Дальше</button>
        </div>
      </section>
    `);

    bindInputs(node);
    // Wall inputs — пишем в state.walls
    node.querySelectorAll("[data-wall]").forEach(inp => {
      inp.addEventListener("input", e => {
        const w = { ...(state.walls || {}), [e.target.dataset.wall]: e.target.value };
        update({ walls: w });
      });
    });

    node.querySelector("#back").addEventListener("click", () => go("layout"));
    node.querySelector("#next").addEventListener("click", () => go("openings"));
    return node;
  }

  /* ===================== Шаг 4: Окна и двери ===================== */

  function renderOpenings() {
    const o = state.openings || {};
    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">Окна<br><span class="accent">и двери</span></h2>
        <p class="lede">Опиши расположение — где окно, откуда вход, есть ли коммуникации.</p>

        <div class="form-row">
          <label class="field">
            <span class="field-label">Окно</span>
            <textarea data-open="window" rows="2" placeholder="например: на стене 1, отступ 1200 от угла, ширина 1500">${escHtml(o.window || "")}</textarea>
          </label>
        </div>
        <div class="form-row">
          <label class="field">
            <span class="field-label">Дверь / вход</span>
            <textarea data-open="door" rows="2" placeholder="например: вход со стороны коридора, дверь на стене 3">${escHtml(o.door || "")}</textarea>
          </label>
        </div>

        <div class="form-row">
          <label class="field">
            <span class="field-label">Заметки</span>
            <textarea data-bind="notes" rows="3" placeholder="газ/электро, вентшахта, ниши под технику, особые пожелания">${escHtml(state.notes || "")}</textarea>
          </label>
        </div>

        <div class="podbor-cta-row">
          <button class="btn-secondary" id="back">Назад</button>
          <button class="btn-primary" id="next">Дальше</button>
        </div>
      </section>
    `);

    bindInputs(node);
    node.querySelectorAll("[data-open]").forEach(inp => {
      inp.addEventListener("input", e => {
        update({ openings: { ...(state.openings || {}), [e.target.dataset.open]: e.target.value } });
      });
    });
    node.querySelector("#back").addEventListener("click", () => go("size"));
    node.querySelector("#next").addEventListener("click", () => go("photos"));
    return node;
  }

  /* ===================== Шаг 5: Фото замера ===================== */

  function renderPhotos() {
    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">Фото<br><span class="accent">кухни</span></h2>
        <p class="lede">Сними помещение со всех углов. Минимум: общий вид, окно/дверь, ниши и коммуникации.</p>

        <div class="photo-uploader">
          <label class="photo-add-btn" for="photoInput">
            <span class="photo-add-ico">＋</span>
            <span class="photo-add-label">Добавить фото</span>
            <span class="photo-add-hint">камера или галерея · до 12 шт</span>
          </label>
          <input id="photoInput" type="file" accept="image/*" capture="environment" multiple hidden>
        </div>

        <div class="photo-list" id="photoList"></div>

        <div class="podbor-cta-row">
          <button class="btn-secondary" id="back">Назад</button>
          <button class="btn-primary" id="next">Дальше</button>
        </div>
      </section>
    `);

    const list = node.querySelector("#photoList");
    const input = node.querySelector("#photoInput");

    function refreshList() {
      list.innerHTML = "";
      photos.forEach((ph, idx) => {
        const tile = el(`
          <div class="photo-tile">
            <img src="${ph.dataUrl}" alt="фото ${idx + 1}">
            <button class="photo-rm" data-idx="${idx}" aria-label="Удалить">×</button>
          </div>
        `);
        tile.querySelector(".photo-rm").addEventListener("click", e => {
          const i = +e.currentTarget.dataset.idx;
          photos.splice(i, 1);
          haptic && haptic("impact");
          refreshList();
        });
        list.appendChild(tile);
      });
    }

    input.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      input.value = ""; // позволяем выбрать тот же файл снова
      if (!files.length) return;

      for (const f of files) {
        if (photos.length >= 12) break;
        if (!f.type || !f.type.startsWith("image/")) continue;
        try {
          const dataUrl = await compressImage(f, 1600, 0.78);
          photos.push({ name: f.name || `photo_${photos.length + 1}`, dataUrl, size: dataUrl.length });
        } catch (err) {
          console.warn("Не удалось сжать фото", err);
        }
      }
      refreshList();
      haptic && haptic("success");
    });

    refreshList();
    node.querySelector("#back").addEventListener("click", () => go("openings"));
    node.querySelector("#next").addEventListener("click", () => go("summary"));
    return node;
  }

  /* Жмём картинку через canvas, возвращаем data-URL jpeg ~75% */
  function compressImage(file, maxSide = 1600, quality = 0.78) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = e => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let { width, height } = img;
          if (width > maxSide || height > maxSide) {
            if (width >= height) {
              height = Math.round(height * maxSide / width);
              width = maxSide;
            } else {
              width = Math.round(width * maxSide / height);
              height = maxSide;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          try {
            resolve(canvas.toDataURL("image/jpeg", quality));
          } catch (err) { reject(err); }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ===================== Шаг 6: Готово + Submit ===================== */

  function renderSummary() {
    const layout = LAYOUTS.find(l => l.key === state.layout);
    const wallsText = Object.entries(state.walls || {})
      .map(([k, v]) => v ? `${k.replace("wall", "стена ")}: ${v} мм` : "")
      .filter(Boolean).join(" · ");

    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">Готово<br><span class="accent">к сохранению</span></h2>
        <p class="lede">Проверьте и сохраните замер.</p>
        <div class="block summary-block">
          <div class="kv"><span>Клиент</span><strong>${escHtml(state.client_name)}</strong></div>
          ${state.client_phone ? `<div class="kv"><span>Телефон</span><strong>${escHtml(state.client_phone)}</strong></div>` : ""}
          <div class="kv"><span>Форма</span><strong>${layout?.label || "—"}</strong></div>
          ${wallsText ? `<div class="kv"><span>Стены</span><strong>${escHtml(wallsText)}</strong></div>` : ""}
          ${state.area_m2 ? `<div class="kv"><span>Площадь</span><strong>${escHtml(state.area_m2)} м²</strong></div>` : ""}
          ${state.ceiling_mm ? `<div class="kv"><span>Потолок</span><strong>${escHtml(state.ceiling_mm)} мм</strong></div>` : ""}
          ${(state.openings || {}).window ? `<div class="kv"><span>Окно</span><strong>${escHtml(state.openings.window)}</strong></div>` : ""}
          ${(state.openings || {}).door ? `<div class="kv"><span>Дверь</span><strong>${escHtml(state.openings.door)}</strong></div>` : ""}
          ${state.notes ? `<div class="kv"><span>Заметки</span><strong>${escHtml(state.notes)}</strong></div>` : ""}
          ${photos.length ? `<div class="kv"><span>Фото</span><strong>${photos.length} шт</strong></div>` : ""}
        </div>

        ${photos.length ? `
          <div class="photo-list">
            ${photos.map(p => `<div class="photo-tile static"><img src="${p.dataUrl}" alt=""></div>`).join("")}
          </div>
        ` : ""}

        <div class="podbor-cta-row">
          <button class="btn-secondary" id="back">Назад</button>
          <button class="btn-primary" id="submitBtn">Сохранить замер</button>
        </div>

        <div id="submitResult" class="submit-result"></div>
      </section>
    `);
    node.querySelector("#back").addEventListener("click", () => go("photos"));
    node.querySelector("#submitBtn").addEventListener("click", () => onSubmit(node));
    return node;
  }

  async function onSubmit(node) {
    const btn = node.querySelector("#submitBtn");
    const result = node.querySelector("#submitResult");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-inline"></span> сохраняем...';
    result.innerHTML = "";

    if (!BACKEND_URL) {
      result.innerHTML = `<div class="error">BACKEND_URL не настроен.</div>`;
      btn.disabled = false;
      btn.textContent = "Сохранить замер";
      return;
    }

    const measurement = {
      layout: state.layout,
      area_m2: state.area_m2,
      ceiling_mm: state.ceiling_mm,
      walls: state.walls,
      openings: state.openings,
      infra: {},
      niches: {},
      // Бэкенд раскодирует data-URL → файл и сохранит имена в Sheets
      photos: photos.map(p => p.dataUrl),
      notes: state.notes,
      // Контакт клиента — заносим в заметки если он не зарегистрирован в системе
      client_name: state.client_name,
      client_phone: state.client_phone,
    };

    try {
      const res = await fetch(`${BACKEND_URL}/api/measurement`, {
        method: "POST",
        body: JSON.stringify({
          initData: tg?.initData || "",
          measurement,
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
              <div class="success-title">Замер сохранён</div>
              <div class="success-sub">ID #${(data.id || "").slice(0, 6)}</div>
            </div>
          </div>
          <div class="podbor-cta-row" style="margin-top:16px;">
            <button class="btn-secondary" id="newOne">Ещё замер</button>
            <button class="btn-primary" id="toHome">На главную</button>
          </div>
        `;
        haptic && haptic("success");
        reset(); // сбрасываем форму для следующего замера
        node.querySelector("#newOne")?.addEventListener("click", () => { mount(root); });
        node.querySelector("#toHome")?.addEventListener("click", () => {
          location.hash = "";
          location.reload();
        });
      }
    } catch (e) {
      result.innerHTML = `<div class="error">Сеть: ${e.message}</div>`;
    }
    btn.disabled = false;
    btn.textContent = "Сохранить ещё раз";
  }

  /* ===================== Helpers ===================== */

  function bindInputs(node) {
    node.querySelectorAll("[data-bind]").forEach(inp => {
      inp.addEventListener("input", e => {
        update({ [e.target.dataset.bind]: e.target.value });
      });
    });
  }

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escAttr(s) { return escHtml(s); }

  return { mount, reset };
})();
