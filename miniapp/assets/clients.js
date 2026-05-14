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
          <label class="field">
            <span class="field-label">Адрес</span>
            <input type="text" id="ad" placeholder="СПб, Просвещения 87, кв. 12">
            <span class="field-hint" id="addrHint">Укажите город, улицу, дом, кв.</span>
            <span class="field-error" id="errAddr"></span>
          </label>
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
      const name = (form.querySelector("#fn").value || "").trim();
      const phoneRaw = (form.querySelector("#ph").value || "").trim();
      const address = (form.querySelector("#ad").value || "").trim();
      const note = (form.querySelector("#nt").value || "").trim();
      const contract_no = (form.querySelector("#cn").value || "").trim();
      const contract_date = (form.querySelector("#cd").value || "").trim();

      // Валидация на клиенте
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
      if (address && address.length < 5) {
        form.querySelector("#errAddr").textContent = "Адрес слишком короткий — нужны улица + дом";
        return;
      }

      btn.disabled = true;
      btn.textContent = "Сохраняем...";
      try {
        const res = await fetch(`${BACKEND_URL}/api/client_create`, {
          method: "POST",
          body: JSON.stringify({
            initData: tg?.initData || "",
            initDataUnsafe: tg?.initDataUnsafe || null,
            full_name: name, phone: norm.value, address, note,
            contract_no, contract_date,
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

  function setupVoiceMicForField(micBtn, textarea, statusEl) {
    if (!micBtn || !textarea) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      micBtn.disabled = true;
      micBtn.title = "Браузер не поддерживает голос";
      micBtn.style.opacity = "0.5";
      if (statusEl) statusEl.textContent = "недоступно";
      return;
    }
    let rec = null, recording = false;
    let baseText = "";        // текст до начала записи
    let confirmedFinal = "";  // финальные части накопленные в этой сессии записи

    micBtn.addEventListener("click", () => {
      if (recording) { rec?.stop(); return; }
      try {
        rec = new SR();
        rec.lang = "ru-RU"; rec.continuous = true; rec.interimResults = true;
      } catch (e) {
        if (statusEl) statusEl.textContent = "Микрофон недоступен";
        return;
      }
      baseText = (textarea.value || "").trim();
      confirmedFinal = "";

      rec.onstart = () => {
        recording = true;
        micBtn.classList.add("rec");
        micBtn.textContent = "⏹ Стоп";
        if (statusEl) statusEl.textContent = "Слушаю...";
        haptic && haptic("impact");
      };
      rec.onresult = (ev) => {
        // Пересчитываем ВСЕ финальные и interim с нуля каждый раз — гарантия от дублей
        let finalAll = "";
        let interim = "";
        for (let i = 0; i < ev.results.length; i++) {
          const t = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) finalAll += t;
          else interim += t;
        }
        confirmedFinal = finalAll.trim();
        const finalPart = confirmedFinal ? (baseText ? " " : "") + confirmedFinal : "";
        const interimPart = interim.trim() ? ((baseText || confirmedFinal) ? " " : "") + interim.trim() : "";
        textarea.value = baseText + finalPart + interimPart;
      };
      rec.onerror = (ev) => {
        if (statusEl) statusEl.textContent = "Ошибка: " + (ev.error || "");
        recording = false;
        micBtn.classList.remove("rec");
        micBtn.textContent = "🎤 Диктовать";
      };
      rec.onend = () => {
        recording = false;
        micBtn.classList.remove("rec");
        micBtn.textContent = "🎤 Диктовать";
        // Фиксируем итоговый текст: baseText + final
        if (confirmedFinal) {
          baseText = (baseText + (baseText ? " " : "") + confirmedFinal).trim();
          textarea.value = baseText;
        }
        if (statusEl && statusEl.textContent === "Слушаю...") statusEl.textContent = "";
        haptic && haptic("impact");
      };
      try { rec.start(); } catch (e) {
        if (statusEl) statusEl.textContent = "Не запустить: " + e.message;
      }
    });
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
      ? `<div class="client-detail-meta">📋 договор ${escHtml(client.contract_no)}</div>`
      : "";
    root.appendChild(el(`
      <div class="client-detail-head">
        <div class="client-avatar lg">${initial(client.client_name)}</div>
        <div style="flex:1;min-width:0;">
          <h2 class="client-detail-name">${escHtml(client.client_name)} ${noTag}</h2>
          ${client.client_phone ? `<div class="client-detail-phone">${escHtml(client.client_phone)}</div>` : ""}
          ${contractTag}
        </div>
        ${callHref ? `<a class="client-call-btn" href="${callHref}" aria-label="Позвонить">📞</a>` : ""}
      </div>
    `));

    // Быстрые действия для менеджера
    const actionsRow = el(`
      <div class="client-quick-actions">
        <button class="qa-btn" data-act="podbor">🤖<span>Подбор техники</span></button>
        <button class="qa-btn" data-act="measure">📐<span>Заказать замер</span></button>
        <button class="qa-btn" data-act="assembly">🔨<span>Заказать сборку</span></button>
        <button class="qa-btn" data-act="copy">📋<span>Копировать ФИО+тел</span></button>
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

    // Опасная зона — удалить клиента (soft-delete всех его записей)
    const deleteZone = el(`
      <details class="danger-zone" style="margin-top:24px;">
        <summary>⚠️ Опасная зона</summary>
        <div style="padding:12px 4px;">
          <p style="font-size:13px;color:var(--muted);margin:0 0 12px;">
            При удалении клиент будет архивирован вместе со всеми его заявками,
            замерами и подборами. Из списка он исчезнет.
          </p>
          <button class="btn-danger" id="deleteClient" type="button">🗑 Удалить клиента</button>
          <div id="deleteResult" style="margin-top:8px;font-size:12px;"></div>
        </div>
      </details>
    `);
    deleteZone.querySelector("#deleteClient").addEventListener("click", async () => {
      const confirmed = await confirmDialog(`Удалить клиента ${client.client_name}? Это нельзя отменить из бота.`);
      if (!confirmed) return;
      const btn = deleteZone.querySelector("#deleteClient");
      const result = deleteZone.querySelector("#deleteResult");
      btn.disabled = true; btn.textContent = "Удаляем...";
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
          result.innerHTML = `<span style="color:#C0392B;">Ошибка: ${escHtml(data.error)}</span>`;
          btn.disabled = false; btn.textContent = "🗑 Удалить клиента";
          return;
        }
        haptic && haptic("success");
        clientsCache = null;
        result.innerHTML = `<span style="color:#27AE60;">Архивировано ${data.archived} записей. Возвращаемся в список...</span>`;
        setTimeout(() => { location.hash = "#/clients"; window.location.reload(); }, 1200);
      } catch (e) {
        result.innerHTML = `<span style="color:#C0392B;">Сеть: ${escHtml(e.message)}</span>`;
        btn.disabled = false; btn.textContent = "🗑 Удалить клиента";
      }
    });
    root.appendChild(deleteZone);
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
      <section class="block client-timeline-block">
        <div class="block-head">🕒 Хронология · ${events.length}</div>
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
      </section>
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
          <span>📝 Примечание</span>
          <span class="note-meta" id="noteMeta"></span>
        </div>
        <div class="note-editor">
          <textarea id="noteText" rows="3" placeholder="Заметки по клиенту — характер, предпочтения, договорённости, статус..."></textarea>
          <div class="note-actions">
            <button class="btn-mic" id="noteMic" type="button" title="Голосовой ввод">🎤 Диктовать</button>
            <button class="btn-secondary" id="noteSave" type="button">Сохранить</button>
          </div>
          <div class="note-status" id="noteStatus"></div>
        </div>
      </section>
    `);

    const textarea = section.querySelector("#noteText");
    const meta = section.querySelector("#noteMeta");
    const status = section.querySelector("#noteStatus");

    // Загружаем сохранённую заметку
    fetchClientNote(client).then(data => {
      if (data?.note) textarea.value = data.note;
      if (data?.updated_at) {
        meta.textContent = "обновлено " + formatDate(data.updated_at);
      }
    }).catch(() => {});

    // Сохранение
    section.querySelector("#noteSave").addEventListener("click", async () => {
      const btn = section.querySelector("#noteSave");
      btn.disabled = true;
      btn.textContent = "Сохраняем...";
      try {
        const data = await saveClientNote(client, textarea.value);
        if (data?.ok) {
          status.textContent = "✓ сохранено";
          status.className = "note-status ok";
          if (data.updated_at) meta.textContent = "обновлено " + formatDate(data.updated_at);
          setTimeout(() => { status.textContent = ""; }, 2500);
        } else {
          status.textContent = "Ошибка: " + (data?.error || "не сохранилось");
          status.className = "note-status err";
        }
      } catch (e) {
        status.textContent = "Сеть: " + e.message;
        status.className = "note-status err";
      }
      btn.disabled = false;
      btn.textContent = "Сохранить";
    });

    // Голосовой ввод через Web Speech API
    const micBtn = section.querySelector("#noteMic");
    setupVoiceInput(micBtn, textarea, status);

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
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      micBtn.disabled = true;
      micBtn.title = "Браузер не поддерживает голосовой ввод";
      micBtn.style.opacity = "0.5";
      return;
    }
    let rec = null;
    let recording = false;
    let baseText = ""; // текст до начала записи — чтобы не перетирать

    micBtn.addEventListener("click", () => {
      if (recording) {
        rec?.stop();
        return;
      }
      try {
        rec = new SR();
        rec.lang = "ru-RU";
        rec.continuous = true;
        rec.interimResults = true;
      } catch (e) {
        status.textContent = "Микрофон недоступен: " + e.message;
        status.className = "note-status err";
        return;
      }
      baseText = (textarea.value || "").trim();
      const sep = baseText ? "\n" : "";

      rec.onstart = () => {
        recording = true;
        micBtn.classList.add("rec");
        micBtn.textContent = "⏹ Стоп";
        status.textContent = "Слушаю...";
        status.className = "note-status";
        haptic && haptic("impact");
      };
      rec.onresult = (ev) => {
        let interim = "";
        let final = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const t = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) final += t;
          else interim += t;
        }
        if (final) {
          baseText = (baseText + sep + final).trim();
          textarea.value = baseText;
        } else if (interim) {
          textarea.value = baseText + sep + interim;
        }
      };
      rec.onerror = (ev) => {
        status.textContent = "Ошибка распознавания: " + (ev.error || "неизвестно");
        status.className = "note-status err";
        recording = false;
        micBtn.classList.remove("rec");
        micBtn.textContent = "🎤 Диктовать";
      };
      rec.onend = () => {
        recording = false;
        micBtn.classList.remove("rec");
        micBtn.textContent = "🎤 Диктовать";
        if (status.textContent === "Слушаю...") status.textContent = "";
        haptic && haptic("impact");
      };
      try { rec.start(); }
      catch (e) {
        status.textContent = "Не запустить: " + e.message;
        status.className = "note-status err";
      }
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
