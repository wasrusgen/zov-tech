/* ============================================================
   Замер — структурированная загрузка фото по типам.
   Типы фото: стена 1-4, план комнаты, общий вид, деталь.
   ============================================================ */

const Measurements = (function () {
  const STORAGE_KEY = "zov-measurement-draft-v2";

  // Типы фото — в соответствии с чек-листом ЗАМЕРОВ
  const PHOTO_KINDS = [
    { key: "wall1",   label: "Стена 1" },
    { key: "wall2",   label: "Стена 2" },
    { key: "wall3",   label: "Стена 3" },
    { key: "wall4",   label: "Стена 4" },
    { key: "plan",    label: "План комнаты" },
    { key: "general", label: "Общий вид" },
    { key: "detail",  label: "Деталь" },
  ];

  function kindLabel(k) {
    return (PHOTO_KINDS.find(p => p.key === k) || {}).label || k;
  }

  // Фото держим только в памяти
  let photos = []; // Array<{ dataUrl, kind }>

  let state = loadState();
  let root = null;
  let measurementId = ""; // если задан — update-mode (закрытие заявки)
  let prefilledClient = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...defaultState(), ...JSON.parse(raw) };
    } catch (e) {}
    return defaultState();
  }

  function defaultState() {
    const todayStr = new Date().toISOString().slice(0, 10);
    return {
      client_name: "",
      client_phone: "",
      address: "",
      notes: "",
      // Общая инфа замера. zamer_no подгружается из бэка автоматически,
      // floor_base убран — он на самих фото с замером.
      zamer_no: "",
      zamer_date: todayStr,
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

    const hashMatch = (location.hash.split("?")[1] || "");
    const fragQp = new URLSearchParams(hashMatch);
    const mid = fragQp.get("id") || new URLSearchParams(location.search).get("measurement_id") || "";

    // Спецроут #/measure/checklist — показать чек-лист
    if (location.hash.startsWith("#/measure/checklist")) {
      renderChecklist();
      return;
    }
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
        <button class="podbor-help" id="openChecklist" aria-label="Чек-лист">📋</button>
      </header>
    `);
    h.querySelector(".podbor-back").addEventListener("click", () => {
      location.hash = "";
      location.reload();
    });
    h.querySelector("#openChecklist").addEventListener("click", () => {
      location.hash = "#/measure/checklist";
    });
    return h;
  }

  /* ===================== Главный экран ===================== */

  function renderForm() {
    const isUpdate = !!measurementId && prefilledClient;
    const clientBlock = isUpdate ? renderClientReadOnly() : renderClientInputs();

    const node = el(`
      <section class="podbor-step">
        <h2 class="display-title">${isUpdate ? "Фото<br><span class=\"accent\">с замера</span>" : "Новый<br><span class=\"accent\">замер</span>"}</h2>
        <p class="lede">${isUpdate
          ? "Загружайте фото по чек-листу — каждая стена отдельно. Чертёж сделаем по фото."
          : "Заполните клиента, дату и загрузите фото по чек-листу. Откройте 📋 чтобы посмотреть как правильно снимать."}</p>

        <div id="clientBlock"></div>

        <div class="section-head" style="margin-top:18px;"><span class="label">📐 Общая информация</span></div>
        <div class="form-row two-col">
          <label class="field">
            <span class="field-label">№ замера</span>
            <input type="text" data-bind="zamer_no" id="zamerNoInput" value="${escAttr(state.zamer_no)}" placeholder="…">
            <span class="field-hint" id="zamerNoHint">Подбираем следующий…</span>
          </label>
          <label class="field">
            <span class="field-label">Дата замера</span>
            <input type="date" data-bind="zamer_date" value="${escAttr(state.zamer_date)}">
          </label>
        </div>

        <div class="section-head" style="margin-top:18px;">
          <span class="label">📷 Фото замера</span>
          <a class="more" id="openChecklist2" style="cursor:pointer;">Чек-лист</a>
        </div>
        <p class="muted" style="font-size:12px;margin:-4px 0 8px;">
          Для каждого фото выберите тип. По чек-листу: каждая стена отдельно + план + общие виды.
        </p>
        <div class="photo-uploader">
          <label class="photo-add-btn" for="photoInput">
            <span class="photo-add-ico">＋</span>
            <span class="photo-add-label">Добавить фото</span>
            <span class="photo-add-hint">камера или галерея · до 30 шт</span>
          </label>
          <input id="photoInput" type="file" accept="image/*" capture="environment" multiple hidden>
        </div>
        <div class="photo-list-tagged" id="photoList"></div>

        <div class="form-row" style="margin-top:18px;">
          <label class="field">
            <span class="field-label">Заметки (голосом или текстом)</span>
            <textarea data-bind="notes" id="zamerNotes" rows="3" placeholder="особенности доступа, газ/электро, что важно учесть">${escHtml(state.notes || "")}</textarea>
            <div class="note-actions" style="margin-top:6px;">
              <button class="btn-mic" id="zamerMic" type="button">🎤 Диктовать</button>
              <span class="note-status" id="zamerMicStatus"></span>
            </div>
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

    node.querySelector("#openChecklist2").addEventListener("click", () => {
      location.hash = "#/measure/checklist";
    });
    node.querySelector("#submitBtn").addEventListener("click", () => onSubmit(node));

    // Голосовой ввод заметок
    setupVoiceMic(
      node.querySelector("#zamerMic"),
      node.querySelector("#zamerNotes"),
      node.querySelector("#zamerMicStatus"),
      (text) => { state.notes = text; saveState(); },
    );

    // Подгружаем следующий № замера если поле пустое
    if (!state.zamer_no) {
      fetchNextZamerNo(node);
    } else {
      const hint = node.querySelector("#zamerNoHint");
      if (hint) hint.textContent = "Можно переписать вручную";
    }

    return node;
  }

  /* ===================== Голосовой ввод заметок ===================== */
  function setupVoiceMic(micBtn, textarea, statusEl, onChange) {
    if (!micBtn || !textarea) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      micBtn.disabled = true;
      micBtn.title = "Браузер не поддерживает голосовой ввод";
      micBtn.style.opacity = "0.5";
      if (statusEl) statusEl.textContent = "недоступно в этом браузере";
      return;
    }
    let rec = null;
    let recording = false;
    let baseText = "";

    micBtn.addEventListener("click", () => {
      if (recording) { rec?.stop(); return; }
      try {
        rec = new SR();
        rec.lang = "ru-RU";
        rec.continuous = true;
        rec.interimResults = true;
      } catch (e) {
        if (statusEl) statusEl.textContent = "Микрофон недоступен: " + e.message;
        return;
      }
      baseText = (textarea.value || "").trim();
      const sep = baseText ? "\n" : "";

      rec.onstart = () => {
        recording = true;
        micBtn.classList.add("rec");
        micBtn.textContent = "⏹ Стоп";
        if (statusEl) statusEl.textContent = "Слушаю...";
        haptic && haptic("impact");
      };
      rec.onresult = (ev) => {
        let interim = "", final = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const t = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) final += t;
          else interim += t;
        }
        if (final) {
          baseText = (baseText + sep + final).trim();
          textarea.value = baseText;
          if (onChange) onChange(baseText);
        } else if (interim) {
          textarea.value = baseText + sep + interim;
        }
      };
      rec.onerror = (ev) => {
        if (statusEl) statusEl.textContent = "Ошибка: " + (ev.error || "неизвестно");
        recording = false;
        micBtn.classList.remove("rec");
        micBtn.textContent = "🎤 Диктовать";
      };
      rec.onend = () => {
        recording = false;
        micBtn.classList.remove("rec");
        micBtn.textContent = "🎤 Диктовать";
        if (statusEl && statusEl.textContent === "Слушаю...") statusEl.textContent = "";
        if (onChange) onChange(textarea.value || "");
        haptic && haptic("impact");
      };
      try { rec.start(); } catch (e) {
        if (statusEl) statusEl.textContent = "Не запустить: " + e.message;
      }
    });
  }

  async function fetchNextZamerNo(node) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/measurement_next_no`, {
        method: "POST",
        body: JSON.stringify({
          initData: tg?.initData || "",
          initDataUnsafe: tg?.initDataUnsafe || null,
        }),
      });
      const data = await res.json();
      const hint = node.querySelector("#zamerNoHint");
      const input = node.querySelector("#zamerNoInput");
      if (data.ok && data.next_no && input && !state.zamer_no) {
        input.value = String(data.next_no);
        state.zamer_no = String(data.next_no);
        saveState();
        if (hint) hint.textContent = "Подобран автоматически — можно изменить";
      } else if (hint) {
        hint.textContent = "Введите номер вручную";
      }
    } catch (e) {
      const hint = node.querySelector("#zamerNoHint");
      if (hint) hint.textContent = "Введите номер вручную";
    }
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
    return el(`
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
  }

  function bindInputs(node) {
    node.querySelectorAll("[data-bind]").forEach(inp => {
      inp.addEventListener("input", e => {
        state[e.target.dataset.bind] = e.target.value;
        saveState();
      });
    });
  }

  function nextKindSuggestion() {
    // Авто-предложение: сначала Стена 1, потом 2,3,4, затем План, затем Общий
    const usedWalls = new Set(photos.filter(p => p.kind?.startsWith("wall")).map(p => p.kind));
    for (let i = 1; i <= 4; i++) {
      if (!usedWalls.has(`wall${i}`)) return `wall${i}`;
    }
    const hasPlan = photos.some(p => p.kind === "plan");
    if (!hasPlan) return "plan";
    return "general";
  }

  function bindPhotoInput(node) {
    const list = node.querySelector("#photoList");
    const input = node.querySelector("#photoInput");

    function refreshList() {
      list.innerHTML = "";
      if (!photos.length) {
        list.innerHTML = `<div class="empty" style="padding:12px;text-align:center;color:var(--muted);font-size:12px;">Ещё нет фото</div>`;
        return;
      }
      photos.forEach((ph, idx) => {
        const tile = el(`
          <div class="photo-tagged">
            <div class="photo-tagged-thumb">
              <img src="${ph.dataUrl}" alt="фото ${idx + 1}">
              <button class="photo-rm" data-idx="${idx}" aria-label="Удалить">×</button>
            </div>
            <select class="photo-kind" data-idx="${idx}">
              ${PHOTO_KINDS.map(k =>
                `<option value="${k.key}" ${k.key === ph.kind ? "selected" : ""}>${k.label}</option>`
              ).join("")}
            </select>
          </div>
        `);
        tile.querySelector(".photo-rm").addEventListener("click", e => {
          const i = +e.currentTarget.dataset.idx;
          photos.splice(i, 1);
          haptic && haptic("impact");
          refreshList();
        });
        tile.querySelector(".photo-kind").addEventListener("change", e => {
          const i = +e.target.dataset.idx;
          photos[i].kind = e.target.value;
        });
        list.appendChild(tile);
      });
    }

    input.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      input.value = "";
      if (!files.length) return;
      for (const f of files) {
        if (photos.length >= 30) break;
        if (!f.type || !f.type.startsWith("image/")) continue;
        try {
          const dataUrl = await compressImage(f, 1800, 0.78);
          const kind = nextKindSuggestion();
          photos.push({ dataUrl, kind });
        } catch (err) {
          console.warn("Не удалось сжать фото", err);
        }
      }
      refreshList();
      haptic && haptic("success");
    });

    refreshList();
  }

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

  /* ===================== Чек-лист — отдельный экран ===================== */

  // Состояние галочек хранится в localStorage по measurement_id (или draft)
  function checklistKey() {
    return `zov-checklist-${measurementId || "draft"}`;
  }
  function loadChecklistState() {
    try { return JSON.parse(localStorage.getItem(checklistKey()) || "{}"); }
    catch (e) { return {}; }
  }
  function saveChecklistState(s) {
    try { localStorage.setItem(checklistKey(), JSON.stringify(s)); } catch (e) {}
  }
  function resetChecklistDraft() {
    try { localStorage.removeItem(`zov-checklist-draft`); } catch (e) {}
  }

  async function renderChecklist() {
    root.innerHTML = "";
    root.appendChild(el(`
      <header class="podbor-header">
        <button class="podbor-back" aria-label="Назад">${ICONS.arrow_left || "‹"}</button>
        <div class="podbor-title">Чек-лист замера</div>
        <button class="podbor-help" id="resetCl" aria-label="Сбросить">↺</button>
      </header>
    `));
    root.querySelector(".podbor-back").addEventListener("click", () => {
      if (measurementId) location.hash = `#/measure?id=${measurementId}`;
      else location.hash = "#/measure";
    });

    const wrap = el(`<section class="podbor-step checklist-page"></section>`);
    root.appendChild(wrap);
    wrap.appendChild(el(`<div class="loader-inline"><div class="spinner"></div></div>`));

    try {
      const res = await fetch("./assets/zamer-checklist.md", { cache: "no-cache" });
      const md = await res.text();
      const clState = loadChecklistState();
      wrap.innerHTML = `
        <div class="checklist-progress" id="clProgress"></div>
        <div class="checklist-md">${renderMarkdown(md, clState)}</div>
      `;
      bindChecklistInteractions(wrap, clState);
      updateChecklistProgress(wrap, clState);

      root.querySelector("#resetCl").addEventListener("click", () => {
        if (!confirm("Сбросить все галочки?")) return;
        const empty = {};
        saveChecklistState(empty);
        renderChecklist();
      });
    } catch (e) {
      wrap.innerHTML = `<div class="error">Не удалось загрузить чек-лист: ${e.message}</div>`;
    }
  }

  function bindChecklistInteractions(wrap, clState) {
    wrap.querySelectorAll(".cl-item").forEach(item => {
      item.addEventListener("click", () => {
        const key = item.dataset.key;
        if (!key) return;
        const isChecked = item.classList.contains("checked");
        const checkSpan = item.querySelector(".cl-check");
        if (isChecked) {
          item.classList.remove("checked");
          if (checkSpan) checkSpan.textContent = "☐";
          delete clState[key];
        } else {
          item.classList.add("checked");
          if (checkSpan) checkSpan.textContent = "☑";
          clState[key] = true;
        }
        saveChecklistState(clState);
        updateChecklistProgress(wrap, clState);
        haptic && haptic("impact");
      });
    });
  }

  function updateChecklistProgress(wrap, clState) {
    const total = wrap.querySelectorAll(".cl-item").length;
    const done = Object.keys(clState).filter(k => clState[k]).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const bar = wrap.querySelector("#clProgress");
    if (bar) {
      bar.innerHTML = `
        <div class="cl-pbar"><div class="cl-pbar-fill" style="width:${pct}%"></div></div>
        <div class="cl-pcount">${done} из ${total} · ${pct}%</div>
      `;
    }
  }

  /* Минимальный markdown → HTML: заголовки, списки, таблицы, code, чекбоксы */
  function renderMarkdown(md, clState = {}) {
    const lines = md.split("\n");
    const out = [];
    let inList = false;
    let inTable = false;
    let tableRows = [];

    function closeList() { if (inList) { out.push("</ul>"); inList = false; } }
    function closeTable() {
      if (!inTable) return;
      if (tableRows.length) {
        const html = ["<table class='cl-table'>"];
        tableRows.forEach((cells, i) => {
          const tag = i === 0 ? "th" : "td";
          if (i === 1 && cells.every(c => /^[-:\s|]+$/.test(c))) return; // skip separator
          html.push(`<tr>${cells.map(c => `<${tag}>${inline(c)}</${tag}>`).join("")}</tr>`);
        });
        html.push("</table>");
        out.push(html.join(""));
      }
      tableRows = [];
      inTable = false;
    }

    function inline(s) {
      return escHtml(s)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    }

    for (const raw of lines) {
      const line = raw.trimEnd();
      // Директива @pict:KEY — вставляем SVG-эскиз из ZAMER_PICTS
      const pictMatch = line.match(/^@pict:([a-z_]+)$/i);
      if (pictMatch) {
        closeList();
        closeTable();
        const key = pictMatch[1].toLowerCase();
        const svg = (window.ZAMER_PICTS || {})[key];
        if (svg) {
          out.push(`<div class="cl-pict">${svg}</div>`);
        }
        continue;
      }
      // Таблица
      if (line.includes("|") && line.match(/^\s*\|/)) {
        if (!inTable) { closeList(); inTable = true; }
        const cells = line.split("|").slice(1, -1).map(s => s.trim());
        tableRows.push(cells);
        continue;
      } else if (inTable) {
        closeTable();
      }
      // Заголовки
      if (line.startsWith("# ")) {
        closeList();
        out.push(`<h1>${inline(line.slice(2))}</h1>`);
      } else if (line.startsWith("## ")) {
        closeList();
        out.push(`<h2>${inline(line.slice(3))}</h2>`);
      } else if (line.startsWith("### ")) {
        closeList();
        out.push(`<h3>${inline(line.slice(4))}</h3>`);
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        if (!inList) { out.push("<ul>"); inList = true; }
        let content = line.slice(2);
        // [ ] checkbox — делаем интерактивным с уникальным ключом
        if (content.startsWith("[ ] ") || content.startsWith("[x] ") || content.startsWith("[X] ")) {
          const text = content.slice(4);
          // Ключ = первые 60 символов содержимого (для стабильности при edit)
          const key = "cl_" + text.replace(/[^\wа-яА-ЯёЁ]+/g, "_").slice(0, 60).toLowerCase();
          const checked = !!clState[key];
          out.push(
            `<li class="cl-item${checked ? " checked" : ""}" data-key="${key}">` +
              `<span class="cl-check">${checked ? "☑" : "☐"}</span> ${inline(text)}` +
            `</li>`
          );
        } else {
          out.push(`<li>${inline(content)}</li>`);
        }
      } else if (line === "---") {
        closeList();
        out.push(`<hr>`);
      } else if (line === "") {
        closeList();
        out.push("");
      } else {
        closeList();
        out.push(`<p>${inline(line)}</p>`);
      }
    }
    closeList();
    closeTable();
    return out.join("\n");
  }

  /* ===================== Submit ===================== */

  async function onSubmit(node) {
    const btn = node.querySelector("#submitBtn");
    const result = node.querySelector("#submitResult");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-inline"></span> сохраняем...';
    result.innerHTML = "";

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
      // Структурированные фото + их типы
      photos: photos.map(p => p.dataUrl),
      photos_meta: photos.map(p => ({ kind: p.kind })),
      // Общая инфа замера
      zamer_no: state.zamer_no || "",
      zamer_date: state.zamer_date || "",
      notes: state.notes || "",
      // Клиент
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

  return { mount, reset, kindLabel, PHOTO_KINDS };
})();
