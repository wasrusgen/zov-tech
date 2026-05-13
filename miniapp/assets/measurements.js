/* ============================================================
   Замер — упрощённая версия: только фото + заметки.
   DWG-чертёж потом делается отдельным процессом из фото.
   ============================================================ */

const Measurements = (function () {
  const STORAGE_KEY = "zov-measurement-draft";

  // Фото держим только в памяти — data-URL'ы тяжёлые
  let photos = []; // Array<{ name, dataUrl }>

  let state = loadState();
  let root = null;
  let measurementId = ""; // если задан — update-mode (закрытие существующей заявки)
  let prefilledClient = null; // данные клиента из заявки в update-mode

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
      notes: "",
    };
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function reset() {
    state = defaultState();
    saveState();
    photos = [];
    prefilledClient = null;
  }

  /* ===================== Mount + Render ===================== */

  function mount(container) {
    root = container;
    document.body.classList.remove("has-bottom-nav");
    const oldNav = document.getElementById("bottom-nav");
    if (oldNav) oldNav.remove();

    photos = [];
    measurementId = "";
    prefilledClient = null;

    // ?id=<measurement_id> → update-mode (замерщик закрывает заявку)
    const hashMatch = (location.hash.split("?")[1] || "");
    const fragQp = new URLSearchParams(hashMatch);
    const mid = fragQp.get("id") || new URLSearchParams(location.search).get("measurement_id") || "";
    if (mid) {
      measurementId = mid;
      loadRequestAndStart();
      return;
    }
    render();
  }

  async function loadRequestAndStart() {
    root.innerHTML = "";
    root.appendChild(renderHeader("Закрыть заявку"));
    root.appendChild(el(`<div class="loader-inline"><div class="spinner"></div></div>`));
    try {
      const res = await fetch(`${BACKEND_URL}/api/measurement_detail`, {
        method: "POST",
        body: JSON.stringify({
          initData: tg?.initData || "",
          initDataUnsafe: tg?.initDataUnsafe || null,
          measurement_id: measurementId,
        }),
      });
      const data = await res.json();
      if (data.error) {
        root.innerHTML = "";
        root.appendChild(renderHeader("Ошибка"));
        root.appendChild(el(`<div class="error">${data.error}</div>`));
        return;
      }
      prefilledClient = {
        name: data.client_name || "",
        phone: data.client_phone || "",
        address: data.address || "",
      };
      // Не показываем форму клиента — она read-only
      state.notes = state.notes || "";
      render();
    } catch (e) {
      root.innerHTML = "";
      root.appendChild(renderHeader("Ошибка"));
      root.appendChild(el(`<div class="error">Сеть: ${e.message}</div>`));
    }
  }

  function render() {
    if (!root) return;
    root.innerHTML = "";
    root.appendChild(renderHeader(measurementId ? "Закрыть заявку" : "Новый замер"));
    const screen = el(`<div class="podbor-screen"></div>`);
    root.appendChild(screen);
    screen.appendChild(renderForm());
  }

  function renderHeader(title) {
    const h = el(`
      <header class="podbor-header">
        <button class="podbor-back" aria-label="Назад">${ICONS.arrow_left || "‹"}</button>
        <div class="podbor-title">${escHtml(title)}</div>
        <div style="width:28px"></div>
      </header>
    `);
    h.querySelector(".podbor-back").addEventListener("click", () => {
      location.hash = "";
      location.reload();
    });
    return h;
  }

  /* ===================== Главный экран — всё на одной странице ===================== */

  function renderForm() {
    const isUpdate = !!measurementId && prefilledClient;
    const clientBlock = isUpdate ? renderClientReadOnly() : renderClientInputs();

    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">${isUpdate ? "Фото<br><span class=\"accent\">с замера</span>" : "Новый<br><span class=\"accent\">замер</span>"}</h2>
        <p class="lede">${isUpdate
          ? "Загрузите фото от руки нарисованных замеров (а также общие фото помещения). Чертёж сделаем по ним отдельно."
          : "Заполните данные клиента и загрузите фото замера. Можно фотать рукописные эскизы — главное чтобы были видны размеры."}
        </p>

        <div id="clientBlock"></div>

        <div class="section-head" style="margin-top:18px;"><span class="label">📷 Фото замера</span></div>
        <div class="photo-uploader">
          <label class="photo-add-btn" for="photoInput">
            <span class="photo-add-ico">＋</span>
            <span class="photo-add-label">Добавить фото</span>
            <span class="photo-add-hint">камера или галерея · до 20 шт</span>
          </label>
          <input id="photoInput" type="file" accept="image/*" capture="environment" multiple hidden>
        </div>
        <div class="photo-list" id="photoList"></div>

        <div class="form-row" style="margin-top:18px;">
          <label class="field">
            <span class="field-label">Заметки (опционально)</span>
            <textarea data-bind="notes" rows="3" placeholder="что важно отметить — газ/электро, особые условия, размеры которые сложно прочесть на фото">${escHtml(state.notes || "")}</textarea>
          </label>
        </div>

        <div class="podbor-cta-row" style="margin-top:20px;">
          <button class="btn-primary" id="submitBtn">${isUpdate ? "Закрыть заявку" : "Сохранить замер"}</button>
        </div>

        <div id="submitResult" class="submit-result"></div>
      </section>
    `);

    node.querySelector("#clientBlock").appendChild(clientBlock);
    bindInputs(node);
    bindPhotoInput(node);

    node.querySelector("#submitBtn").addEventListener("click", () => onSubmit(node));
    return node;
  }

  function renderClientReadOnly() {
    return el(`
      <div class="block">
        <div class="kv"><span>Клиент</span>&nbsp;<strong>${escHtml(prefilledClient.name || "—")}</strong></div>
        ${prefilledClient.phone ? `<div class="kv"><span>Телефон</span>&nbsp;<strong>${escHtml(prefilledClient.phone)}</strong></div>` : ""}
        ${prefilledClient.address ? `<div class="kv"><span>Адрес</span>&nbsp;<strong>${escHtml(prefilledClient.address)}</strong></div>` : ""}
      </div>
    `);
  }

  function renderClientInputs() {
    const block = el(`
      <div>
        <div class="form-row">
          <label class="field">
            <span class="field-label">ФИО клиента *</span>
            <input type="text" data-bind="client_name" value="${escAttr(state.client_name)}" placeholder="Иванов Иван Иванович">
            <span class="field-error" id="nameError"></span>
          </label>
        </div>
        <div class="form-row">
          <label class="field">
            <span class="field-label">Телефон *</span>
            <input type="tel" data-bind="client_phone" value="${escAttr(state.client_phone)}" placeholder="+7 921 555-12-34">
            <span class="field-error" id="phoneError"></span>
          </label>
        </div>
        <div class="form-row">
          <label class="field">
            <span class="field-label">Адрес</span>
            <input type="text" data-bind="address" value="${escAttr(state.address)}" placeholder="СПб, Просвещения 87, кв. 12">
          </label>
        </div>
      </div>
    `);
    return block;
  }

  function bindInputs(node) {
    node.querySelectorAll("[data-bind]").forEach(inp => {
      inp.addEventListener("input", e => {
        state[e.target.dataset.bind] = e.target.value;
        saveState();
      });
    });
  }

  function bindPhotoInput(node) {
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
      input.value = "";
      if (!files.length) return;
      for (const f of files) {
        if (photos.length >= 20) break;
        if (!f.type || !f.type.startsWith("image/")) continue;
        try {
          const dataUrl = await compressImage(f, 1800, 0.78);
          photos.push({ name: f.name || `photo_${photos.length + 1}`, dataUrl });
        } catch (err) {
          console.warn("Не удалось сжать фото", err);
        }
      }
      refreshList();
      haptic && haptic("success");
    });

    refreshList();
  }

  /* Сжатие через canvas */
  function compressImage(file, maxSide = 1800, quality = 0.78) {
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
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          try { resolve(canvas.toDataURL("image/jpeg", quality)); }
          catch (err) { reject(err); }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ===================== Submit ===================== */

  async function onSubmit(node) {
    const btn = node.querySelector("#submitBtn");
    const result = node.querySelector("#submitResult");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-inline"></span> сохраняем...';
    result.innerHTML = "";

    // Валидация: для новой записи нужны клиент + телефон + хотя бы 1 фото
    const isUpdate = !!measurementId && prefilledClient;
    if (!isUpdate) {
      const name = (state.client_name || "").trim();
      const phone = (state.client_phone || "").trim();
      const nameErr = node.querySelector("#nameError");
      const phoneErr = node.querySelector("#phoneError");
      if (nameErr) nameErr.textContent = "";
      if (phoneErr) phoneErr.textContent = "";
      if (!name) {
        if (nameErr) nameErr.textContent = "Укажите имя клиента";
        btn.disabled = false; btn.textContent = "Сохранить замер";
        return;
      }
      if (phone.replace(/\D/g, "").length < 10) {
        if (phoneErr) phoneErr.textContent = "Слишком короткий номер";
        btn.disabled = false; btn.textContent = "Сохранить замер";
        return;
      }
    }
    if (!photos.length) {
      result.innerHTML = `<div class="error">Добавьте хотя бы одно фото замера.</div>`;
      btn.disabled = false; btn.textContent = isUpdate ? "Закрыть заявку" : "Сохранить замер";
      return;
    }

    const measurement = {
      photos: photos.map(p => p.dataUrl),
      notes: state.notes || "",
      client_name: isUpdate ? prefilledClient.name : state.client_name,
      client_phone: isUpdate ? prefilledClient.phone : state.client_phone,
      address: isUpdate ? prefilledClient.address : state.address,
      measurement_id: measurementId || undefined,
    };

    try {
      const res = await fetch(`${BACKEND_URL}/api/measurement`, {
        method: "POST",
        body: JSON.stringify({
          initData: tg?.initData || "",
          initDataUnsafe: tg?.initDataUnsafe || null,
          measurement,
        }),
      });
      const data = await res.json();
      if (data.error) {
        result.innerHTML = `<div class="error">Ошибка: ${data.error}</div>`;
        btn.disabled = false; btn.textContent = isUpdate ? "Закрыть заявку" : "Сохранить замер";
        return;
      }
      haptic && haptic("success");
      result.innerHTML = `
        <div class="success">
          <div class="success-icon">${ICONS.check}</div>
          <div>
            <div class="success-title">${isUpdate ? "Заявка закрыта" : "Замер сохранён"}</div>
            <div class="success-sub">${photos.length} фото · ID #${(data.id || "").slice(0, 6)}</div>
          </div>
        </div>
        <div class="podbor-cta-row" style="margin-top:16px;">
          <button class="btn-secondary" id="newOne">Ещё замер</button>
          <button class="btn-primary" id="toHome">На главную</button>
        </div>
      `;
      reset();
      node.querySelector("#newOne")?.addEventListener("click", () => mount(root));
      node.querySelector("#toHome")?.addEventListener("click", () => {
        location.hash = "";
        location.reload();
      });
    } catch (e) {
      result.innerHTML = `<div class="error">Сеть: ${e.message}</div>`;
      btn.disabled = false; btn.textContent = isUpdate ? "Закрыть заявку" : "Сохранить замер";
    }
  }

  /* ===================== Helpers ===================== */

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escAttr(s) { return escHtml(s); }

  return { mount, reset };
})();
