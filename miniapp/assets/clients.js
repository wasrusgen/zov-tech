/* ============================================================
   Клиенты — список + история подборов
   ============================================================ */

const Clients = (function () {
  let root = null;
  let clientsCache = null;

  /* ===================== Mount ===================== */

  function mount(container) {
    root = container;
    document.body.classList.remove("has-bottom-nav");
    const oldNav = document.getElementById("bottom-nav");
    if (oldNav) oldNav.remove();

    const sub = location.hash.replace(/^#\/clients\/?/, "");
    if (sub === "new" || sub.startsWith("new")) {
      renderNewClient();
    } else if (sub.startsWith("lead/")) {
      const leadId = sub.slice(5);
      renderLead(leadId);
    } else if (sub.startsWith("measurement/")) {
      const measurementId = sub.slice(12);
      renderMeasurement(measurementId);
    } else if (sub.startsWith("client/")) {
      const clientKey = decodeURIComponent(sub.slice(7));
      renderClientHistory(clientKey);
    } else {
      renderList();
    }
  }

  /* ===================== Заведение нового клиента ===================== */

  function renderNewClient() {
    root.innerHTML = "";
    root.appendChild(headerEl("Новый клиент", "#/clients"));

    const form = el(`
      <section class="podbor-step">
        <h2 class="display-title">Заводим<br><span class="accent">клиента</span></h2>
        <p class="lede">Карточка клиента появится в списке. Замер и подбор техники можно заказать позже из его карточки.</p>

        <div class="form-row">
          <label class="field">
            <span class="field-label">ФИО клиента *</span>
            <input type="text" id="fn" placeholder="Иванов Иван Иванович" autocomplete="name">
            <span class="field-error" id="errName"></span>
          </label>
        </div>
        <div class="form-row">
          <label class="field">
            <span class="field-label">Телефон *</span>
            <input type="tel" id="ph" placeholder="+7 921 555-12-34" autocomplete="tel" inputmode="tel">
            <span class="field-hint" id="phoneHint">Формат +7XXXXXXXXXX или 8XXXXXXXXXX</span>
            <span class="field-error" id="errPhone"></span>
          </label>
        </div>
        <div class="form-row">
          <span class="field-label">Адрес *</span>
          <div class="addr-grid">
            <label class="field">
              <span class="field-sublabel">Город</span>
              <input type="text" id="ad_city" placeholder="Санкт-Петербург" value="Санкт-Петербург" autocomplete="address-level2">
            </label>
            <label class="field">
              <span class="field-sublabel">Улица</span>
              <input type="text" id="ad_street" placeholder="пр. Просвещения" autocomplete="street-address">
            </label>
            <label class="field addr-house">
              <span class="field-sublabel">Дом</span>
              <input type="text" id="ad_house" placeholder="87" inputmode="text">
            </label>
            <label class="field addr-apt">
              <span class="field-sublabel">Кв./офис</span>
              <input type="text" id="ad_apt" placeholder="12" inputmode="numeric">
            </label>
            <label class="field addr-entrance">
              <span class="field-sublabel">Подъезд</span>
              <input type="text" id="ad_entrance" placeholder="1" inputmode="numeric">
            </label>
            <label class="field addr-floor">
              <span class="field-sublabel">Этаж</span>
              <input type="text" id="ad_floor" placeholder="3" inputmode="numeric">
            </label>
          </div>
          <span class="field-error" id="errAddr"></span>
          <div class="geo-status" id="geoStatus"></div>
        </div>
        <div class="form-row two-col">
          <label class="field">
            <span class="field-label">№ договора (опц.)</span>
            <input type="text" id="cn" placeholder="например 1487В-М">
          </label>
          <label class="field">
            <span class="field-label">Дата договора</span>
            <input type="date" id="cd">
          </label>
        </div>
        <div class="form-row">
          <label class="field">
            <span class="field-label">Примечание (можно голосом)</span>
            <textarea id="nt" rows="3" placeholder="как познакомились, особенности, контекст"></textarea>
            <div class="note-actions" style="margin-top:6px;">
              <button class="btn-mic" id="newMic" type="button">🎤 Диктовать</button>
              <span class="note-status" id="newMicStatus"></span>
            </div>
          </label>
        </div>

        <div class="podbor-cta-row" id="saveCta" style="margin-top:18px;">
          <button class="btn-primary" id="saveBtn" type="button">Завести клиента</button>
        </div>
        <div id="result" class="submit-result"></div>
      </section>
    `);
    root.appendChild(form);

    // Авто-нормализация телефона при потере фокуса
    const phoneInput = form.querySelector("#ph");
    phoneInput.addEventListener("blur", () => {
      const normalized = normalizePhone(phoneInput.value);
      if (normalized.ok) phoneInput.value = normalized.value;
    });

    // Голосовой ввод
    setupVoiceMicForField(
      form.querySelector("#newMic"),
      form.querySelector("#nt"),
      form.querySelector("#newMicStatus"),
    );

    form.querySelector("#saveBtn").addEventListener("click", async () => {
      const btn = form.querySelector("#saveBtn");
      const cta = form.querySelector("#saveCta");
      const result = form.querySelector("#result");
      ["errName", "errPhone", "errAddr"].forEach(id => {
        const e = form.querySelector("#" + id);
        if (e) e.textContent = "";
      });
      const name          = (form.querySelector("#fn").value       || "").trim();
      const phoneRaw      = (form.querySelector("#ph").value       || "").trim();
      const adCity        = (form.querySelector("#ad_city").value     || "").trim();
      const adStreet      = (form.querySelector("#ad_street").value  || "").trim();
      const adHouse       = (form.querySelector("#ad_house").value   || "").trim();
      const adApt         = (form.querySelector("#ad_apt").value     || "").trim();
      const adEntrance    = (form.querySelector("#ad_entrance").value|| "").trim();
      const adFloor       = (form.querySelector("#ad_floor").value   || "").trim();
      const note          = (form.querySelector("#nt").value       || "").trim();
      const contract_no   = (form.querySelector("#cn").value       || "").trim();
      const contract_date = (form.querySelector("#cd").value       || "").trim();

      // Собираем адрес из полей
      const address = [
        adCity, adStreet,
        adHouse    ? "д. " + adHouse       : "",
        adApt      ? "кв. " + adApt        : "",
        adEntrance ? "подъезд " + adEntrance : "",
        adFloor    ? "этаж " + adFloor     : "",
      ].filter(Boolean).join(", ");

      // Валидация
      if (!name || name.length < 2) {
        form.querySelector("#errName").textContent = "Имя обязательно (минимум 2 символа)";
        return;
      }
      const norm = normalizePhone(phoneRaw);
      if (!norm.ok) {
        form.querySelector("#errPhone").textContent =
          "Введите корректный российский номер (+7XXXXXXXXXX или 8XXXXXXXXXX)";
        return;
      }
      if (!adCity || !adStreet || !adHouse) {
        form.querySelector("#errAddr").textContent = "Укажите город, улицу и номер дома";
        return;
      }

      btn.disabled = true;
      btn.textContent = "Проверяем адрес…";

      // Геокодирование — проверяем адрес, продолжаем даже при неудаче
      let gps_lat = null, gps_lng = null;
      const geoEl = form.querySelector("#geoStatus");
      try {
        const geoRes = await fetch(`${BACKEND_URL}/api/geocode`, {
          method: "POST",
          body: JSON.stringify({
            initData: tg?.initData || "",
            initDataUnsafe: tg?.initDataUnsafe || null,
            address: `${adCity}, ${adStreet}, д. ${adHouse}`,
            city: adCity,
          }),
        });
        const geoData = await geoRes.json();
        if (geoData.ok && geoData.result) {
          const kind = (geoData.result.kind || "").toLowerCase();
          const precise = ["house", "street", "entrance", "building"].includes(kind);
          if (precise) {
            gps_lat = geoData.result.lat;
            gps_lng = geoData.result.lng;
            geoEl.innerHTML = `<span class="geo-ok">✓ ${escHtml(geoData.result.formatted || address)}</span>`;
          } else {
            geoEl.innerHTML = `<span class="geo-warn">⚠ Улица не найдена — геокодер вернул «${escHtml(geoData.result.formatted || "")}». Проверьте написание улицы. Сохраняем без координат.</span>`;
          }
        } else {
          geoEl.innerHTML = `<span class="geo-warn">⚠ Адрес не найден в геокодере — проверьте написание. Сохраняем без координат.</span>`;
        }
      } catch (_) {
        geoEl.innerHTML = `<span class="geo-warn">⚠ Геокодер недоступен. Сохраняем без координат.</span>`;
      }

      btn.textContent = "Сохраняем...";
      try {
        const res = await fetch(`${BACKEND_URL}/api/client_create`, {
          method: "POST",
          body: JSON.stringify({
            initData: tg?.initData || "",
            initDataUnsafe: tg?.initDataUnsafe || null,
            full_name: name, phone: norm.value, address, note,
            contract_no, contract_date, gps_lat, gps_lng,
          }),
        });
        const data = await res.json();
        if (data.error) {
          const fieldErr = data.field ? form.querySelector("#err" + data.field[0].toUpperCase() + data.field.slice(1)) : null;
          if (fieldErr) fieldErr.textContent = data.msg || data.error;
          else result.innerHTML = `<div class="error">Ошибка: ${escHtml(data.msg || data.error)}</div>`;
          btn.disabled = false;
          btn.textContent = "Завести клиента";
          return;
        }
        haptic && haptic("success");
        // Прячем CTA с «Сохраняем...» и показываем success + кнопки
        cta.style.display = "none";
        result.innerHTML = `
          <div class="success">
            <div class="success-icon">${ICONS.check}</div>
            <div>
              <div class="success-title">Клиент #${data.client_no || "—"} заведён</div>
              <div class="success-sub">${escHtml(name)} · ${escHtml(norm.value)}</div>
            </div>
          </div>
          <div class="podbor-cta-row" style="margin-top:14px;">
            <button class="btn-secondary" id="another" type="button">Ещё клиент</button>
            <button class="btn-primary" id="openCard" type="button">Открыть карточку</button>
          </div>
        `;
        const ckey = data.client_key || name.toLowerCase();
        clientsCache = null;  // сброс кэша
        // ВАЖНО: обработчики ищем В RESULT, не в form (где их нет)
        result.querySelector("#another")?.addEventListener("click", () => renderNewClient());
        result.querySelector("#openCard")?.addEventListener("click", () => {
          location.hash = `#/clients/client/${encodeURIComponent(ckey)}`;
        });
      } catch (e) {
        result.innerHTML = `<div class="error">Сеть: ${escHtml(e.message)}</div>`;
        btn.disabled = false;
        btn.textContent = "Завести клиента";
      }
    });
  }

  // Разбирает сохранённый адрес «Город, Улица, д. NN, кв. MM, подъезд P, этаж F» обратно в поля.
  function splitAddress(combined) {
    if (!combined) return { city: "Санкт-Петербург", street: "", house: "", apt: "", entrance: "", floor: "" };
    let s = combined.trim();
    const grab = (re) => { const m = s.match(re); if (m) { s = s.replace(m[0], ""); return m[1]; } return ""; };
    const floor    = grab(/,\s*этаж\s+([^\s,]+)/i);
    const entrance = grab(/,\s*подъезд\s+([^\s,]+)/i);
    const apt      = grab(/,\s*кв\.?\s*([^\s,]+)/i);
    const house    = grab(/,\s*д\.?\s*([^\s,]+)/i);
    s = s.replace(/,$/, "").trim();
    const parts = s.split(",").map(p => p.trim()).filter(Boolean);
    let city = "", street = "";
    if (parts.length >= 2) { city = parts[0]; street = parts.slice(1).join(", "); }
    else if (parts.length === 1) { city = parts[0]; }
    if (!city) city = "Санкт-Петербург";
    return { city, street, house, apt, entrance, floor };
  }

  function normalizePhone(raw) {
    if (!raw) return { ok: false, value: "" };
    const digits = String(raw).replace(/\D/g, "");
    let normalized = digits;
    if (normalized.length === 11 && normalized.startsWith("8")) {
      normalized = "7" + normalized.slice(1);
    }
    if (normalized.length === 10) normalized = "7" + normalized;
    if (normalized.length !== 11 || !normalized.startsWith("7")) {
      return { ok: false, value: raw };
    }
    return { ok: true, value: "+" + normalized };
  }

  // Единая фабрика голосового ввода.
  // continuous=false + авто-рестарт по фразам — исключает дубли, стабильно на Android/iOS.
  function _buildVoiceEngine(micBtn, textarea, opts) {
    // opts: { statusEl, statusClass, onChange }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      micBtn.disabled = true;
      micBtn.title = "Браузер не поддерживает голос";
      micBtn.style.opacity = "0.5";
      if (opts.statusEl) opts.statusEl.textContent = "недоступно";
      return;
    }

    let active = false;   // пользователь включил микрофон
    let baseText = "";    // подтверждённый текст (растёт по фразам)
    let curRec = null;

    function _setStatus(txt, cls) {
      if (!opts.statusEl) return;
      opts.statusEl.textContent = txt;
      if (opts.statusClass && cls) opts.statusEl.className = opts.statusClass + (cls !== "ok" ? " " + cls : "");
    }

    function startPhrase() {
      let rec;
      try {
        rec = new SR();
        rec.lang = "ru-RU";
        rec.continuous    = false;  // одна фраза — один сеанс, нет накопленных results
        rec.interimResults = true;
      } catch (e) {
        _setStatus("Микрофон недоступен", "err");
        active = false; micBtn.classList.remove("rec"); micBtn.textContent = "🎤 Диктовать";
        return;
      }
      curRec = rec;

      rec.onresult = (ev) => {
        // Только результаты ЭТОЙ фразы — ev.results всегда свежий (continuous=false)
        let fin = "", itr = "";
        for (let i = 0; i < ev.results.length; i++) {
          const t = ev.results[i][0].transcript.trim();
          if (!t) continue;
          if (ev.results[i].isFinal) fin += (fin ? " " : "") + t;
          else              itr += (itr ? " " : "") + t;
        }
        const shown = fin || itr;
        textarea.value = baseText + (baseText && shown ? " " : "") + shown;
      };

      rec.onend = () => {
        // Зафиксировать текущий текст как base и запустить следующую фразу (если active)
        baseText = textarea.value.trim();
        if (active) {
          startPhrase();
        } else {
          micBtn.classList.remove("rec");
          micBtn.textContent = "🎤 Диктовать";
          _setStatus("", "ok");
          if (opts.onChange) opts.onChange(textarea.value || "");
          haptic && haptic("impact");
        }
      };

      rec.onerror = (ev) => {
        if (ev.error === "no-speech") return; // тишина — onend сработает, авто-перезапуск
        _setStatus("Ошибка: " + (ev.error || ""), "err");
        active = false; micBtn.classList.remove("rec"); micBtn.textContent = "🎤 Диктовать";
      };

      try { rec.start(); }
      catch (e) {
        _setStatus("Не запустить: " + e.message, "err");
        active = false; micBtn.classList.remove("rec"); micBtn.textContent = "🎤 Диктовать";
      }
    }

    micBtn.addEventListener("click", () => {
      if (active) {
        active = false;
        curRec?.stop(); // onend → видит active=false → сбросит кнопку
        return;
      }
      active   = true;
      baseText = (textarea.value || "").trim();
      micBtn.classList.add("rec");
      micBtn.textContent = "⏹ Стоп";
      _setStatus("Слушаю...", "ok");
      haptic && haptic("impact");
      startPhrase();
    });
  }

  function setupVoiceMicForField(micBtn, textarea, statusEl) {
    _buildVoiceEngine(micBtn, textarea, { statusEl });
  }

  /* ===================== Список клиентов ===================== */

  async function renderList() {
    root.innerHTML = "";
    root.appendChild(headerEl("Клиенты", null));

    // Большая кнопка «Новый клиент»
    const addBtn = el(`
      <div class="podbor-cta-row" style="margin:6px 0 14px;">
        <button class="btn-primary" id="addClientBtn" type="button">＋ Новый клиент</button>
      </div>
    `);
    addBtn.querySelector("#addClientBtn").addEventListener("click", () => {
      haptic && haptic("impact");
      location.hash = "#/clients/new";
    });
    root.appendChild(addBtn);

    const loading = el(`<div class="loader-inline"><div class="spinner"></div></div>`);
    root.appendChild(loading);

    let data;
    try {
      data = await fetchClients();
      clientsCache = data;
    } catch (e) {
      loading.remove();
      root.appendChild(el(`<div class="error">Не удалось загрузить: ${e.message}</div>`));
      return;
    }
    loading.remove();

    if (!data.clients || !data.clients.length) {
      root.appendChild(el(`
        <div class="empty">
          <p class="lede" style="text-align:center;padding:40px 20px;color:var(--muted)">
            Пока нет клиентов.<br>
            Заведите первого — кнопка выше.
          </p>
        </div>
      `));
      return;
    }

    const meta = el(`
      <div class="kicker" style="margin-bottom:8px;">
        ${data.count} ${pluralize(data.count, "клиент", "клиента", "клиентов")} · ${countLeads(data.clients)} ${pluralize(countLeads(data.clients), "подбор", "подбора", "подборов")}
      </div>
    `);
    root.appendChild(meta);

    const list = el(`<div class="client-list"></div>`);
    for (const c of data.clients) {
      list.appendChild(renderClientCard(c));
    }
    root.appendChild(list);
  }

  function renderClientCard(c) {
    const lastAt = formatDate(c.last_lead_at);
    const card = el(`
      <article class="client-card">
        <div class="client-card-head">
          <div class="client-avatar">${initial(c.client_name)}</div>
          <div class="client-meta">
            <div class="client-name">${escHtml(c.client_name || "Без имени")}</div>
            ${c.client_phone ? `<div class="client-phone">${escHtml(c.client_phone)}</div>` : ""}
          </div>
          <div class="client-arrow">${ICONS.chevron || "›"}</div>
        </div>
        <div class="client-footer">
          <span class="leads-count">${c.leads_count} ${pluralize(c.leads_count, "подбор", "подбора", "подборов")}</span>
          <span class="muted">${lastAt}</span>
        </div>
      </article>
    `);
    card.addEventListener("click", () => {
      haptic && haptic("impact");
      const key = c.client_tg_id || c.client_name.toLowerCase();
      location.hash = `#/clients/client/${encodeURIComponent(key)}`;
    });
    return card;
  }

  /* ===================== История клиента ===================== */

  async function renderClientHistory(clientKey) {
    root.innerHTML = "";
    root.appendChild(headerEl("История подборов", "#/clients"));

    // Берём из кеша если есть
    let clients = clientsCache?.clients;
    if (!clients) {
      try {
        const data = await fetchClients();
        clients = data.clients;
        clientsCache = data;
      } catch (e) {
        root.appendChild(el(`<div class="error">${e.message}</div>`));
        return;
      }
    }
    const client = clients.find(c =>
      (c.client_tg_id && c.client_tg_id === clientKey) ||
      (c.client_name && c.client_name.toLowerCase() === clientKey)
    );
    if (!client) {
      root.appendChild(el(`<div class="empty">Клиент не найден</div>`));
      return;
    }

    // Шапка
    const phoneNorm = (client.client_phone || "").replace(/[^\d+]/g, "");
    const callHref = phoneNorm ? `tel:${phoneNorm}` : "";
    const noTag = client.client_no
      ? `<span class="client-no-badge">#${escHtml(client.client_no)}</span>`
      : "";
    const contractTag = client.contract_no
      ? `<div class="client-detail-meta">📋 договор ${escHtml(client.contract_no)}${client.contract_date ? ` · ${escHtml(client.contract_date)}` : ""}</div>`
      : "";
    const mapUrl = (client.gps_lat && client.gps_lng)
      ? `https://yandex.ru/maps/?ll=${client.gps_lng},${client.gps_lat}&z=17&pt=${client.gps_lng},${client.gps_lat},pm2rdm`
      : "";
    const addressTag = client.address
      ? `<div class="client-detail-meta client-detail-addr">
           <span class="addr-text">📍 ${escHtml(client.address)}</span>${mapUrl
             ? `<a class="map-link-btn" href="${escAttr(mapUrl)}" target="_blank" rel="noopener">🗺 Карта</a>`
             : ""}
         </div>`
      : "";
    const statusTag = client.in_work
      ? ""
      : `<div class="client-detail-meta" style="color:var(--accent-2,#76BD22);">● ещё не в работе</div>`;
    root.appendChild(el(`
      <div class="client-detail-head">
        <div class="client-avatar lg">${initial(client.client_name)}</div>
        <div style="flex:1;min-width:0;">
          <h2 class="client-detail-name">${escHtml(client.client_name)} ${noTag}</h2>
          ${client.client_phone ? `<div class="client-detail-phone">${escHtml(client.client_phone)}</div>` : ""}
          ${addressTag}
          ${contractTag}
          ${statusTag}
        </div>
        ${callHref ? `<a class="client-call-btn" href="${callHref}" aria-label="Позвонить">📞</a>` : ""}
      </div>
    `));

    // Управление карточкой — кнопки прямо под шапкой
    root.appendChild(renderClientManagement(client));

    // Быстрые действия для менеджера — кастомные SVG-иконки в орехе
    const QA_ICON_PODBOR = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z"/>
        <path d="M19 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z"/>
        <path d="M5 16.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5.5-1.3z"/>
      </svg>`;
    const QA_ICON_RULER = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0z"/>
        <path d="M14.5 12.5 12 15"/>
        <path d="M11.5 9.5 9 12"/>
        <path d="M8.5 6.5 6 9"/>
        <path d="M17.5 15.5 15 18"/>
      </svg>`;
    const QA_ICON_WRENCH = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>`;
    const QA_ICON_COPY = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="8" y="8" width="13" height="13" rx="2"/>
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>
      </svg>`;
    const actionsRow = el(`
      <div class="client-quick-actions">
        <button class="qa-btn" data-act="podbor" type="button">
          <span class="qa-icon">${QA_ICON_PODBOR}</span>
          <span class="qa-label">Подбор техники</span>
        </button>
        <button class="qa-btn" data-act="measure" type="button">
          <span class="qa-icon">${QA_ICON_RULER}</span>
          <span class="qa-label">Заказать замер</span>
        </button>
        <button class="qa-btn" data-act="assembly" type="button">
          <span class="qa-icon">${QA_ICON_WRENCH}</span>
          <span class="qa-label">Заказать сборку</span>
        </button>
        <button class="qa-btn" data-act="copy" type="button">
          <span class="qa-icon">${QA_ICON_COPY}</span>
          <span class="qa-label">Копировать ФИО+тел</span>
        </button>
      </div>
    `);
    actionsRow.querySelectorAll(".qa-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        haptic && haptic("impact");
        const act = btn.dataset.act;
        if (act === "podbor") {
          location.hash = `#/podbor?client_name=${encodeURIComponent(client.client_name || "")}&client_phone=${encodeURIComponent(client.client_phone || "")}`;
        } else if (act === "measure") {
          // Pre-fill request with client info
          sessionStorage.setItem("prefillClient", JSON.stringify({
            name: client.client_name, phone: client.client_phone,
          }));
          location.hash = "#/request";
        } else if (act === "assembly") {
          // Pre-fill assembly with client info + address из последнего замера
          sessionStorage.setItem("prefillAssembly", JSON.stringify({
            name: client.client_name,
            phone: client.client_phone,
            address: (myMeasurements[0] && myMeasurements[0].address) || "",
            measurement_id: (myMeasurements[0] && myMeasurements[0].id) || "",
          }));
          location.hash = "#/assembly/new";
        } else if (act === "copy") {
          const txt = `${client.client_name || ""} ${client.client_phone || ""}`.trim();
          (navigator.clipboard?.writeText(txt) || Promise.resolve())
            .then(() => tg?.showAlert?.("Скопировано"));
        }
      });
    });
    root.appendChild(actionsRow);

    // Примечание менеджера с голосовым вводом
    root.appendChild(renderClientNoteBlock(client));

    // Хронология + Файлы — собираются после загрузки замеров
    const timelinePlaceholder = el(`<div id="clTimelinePlaceholder"></div>`);
    const filesPlaceholder = el(`<div id="clFilesPlaceholder"></div>`);
    const detailsPlaceholder = el(`<div id="clDetailsPlaceholder"></div>`);
    root.appendChild(timelinePlaceholder);
    root.appendChild(filesPlaceholder);
    root.appendChild(detailsPlaceholder);

    let myMeasurements = [];
    try {
      const ms = await fetchMeasurements({ client_tg_id: client.client_tg_id || "" });
      myMeasurements = (ms.measurements || []).filter(m => {
        if (client.client_tg_id) return String(m.client_tg_id) === String(client.client_tg_id);
        return (m.notes || "").toLowerCase().includes((client.client_name || "").toLowerCase());
      });
    } catch (e) { /* пусто */ }

    // Хронология
    timelinePlaceholder.replaceWith(renderClientTimeline(client, myMeasurements));
    // Файлы
    filesPlaceholder.replaceWith(renderClientFiles(client, myMeasurements));
    // Детальные списки внизу (свёрнуты)
    detailsPlaceholder.replaceWith(renderClientDetails(client, myMeasurements));

    // (управление перенесено наверх — сразу под шапку)
  }

  /* ===================== Управление карточкой (edit / delete) ===================== */

  // Кастомные SVG-иконки в брендовом монолинейном стиле (stroke-width 1.7)
  const ICON_EDIT_SVG = `
    <svg class="ct-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3.5 20.5h4.5l10-10-4.5-4.5-10 10v4.5z"/>
      <path d="M14 6l4 4"/>
      <path d="M14.5 4.5l1.5-1.5a2 2 0 0 1 2.8 0l1.7 1.7a2 2 0 0 1 0 2.8L19 9"/>
    </svg>`;
  const ICON_TRASH_SVG = `
    <svg class="ct-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 7h16"/>
      <path d="M9.5 7V5.2A1.7 1.7 0 0 1 11.2 3.5h1.6A1.7 1.7 0 0 1 14.5 5.2V7"/>
      <path d="M6 7l1.1 12.3a1.8 1.8 0 0 0 1.8 1.7h6.2a1.8 1.8 0 0 0 1.8-1.7L18 7"/>
      <path d="M10 11.5v5.5"/>
      <path d="M14 11.5v5.5"/>
    </svg>`;

  function renderClientManagement(client) {
    const inWork = !!client.in_work;
    const wrap = el(`
      <div class="client-toolbar ${inWork ? "is-locked" : "is-free"}">
        <button class="ct-btn ct-edit" id="editClient" type="button" aria-label="Редактировать">
          ${ICON_EDIT_SVG}
          <span class="ct-label">Редактировать</span>
        </button>
        ${inWork ? "" : `
          <button class="ct-btn ct-delete" id="deleteClient" type="button" aria-label="Удалить">
            ${ICON_TRASH_SVG}
            <span class="ct-label">Удалить</span>
          </button>`}
        <div class="ct-hint">${inWork
          ? "В работе — данные можно править"
          : "Не в работе — можно править или удалить"}
        </div>
        <div class="ct-result" id="manageResult"></div>
      </div>
    `);

    wrap.querySelector("#editClient")?.addEventListener("click", () => {
      haptic && haptic("impact");
      renderEditClient(client);
    });

    wrap.querySelector("#deleteClient")?.addEventListener("click", async () => {
      const confirmed = await confirmDialog(`Удалить клиента ${client.client_name}? Это нельзя отменить из бота.`);
      if (!confirmed) return;
      const btn = wrap.querySelector("#deleteClient");
      const labelEl = btn.querySelector(".ct-label");
      const result = wrap.querySelector("#manageResult");
      btn.disabled = true;
      if (labelEl) labelEl.textContent = "Удаляем…";
      try {
        const res = await fetch(`${BACKEND_URL}/api/client_delete`, {
          method: "POST",
          body: JSON.stringify({
            initData: tg?.initData || "",
            initDataUnsafe: tg?.initDataUnsafe || null,
            client_key: (client.client_name || "").toLowerCase(),
          }),
        });
        const data = await res.json();
        if (data.error) {
          const msg = data.msg || data.error;
          result.innerHTML = `<span class="ct-err">${escHtml(msg)}</span>`;
          btn.disabled = false;
          if (labelEl) labelEl.textContent = "Удалить";
          return;
        }
        haptic && haptic("success");
        clientsCache = null;
        result.innerHTML = `<span class="ct-ok">Архивировано ${data.archived} записей. Возвращаемся в список…</span>`;
        setTimeout(() => { location.hash = "#/clients"; window.location.reload(); }, 1200);
      } catch (e) {
        result.innerHTML = `<span class="ct-err">Сеть: ${escHtml(e.message)}</span>`;
        btn.disabled = false;
        if (labelEl) labelEl.textContent = "Удалить";
      }
    });

    return wrap;
  }

  /* ===================== Форма редактирования клиента ===================== */

  function renderEditClient(client) {
    root.innerHTML = "";
    root.appendChild(headerEl("Редактировать клиента", "#/clients"));

    const addrParts = splitAddress(client.address || "");
    const form = el(`
      <section class="podbor-step">
        <h2 class="display-title">Редактируем<br><span class="accent">клиента</span></h2>
        <p class="lede">Изменения применятся ко всем заявкам и замерам этого клиента.</p>

        <div class="form-row">
          <label class="field">
            <span class="field-label">ФИО клиента *</span>
            <input type="text" id="ed_fn" value="${escAttr(client.client_name || "")}" placeholder="Иванов Иван Иванович">
            <span class="field-error" id="ed_errName"></span>
          </label>
        </div>
        <div class="form-row">
          <label class="field">
            <span class="field-label">Телефон *</span>
            <input type="tel" id="ed_ph" value="${escAttr(client.client_phone || "")}" placeholder="+7 921 555-12-34" inputmode="tel">
            <span class="field-error" id="ed_errPhone"></span>
          </label>
        </div>
        <div class="form-row">
          <span class="field-label">Адрес</span>
          <div class="addr-grid">
            <label class="field">
              <span class="field-sublabel">Город</span>
              <input type="text" id="ed_city" value="${escAttr(addrParts.city)}" placeholder="Санкт-Петербург" autocomplete="address-level2">
            </label>
            <label class="field">
              <span class="field-sublabel">Улица</span>
              <input type="text" id="ed_street" value="${escAttr(addrParts.street)}" placeholder="пр. Просвещения" autocomplete="street-address">
            </label>
            <label class="field addr-house">
              <span class="field-sublabel">Дом</span>
              <input type="text" id="ed_house" value="${escAttr(addrParts.house)}" placeholder="87" inputmode="text">
            </label>
            <label class="field addr-apt">
              <span class="field-sublabel">Кв./офис</span>
              <input type="text" id="ed_apt" value="${escAttr(addrParts.apt)}" placeholder="12" inputmode="numeric">
            </label>
            <label class="field addr-entrance">
              <span class="field-sublabel">Подъезд</span>
              <input type="text" id="ed_entrance" value="${escAttr(addrParts.entrance)}" placeholder="1" inputmode="numeric">
            </label>
            <label class="field addr-floor">
              <span class="field-sublabel">Этаж</span>
              <input type="text" id="ed_floor" value="${escAttr(addrParts.floor)}" placeholder="3" inputmode="numeric">
            </label>
          </div>
          <span class="field-error" id="ed_errAddr"></span>
          <div class="geo-status" id="ed_geoStatus"></div>
        </div>
        <div class="form-row two-col">
          <label class="field">
            <span class="field-label">№ договора</span>
            <input type="text" id="ed_cno" value="${escAttr(client.contract_no || "")}" placeholder="2026-0123">
          </label>
          <label class="field">
            <span class="field-label">Дата договора</span>
            <input type="date" id="ed_cdate" value="${escAttr(client.contract_date || "")}">
          </label>
        </div>

        <div class="podbor-cta-row" style="margin-top:18px;gap:8px;">
          <button class="btn-secondary" id="ed_cancel" type="button">Отмена</button>
          <button class="btn-primary" id="ed_save" type="button">Сохранить</button>
        </div>
        <div id="ed_result" style="margin-top:10px;font-size:13px;"></div>
      </section>
    `);
    root.appendChild(form);

    form.querySelector("#ed_cancel").addEventListener("click", () => {
      const key = client.client_tg_id || (client.client_name || "").toLowerCase();
      location.hash = `#/clients/client/${encodeURIComponent(key)}`;
    });

    form.querySelector("#ed_save").addEventListener("click", async () => {
      const fn         = form.querySelector("#ed_fn").value.trim();
      const ph         = form.querySelector("#ed_ph").value.trim();
      const edCity     = (form.querySelector("#ed_city").value     || "").trim();
      const edStreet   = (form.querySelector("#ed_street").value   || "").trim();
      const edHouse    = (form.querySelector("#ed_house").value    || "").trim();
      const edApt      = (form.querySelector("#ed_apt").value      || "").trim();
      const edEntrance = (form.querySelector("#ed_entrance").value || "").trim();
      const edFloor    = (form.querySelector("#ed_floor").value    || "").trim();
      const cno      = form.querySelector("#ed_cno").value.trim();
      const cdate    = form.querySelector("#ed_cdate").value.trim();
      const errName  = form.querySelector("#ed_errName");
      const errPhone = form.querySelector("#ed_errPhone");
      const errAddr  = form.querySelector("#ed_errAddr");
      const result   = form.querySelector("#ed_result");
      errName.textContent = ""; errPhone.textContent = ""; errAddr.textContent = ""; result.innerHTML = "";

      if (!fn || fn.length < 2) {
        errName.textContent = "Имя слишком короткое";
        return;
      }
      const norm = normalizePhone(ph);
      if (!norm.ok) {
        errPhone.textContent = "Телефон в формате +7XXXXXXXXXX";
        return;
      }
      if (!edCity || !edStreet || !edHouse) {
        errAddr.textContent = "Укажите город, улицу и номер дома";
        return;
      }

      const address = [
        edCity, edStreet,
        edHouse    ? "д. " + edHouse         : "",
        edApt      ? "кв. " + edApt          : "",
        edEntrance ? "подъезд " + edEntrance : "",
        edFloor    ? "этаж " + edFloor       : "",
      ].filter(Boolean).join(", ");

      const btn = form.querySelector("#ed_save");
      btn.disabled = true; btn.textContent = "Проверяем адрес…";

      // Геокодирование — необязательно, продолжаем даже при неудаче
      let gps_lat = null, gps_lng = null;
      const geoEl = form.querySelector("#ed_geoStatus");
      try {
        const geoRes = await fetch(`${BACKEND_URL}/api/geocode`, {
          method: "POST",
          body: JSON.stringify({
            initData: tg?.initData || "",
            initDataUnsafe: tg?.initDataUnsafe || null,
            address: `${edCity}, ${edStreet}, д. ${edHouse}`,
            city: edCity,
          }),
        });
        const geoData = await geoRes.json();
        if (geoData.ok && geoData.result) {
          const kind = (geoData.result.kind || "").toLowerCase();
          const precise = ["house", "street", "entrance", "building"].includes(kind);
          if (precise) {
            gps_lat = geoData.result.lat;
            gps_lng = geoData.result.lng;
            geoEl.innerHTML = `<span class="geo-ok">✓ ${escHtml(geoData.result.formatted || address)}</span>`;
          } else {
            geoEl.innerHTML = `<span class="geo-warn">⚠ Улица не найдена — геокодер вернул «${escHtml(geoData.result.formatted || "")}». Проверьте написание улицы. Сохраняем без координат.</span>`;
          }
        } else {
          geoEl.innerHTML = `<span class="geo-warn">⚠ Адрес не найден — сохраняем без координат.</span>`;
        }
      } catch (_) {
        geoEl.innerHTML = `<span class="geo-warn">⚠ Геокодер недоступен. Сохраняем без координат.</span>`;
      }

      btn.textContent = "Сохраняем...";
      try {
        const res = await fetch(`${BACKEND_URL}/api/client_update`, {
          method: "POST",
          body: JSON.stringify({
            initData: tg?.initData || "",
            initDataUnsafe: tg?.initDataUnsafe || null,
            client_key: (client.client_name || "").toLowerCase(),
            full_name: fn,
            phone: norm.value,
            address,
            contract_no: cno,
            contract_date: cdate,
            gps_lat,
            gps_lng,
          }),
        });
        const data = await res.json();
        if (data.error) {
          result.innerHTML = `<span style="color:#C0392B;">${escHtml(data.msg || data.error)}</span>`;
          btn.disabled = false; btn.textContent = "Сохранить";
          return;
        }
        haptic && haptic("success");
        clientsCache = null;
        const newKey = data.client_key || fn.toLowerCase();
        result.innerHTML = `<span style="color:#27AE60;">✓ обновлено ${data.updated} запис(ей). Открываем карточку...</span>`;
        setTimeout(() => {
          location.hash = `#/clients/client/${encodeURIComponent(newKey)}`;
          window.location.reload();
        }, 800);
      } catch (e) {
        result.innerHTML = `<span style="color:#C0392B;">Сеть: ${escHtml(e.message)}</span>`;
        btn.disabled = false; btn.textContent = "Сохранить";
      }
    });
  }

  function confirmDialog(msg) {
    return new Promise((resolve) => {
      if (window.Telegram?.WebApp?.showConfirm) {
        window.Telegram.WebApp.showConfirm(msg, (ok) => resolve(!!ok));
      } else {
        resolve(window.confirm(msg));
      }
    });
  }

  /* ===================== Хронология ===================== */

  function renderClientTimeline(client, measurements) {
    // Собираем события из лидов и замеров
    const events = [];

    for (const lead of client.leads || []) {
      events.push({
        ts: lead.created_at,
        icon: "🤖",
        title: "Подбор техники",
        sub: `#${(lead.id || "").slice(0, 8)} · ${statusLabel(lead.status)}`,
        href: `#/clients/lead/${lead.id}`,
      });
    }

    for (const m of measurements) {
      const photoCount = m.photo_count || (m.photos || []).length;
      // Скрываем draft-карточки из таймлайна — это пустая «техническая» строка,
      // которая создаётся при заведении клиента. В таймлайн попадают только реальные события.
      if (m.status === "draft") continue;
      // Создание заявки / замера
      events.push({
        ts: m.created_at,
        icon: m.status === "requested" ? "📋" : "📐",
        title: m.status === "requested" ? "Заявка на замер" : "Замер создан",
        sub: m.address ? escHtml(m.address) : (m.status === "requested" ? "ожидает согласования" : ""),
        href: `#/clients/measurement/${m.id}`,
      });
      // Если назначен — отдельное событие на момент scheduled_at
      if (m.scheduled_at) {
        events.push({
          ts: m.scheduled_at,
          icon: "📅",
          title: "Замер назначен",
          sub: formatDate(m.scheduled_at) + (m.address ? " · " + escHtml(m.address) : ""),
          href: `#/clients/measurement/${m.id}`,
        });
      }
      // Если завершён — отдельное событие
      if (m.status === "completed") {
        events.push({
          ts: m.created_at,  // нет updated_at, используем created
          icon: "✅",
          title: "Замер выполнен",
          sub: `${photoCount} фото` + (m.area_m2 ? ` · ${m.area_m2} м²` : ""),
          href: `#/clients/measurement/${m.id}`,
        });
      }
    }

    events.sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));

    const section = el(`
      <details class="block client-timeline-block client-collapse">
        <summary class="block-head collapse-head">
          <span class="collapse-title">🕒 Хронология · ${events.length}</span>
          <span class="collapse-chev" aria-hidden="true">›</span>
        </summary>
        ${events.length === 0
          ? `<div class="empty" style="padding:14px;text-align:center;color:var(--muted);font-size:13px;">Пока нет событий</div>`
          : `<div class="timeline">${events.map(ev => `
              <a class="tl-item" ${ev.href ? `href="${ev.href}"` : ""}>
                <div class="tl-dot"></div>
                <div class="tl-content">
                  <div class="tl-date">${formatDate(ev.ts)}</div>
                  <div class="tl-title"><span class="tl-icon">${ev.icon}</span>${ev.title}</div>
                  ${ev.sub ? `<div class="tl-sub">${ev.sub}</div>` : ""}
                </div>
              </a>
            `).join("")}</div>`}
      </details>
    `);
    return section;
  }

  /* ===================== Файлы клиента ===================== */

  function renderClientFiles(client, measurements) {
    const groups = [];
    for (const m of measurements) {
      const photos = m.photos || [];
      if (photos.length) {
        groups.push({
          title: `📐 Замер от ${formatDate(m.created_at)}`,
          sub: `${photos.length} фото` + (m.area_m2 ? ` · ${m.area_m2} м²` : ""),
          photos,
          measurement_id: m.id,
        });
      }
    }
    const totalPhotos = groups.reduce((s, g) => s + g.photos.length, 0);

    const section = el(`
      <section class="block client-files-block">
        <div class="block-head">📂 Файлы · ${totalPhotos}</div>
        ${groups.length === 0
          ? `<div class="empty" style="padding:14px;text-align:center;color:var(--muted);font-size:13px;">Файлов нет. Появятся после замера и подбора.</div>`
          : groups.map(g => `
              <div class="file-group">
                <div class="file-group-head">
                  <span>${g.title}</span>
                  <span class="muted" style="font-size:11px;">${g.sub}</span>
                </div>
                <div class="file-thumbs" data-mid="${g.measurement_id}">
                  ${g.photos.slice(0, 6).map((fn, i) => `
                    <a class="file-thumb" href="${BACKEND_URL}/api/photo/${g.measurement_id}/${fn}" target="_blank" rel="noopener">
                      <img src="${BACKEND_URL}/api/photo/${g.measurement_id}/${fn}" alt="">
                    </a>
                  `).join("")}
                  ${g.photos.length > 6 ? `<a class="file-thumb more" href="#/clients/measurement/${g.measurement_id}">+${g.photos.length - 6}</a>` : ""}
                </div>
              </div>
            `).join("")}
      </section>
    `);
    return section;
  }

  /* ===================== Детальные списки (свёрнутые) ===================== */

  function renderClientDetails(client, measurements) {
    const wrap = el(`<div class="client-details"></div>`);

    // Подборы
    if ((client.leads || []).length) {
      const detailsLeads = el(`
        <details class="client-details-collapse">
          <summary>Подборы · ${client.leads_count}</summary>
          <div class="leads-list"></div>
        </details>
      `);
      const list = detailsLeads.querySelector(".leads-list");
      for (const lead of client.leads) {
        const item = el(`
          <button class="lead-item">
            <div class="lead-date">${formatDate(lead.created_at)}</div>
            <div class="lead-id">#${(lead.id || "").slice(0, 8)}</div>
            <div class="lead-status status-${lead.status || "new"}">${statusLabel(lead.status)}</div>
            <div class="lead-arrow">${ICONS.chevron || "›"}</div>
          </button>
        `);
        item.addEventListener("click", () => {
          haptic && haptic("impact");
          location.hash = `#/clients/lead/${lead.id}`;
        });
        list.appendChild(item);
      }
      wrap.appendChild(detailsLeads);
    }

    // Замеры
    if (measurements.length) {
      const detailsMs = el(`
        <details class="client-details-collapse">
          <summary>Замеры · ${measurements.length}</summary>
          <div class="leads-list"></div>
        </details>
      `);
      const list = detailsMs.querySelector(".leads-list");
      for (const m of measurements) {
        const photoCount = m.photo_count || (m.photos || []).length;
        const photoBadge = photoCount ? ` · 📷 ${photoCount}` : "";
        const item = el(`
          <button class="lead-item">
            <div class="lead-date">${formatDate(m.created_at)}</div>
            <div class="lead-id">${escHtml(layoutLabel(m.layout) || (m.status || ""))}</div>
            <div class="lead-status">${m.area_m2 ? m.area_m2 + " м²" : "—"}${photoBadge}</div>
            <div class="lead-arrow">${ICONS.chevron || "›"}</div>
          </button>
        `);
        item.addEventListener("click", () => {
          haptic && haptic("impact");
          location.hash = `#/clients/measurement/${m.id}`;
        });
        list.appendChild(item);
      }
      wrap.appendChild(detailsMs);
    }

    return wrap;
  }

  function layoutLabel(key) {
    return ({
      linear: "Прямая",
      l_shape: "Угловая Г",
      u_shape: "П-образная",
      island: "С островом",
      peninsula: "Полуостров",
    }[key]) || (key || "—");
  }

  /* ===================== Детали лида (re-render отчёта) ===================== */

  async function renderLead(leadId) {
    root.innerHTML = "";
    root.appendChild(headerEl("Подбор", "back"));
    const loading = el(`<div class="loader-inline"><div class="spinner"></div></div>`);
    root.appendChild(loading);

    let lead;
    try {
      lead = await fetchLead(leadId);
    } catch (e) {
      loading.remove();
      root.appendChild(el(`<div class="error">${e.message}</div>`));
      return;
    }
    loading.remove();

    if (lead.error) {
      root.appendChild(el(`<div class="error">${lead.error}</div>`));
      return;
    }

    // Шапка
    root.appendChild(el(`
      <div class="lead-detail-head">
        <div class="kicker">Подбор #${(lead.id || "").slice(0, 8)}</div>
        <h2 class="display-title">${escHtml(lead.client_name || "Клиент")}</h2>
        <p class="lede">Сохранён ${formatDate(lead.created_at)}</p>
      </div>
    `));

    // Рендерим отчёт через Podbor.renderReport если ai-json есть
    if (lead.ai && typeof window.Podbor?.renderSavedReport === "function") {
      const reportNode = window.Podbor.renderSavedReport(lead.ai, lead.id);
      root.appendChild(reportNode);
    } else if (lead.ai_text) {
      // Fallback — AI вернул plain text
      root.appendChild(el(`
        <div class="block">
          <div class="block-head">AI ответ</div>
          <pre class="ai-text-fallback">${escHtml(lead.ai_text)}</pre>
        </div>
      `));
    } else {
      root.appendChild(el(`<div class="empty">Для этого лида нет AI-ответа.</div>`));
    }
  }

  /* ===================== Деталь замера ===================== */

  async function renderMeasurement(measurementId) {
    root.innerHTML = "";
    root.appendChild(headerEl("Замер", "back"));
    const loading = el(`<div class="loader-inline"><div class="spinner"></div></div>`);
    root.appendChild(loading);

    let m;
    try {
      m = await fetchMeasurementDetail(measurementId);
    } catch (e) {
      loading.remove();
      root.appendChild(el(`<div class="error">${e.message}</div>`));
      return;
    }
    loading.remove();

    if (m.error) {
      root.appendChild(el(`<div class="error">${m.error}</div>`));
      return;
    }

    const walls = m.walls || {};
    const wallsText = Object.entries(walls)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${k.replace("wall", "стена ")}: ${v} мм`)
      .join(" · ");

    const openings = m.openings || {};

    // Шапка + кнопка печати/PDF
    root.appendChild(el(`
      <div class="measurement-detail-head">
        <div class="kicker">Замер #${(m.id || "").slice(0, 8)}</div>
        <h2 class="display-title">${escHtml(layoutLabel(m.layout))}</h2>
        <div class="measurement-detail-meta">
          <span>📅 ${formatDate(m.created_at)}</span>
          ${m.area_m2 ? `<span>📐 ${escHtml(m.area_m2)} м²</span>` : ""}
          ${m.ceiling_mm ? `<span>📏 потолок ${escHtml(m.ceiling_mm)} мм</span>` : ""}
        </div>
      </div>
    `));

    const printBtn = el(`<button class="report-print-btn">🖨️ Скачать PDF / Печать</button>`);
    printBtn.addEventListener("click", () => window.print());
    root.appendChild(printBtn);

    // Основной блок
    const detail = el(`
      <div class="block summary-block">
        <div class="measurement-kv-grid">
          ${wallsText ? `<div class="k">Стены</div><div class="v">${escHtml(wallsText)}</div>` : ""}
          ${openings.window ? `<div class="k">Окно</div><div class="v">${escHtml(openings.window)}</div>` : ""}
          ${openings.door ? `<div class="k">Дверь</div><div class="v">${escHtml(openings.door)}</div>` : ""}
          ${m.notes ? `<div class="k">Заметки</div><div class="v">${escHtml(m.notes).replace(/\n/g, "<br>")}</div>` : ""}
        </div>
      </div>
    `);
    root.appendChild(detail);

    // Фото
    const photos = (m.photos || []).filter(Boolean);
    if (photos.length) {
      root.appendChild(el(`<div class="section-head" style="margin-top:18px;"><span class="label">Фото · ${photos.length}</span></div>`));
      const list = el(`<div class="photo-list"></div>`);
      for (const fn of photos) {
        const url = `${BACKEND_URL}/api/photo/${m.id}/${fn}`;
        const tile = el(`
          <a class="photo-tile static" href="${url}" target="_blank" rel="noopener">
            <img src="${url}" alt="">
          </a>
        `);
        list.appendChild(tile);
      }
      root.appendChild(list);
    }

    // Чертежи / DWG
    root.appendChild(renderDesignFilesBlock(m));
  }

  /* ===================== Чертежи / DWG ===================== */

  function renderDesignFilesBlock(measurement) {
    const section = el(`
      <section class="block design-upload">
        <div class="block-head">📐 Чертёж / DWG</div>
        <div class="design-files-list" id="designFilesList"></div>
        <label class="design-upload-label">Прикрепить файлы (DWG, DXF, PDF, изображение)</label>
        <input type="file" class="design-upload-input" id="designFilesInput"
               accept=".dwg,.dxf,.pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf,application/acad,image/vnd.dwg"
               multiple>
        <div class="design-upload-status" id="designUploadStatus"></div>
      </section>
    `);

    const list = section.querySelector("#designFilesList");
    const input = section.querySelector("#designFilesInput");
    const status = section.querySelector("#designUploadStatus");

    function refreshList(files) {
      list.innerHTML = "";
      const arr = (files || measurement.design_files || []).filter(Boolean);
      if (!arr.length) {
        list.innerHTML = `<div class="muted" style="font-size:12px;padding:4px 0;">Чертежей пока нет</div>`;
        return;
      }
      for (const fn of arr) {
        const url = `${BACKEND_URL}/api/photo/${measurement.id}/${fn}`;
        const ext = (fn.split(".").pop() || "").toLowerCase();
        const icon = (ext === "dwg" || ext === "dxf") ? "📐"
                   : (ext === "pdf") ? "📄"
                   : "🖼️";
        const item = el(`
          <a class="design-file-item" href="${url}" target="_blank" rel="noopener" download>
            <span class="design-file-icon">${icon}</span>
            <span class="design-file-name">${escHtml(fn)}</span>
            <span class="design-file-size">${ext.toUpperCase()}</span>
          </a>
        `);
        list.appendChild(item);
      }
    }
    refreshList();

    input.addEventListener("change", async (ev) => {
      const files = Array.from(ev.target.files || []);
      ev.target.value = "";
      if (!files.length) return;

      status.textContent = `Загружаем ${files.length} файл(а/ов)…`;
      try {
        // Читаем по одному в base64 data URL
        const payload = [];
        for (const f of files) {
          if (f.size > 30 * 1024 * 1024) {
            status.textContent = `Файл ${f.name} больше 30 МБ — пропустили`;
            continue;
          }
          const dataUrl = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onerror = reject;
            r.onload = () => resolve(r.result);
            r.readAsDataURL(f);
          });
          payload.push({ name: f.name, data_url: dataUrl });
          if (payload.length >= 10) break;
        }
        if (!payload.length) {
          status.textContent = "Нет подходящих файлов";
          return;
        }
        const res = await fetch(`${BACKEND_URL}/api/measurement_design_upload`, {
          method: "POST",
          body: JSON.stringify({
            initData: tg?.initData || "",
            initDataUnsafe: tg?.initDataUnsafe || null,
            measurement_id: measurement.id,
            files: payload,
          }),
        });
        const data = await res.json();
        if (data.error) {
          status.textContent = "Ошибка: " + data.error;
          return;
        }
        haptic && haptic("success");
        measurement.design_files = data.design_files || [];
        refreshList(measurement.design_files);
        status.textContent = `✓ загружено ${payload.length}`;
        setTimeout(() => { status.textContent = ""; }, 3000);
      } catch (e) {
        status.textContent = "Сеть: " + e.message;
      }
    });

    return section;
  }

  async function fetchMeasurementDetail(measurementId) {
    if (!BACKEND_URL) throw new Error("BACKEND_URL не задан");
    const res = await fetch(`${BACKEND_URL}/api/measurement_detail`, {
      method: "POST",
      body: JSON.stringify({ initData: tg?.initData || "", measurement_id: measurementId }),
    });
    return await res.json();
  }

  /* ===================== Примечание по клиенту ===================== */

  function renderClientNoteBlock(client) {
    const section = el(`
      <section class="block client-note-block">
        <div class="block-head">
          <span>📝 Примечания</span>
          <button class="note-edit-toggle" id="noteAddBtn" type="button">+ Добавить</button>
        </div>

        <!-- Форма добавления новой заметки (скрыта по умолчанию) -->
        <div class="note-editor" id="noteEditor" style="display:none;">
          <textarea id="noteText" rows="3" placeholder="Новая заметка — характер, договорённости, статус..."></textarea>
          <div class="note-actions">
            <button class="btn-mic" id="noteMic" type="button" title="Голосовой ввод">🎤 Диктовать</button>
            <button class="btn-secondary" id="noteCancel" type="button">Отмена</button>
            <button class="btn-primary" id="noteSave" type="button">Сохранить</button>
          </div>
          <div class="note-status" id="noteStatus"></div>
        </div>

        <!-- Лента примечаний -->
        <div class="note-history" id="noteHistory">
          <div class="note-loading">Загружаем...</div>
        </div>
      </section>
    `);

    const editor   = section.querySelector("#noteEditor");
    const history  = section.querySelector("#noteHistory");
    const textarea = section.querySelector("#noteText");
    const addBtn   = section.querySelector("#noteAddBtn");
    const status   = section.querySelector("#noteStatus");

    function renderFeed(notes) {
      history.innerHTML = "";
      if (!notes || !notes.length) {
        history.innerHTML = `<div class="note-empty">Примечаний пока нет</div>`;
        return;
      }
      notes.forEach(n => {
        const entry = el(`
          <div class="note-entry">
            <p class="note-text">${escHtml(n.note)}</p>
            ${n.updated_at ? `<span class="note-meta">${escHtml(formatDate(n.updated_at))}</span>` : ""}
          </div>
        `);
        history.appendChild(entry);
      });
    }

    function openEditor() {
      textarea.value = "";
      status.textContent = "";
      status.className = "note-status";
      editor.style.display = "";
      addBtn.textContent = "Свернуть";
      textarea.focus();
    }

    function closeEditor() {
      editor.style.display = "none";
      addBtn.textContent = "+ Добавить";
    }

    // Загружаем историю
    fetchClientNote(client)
      .then(data => renderFeed(data?.notes || []))
      .catch(() => renderFeed([]));

    addBtn.addEventListener("click", () => {
      if (editor.style.display === "none") openEditor(); else closeEditor();
    });

    section.querySelector("#noteCancel").addEventListener("click", closeEditor);

    section.querySelector("#noteSave").addEventListener("click", async () => {
      const txt = (textarea.value || "").trim();
      if (!txt) { status.textContent = "Напишите заметку"; return; }
      const btn = section.querySelector("#noteSave");
      btn.disabled = true; btn.textContent = "Сохраняем...";
      status.textContent = ""; status.className = "note-status";
      try {
        const data = await saveClientNote(client, txt);
        if (data?.ok) {
          haptic && haptic("success");
          closeEditor();
          renderFeed(data.notes || []);
        } else {
          status.textContent = "Ошибка: " + (data?.error || "не сохранилось");
          status.className = "note-status err";
          btn.disabled = false; btn.textContent = "Сохранить";
        }
      } catch (e) {
        status.textContent = "Сеть: " + e.message;
        status.className = "note-status err";
        btn.disabled = false; btn.textContent = "Сохранить";
      }
    });

    setupVoiceInput(section.querySelector("#noteMic"), textarea, status);
    return section;
  }

  async function fetchClientNote(client) {
    const res = await fetch(`${BACKEND_URL}/api/client_note`, {
      method: "POST",
      body: JSON.stringify({
        initData: tg?.initData || "",
        initDataUnsafe: tg?.initDataUnsafe || null,
        client_name: client.client_name || "",
        client_phone: client.client_phone || "",
      }),
    });
    return await res.json();
  }

  async function saveClientNote(client, note) {
    const res = await fetch(`${BACKEND_URL}/api/client_note`, {
      method: "POST",
      body: JSON.stringify({
        initData: tg?.initData || "",
        initDataUnsafe: tg?.initDataUnsafe || null,
        client_name: client.client_name || "",
        client_phone: client.client_phone || "",
        note: note || "",
      }),
    });
    return await res.json();
  }

  function setupVoiceInput(micBtn, textarea, status) {
    _buildVoiceEngine(micBtn, textarea, {
      statusEl:    status,
      statusClass: "note-status",
    });
  }

  /* ===================== Helpers ===================== */

  function headerEl(title, backHref) {
    const h = el(`
      <header class="podbor-header">
        <button class="podbor-back" aria-label="Назад">${ICONS.arrow_left || "‹"}</button>
        <div class="podbor-title">${escHtml(title)}</div>
        <div style="width:28px"></div>
      </header>
    `);
    h.querySelector(".podbor-back").addEventListener("click", () => {
      if (backHref === "back") {
        history.back();
      } else if (backHref) {
        location.hash = backHref;
      } else {
        location.hash = "";
        location.reload();
      }
    });
    return h;
  }

  async function fetchClients() {
    if (!BACKEND_URL) throw new Error("BACKEND_URL не задан");
    const res = await fetch(`${BACKEND_URL}/api/clients`, {
      method: "POST",
      body: JSON.stringify({ initData: tg?.initData || "" }),
    });
    return await res.json();
  }

  async function fetchLead(leadId) {
    if (!BACKEND_URL) throw new Error("BACKEND_URL не задан");
    const res = await fetch(`${BACKEND_URL}/api/lead`, {
      method: "POST",
      body: JSON.stringify({ initData: tg?.initData || "", lead_id: leadId }),
    });
    return await res.json();
  }

  async function fetchMeasurements(filters = {}) {
    if (!BACKEND_URL) throw new Error("BACKEND_URL не задан");
    const res = await fetch(`${BACKEND_URL}/api/measurements`, {
      method: "POST",
      body: JSON.stringify({ initData: tg?.initData || "", ...filters }),
    });
    return await res.json();
  }

  function initial(name) {
    return ((name || "?").trim()[0] || "?").toUpperCase();
  }

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      if (sameDay) return `сегодня · ${hh}:${mi}`;
      return `${dd}.${mm}.${yy}`;
    } catch (e) {
      return iso.slice(0, 10);
    }
  }

  function pluralize(n, one, few, many) {
    const last = n % 10, lastTwo = n % 100;
    if (lastTwo >= 11 && lastTwo <= 14) return many;
    if (last === 1) return one;
    if (last >= 2 && last <= 4) return few;
    return many;
  }

  function countLeads(clients) {
    return clients.reduce((s, c) => s + (c.leads_count || 0), 0);
  }

  function statusLabel(s) {
    const map = {
      "new": "Новый",
      "sent": "Отправлен",
      "viewed": "Просмотрен",
      "ordered": "Оформлен",
    };
    return map[s] || s || "—";
  }

  return { mount };
})();
