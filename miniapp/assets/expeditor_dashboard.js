/* ============================================================
   ExpeditorDashboard  #/expeditor
   Act4Screen           #/expeditor/act/:assemblyId
   Signature modes: telegram_otp | canvas
   ============================================================ */
const ExpeditorDashboard = (function () {
  "use strict";

  const ROOM_PRESETS = [
    { group: "Жилые",     items: ["Гостиная","Спальня","Детская","Кабинет"] },
    { group: "Кухня",     items: ["Кухня","Кухня-гостиная","Столовая"] },
    { group: "Санузел",   items: ["Ванная","Санузел","Совмещённый"] },
    { group: "Хранение",  items: ["Прихожая","Коридор","Кладовая","Гардероб"] },
    { group: "Другое",    items: ["Балкон","Лоджия","Терраса","Доп. помещение"] },
  ];

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }
  function fmtDate(s) {
    if (!s) return "";
    const d = new Date(s);
    return isNaN(d) ? s : d.toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric"});
  }
  async function _api(path, body) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(BACKEND_URL + "/api/" + path, {
        method: "POST", signal: ctrl.signal,
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(Object.assign({
          initData: (typeof Platform !== "undefined" ? Platform.initData : ""),
          initDataUnsafe: (typeof Platform !== "undefined" ? Platform.initDataUnsafe : null),
        }, body)),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch(e) { if (e.name === "AbortError") throw new Error("Таймаут"); throw e; }
    finally { clearTimeout(t); }
  }

  // ── MAIN LIST ────────────────────────────────────────────────────────────
  async function mount(container) {
    container.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    const nav = document.getElementById("bottom-nav"); if (nav) nav.remove();
    const icons = window.ICONS || {};
    const header = el(
      "<header class=\"podbor-header\">" +
      "<button class=\"podbor-back\">" + (icons.arrow_left || "‹") + "</button>" +
      "<div class=\"podbor-title\">Маршруты и акты</div>" +
      "<div style=\"width:28px\"></div></header>"
    );
    header.querySelector(".podbor-back").addEventListener("click", () => {
      if (typeof haptic !== "undefined") haptic("impact");
      history.back();
    });
    const screen = el("<div class=\"podbor-screen\"></div>");
    container.appendChild(header);
    container.appendChild(screen);
    screen.innerHTML = "<div class=\"loader-inline\"><div class=\"spinner\"></div></div>";
    try {
      const data = await _api("expeditor_inbox", {});
      if (data.error) throw new Error(data.error);
      _renderList(screen, data.assemblies || []);
    } catch(e) {
      screen.innerHTML = "<div class=\"error\" style=\"margin:16px;\">Ошибка: " + escHtml(e.message) + "</div>";
    }
  }


  function _groupByDate(items) {
    var today = new Date(); today.setHours(0,0,0,0);
    var tom = new Date(today); tom.setDate(tom.getDate()+1);
    var groups = {}, order = [];
    items.forEach(function(a) {
      var d = a.scheduled_at ? new Date(a.scheduled_at) : null;
      var label;
      if (!d || isNaN(d)) {
        label = "Без даты";
      } else {
        var day = new Date(d); day.setHours(0,0,0,0);
        if (day.getTime() === today.getTime())     label = "Сегодня";
        else if (day.getTime() === tom.getTime())  label = "Завтра";
        else label = day.toLocaleDateString("ru-RU",{day:"2-digit",month:"long",weekday:"short"});
      }
      if (!groups[label]) { groups[label] = []; order.push(label); }
      groups[label].push(a);
    });
    return {groups: groups, order: order};
  }

  function _renderList(screen, items) {
    screen.innerHTML = "";
    if (!items.length) {
      screen.innerHTML =
        "<div style=\"text-align:center;padding:48px 20px;color:var(--muted);\">" +
        "<div style=\"font-size:40px;margin-bottom:12px;\">🚚</div>" +
        "<div style=\"font-weight:600;\">Маршрутов нет</div>" +
        "<div style=\"font-size:13px;margin-top:6px;\">Менеджер назначит вас на доставку</div></div>";
      return;
    }
    const pending = items.filter(a => !a.is_signed);
    const done    = items.filter(a => a.is_signed);
    if (pending.length) {
      screen.appendChild(el("<div style=\"padding:12px 16px 4px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;\">К приёмке (" + pending.length + ")</div>"));
      var gd = _groupByDate(pending);
      gd.order.forEach(function(label) {
        screen.appendChild(el('<div style="padding:6px 16px 4px;font-size:12px;font-weight:600;color:var(--accent);">📅 ' + label + '</div>'));
        gd.groups[label].forEach(function(a) { screen.appendChild(_card(a, false)); });
      });
    }
    if (done.length) {
      screen.appendChild(el("<div style=\"padding:16px 16px 4px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;\">Подписано (" + done.length + ")</div>"));
      done.forEach(a => screen.appendChild(_card(a, true)));
    }
  }

  function _card(a, signed) {
    const badge = signed
      ? "<span style=\"font-size:11px;padding:2px 8px;background:#e8f5e9;color:#2e7d32;border-radius:20px;font-weight:600;\">✅ Подписан</span>"
      : "<span style=\"font-size:11px;padding:2px 8px;background:#fff3e0;color:#e65100;border-radius:20px;font-weight:600;\">⏳ Ожидает</span>";
    const card = el(
      "<div style=\"margin:0 16px 10px;padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:14px;cursor:pointer;\">" +
      "<div style=\"display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;\">" +
      "<div style=\"font-size:14px;font-weight:700;\">" + escHtml(a.client_name || "—") + "</div>" +
      badge + "</div>" +
      "<div style=\"font-size:12px;color:var(--muted);margin-bottom:4px;\">📍 " + escHtml(a.address || "адрес не указан") + "</div>" +
      (a.scheduled_at ? "<div style=\"font-size:11px;color:var(--muted);\">📅 " + fmtDate(a.scheduled_at) + "</div>" : "") +
      (signed && a.signed_at ? "<div style=\"font-size:11px;color:#2e7d32;margin-top:4px;\">Подписан " + fmtDate(a.signed_at) + "</div>" : "") +
      "</div>"
    );
    card.addEventListener("click", () => {
      if (typeof haptic !== "undefined") haptic("selection");
      location.hash = "#/expeditor/act/" + a.id;
    });
    return card;
  }

  // ── ACT4 SCREEN ──────────────────────────────────────────────────────────
  async function mountAct(container, assemblyId) {
    container.innerHTML = "";
    document.body.classList.remove("has-bottom-nav");
    const nav = document.getElementById("bottom-nav"); if (nav) nav.remove();
    const icons = window.ICONS || {};
    const header = el(
      "<header class=\"podbor-header\">" +
      "<button class=\"podbor-back\">" + (icons.arrow_left || "‹") + "</button>" +
      "<div class=\"podbor-title\">Акт приёмки</div>" +
      "<div style=\"width:28px\"></div></header>"
    );
    header.querySelector(".podbor-back").addEventListener("click", () => {
      if (typeof haptic !== "undefined") haptic("impact");
      history.back();
    });
    const screen = el("<div class=\"podbor-screen\"></div>");
    container.appendChild(header);
    container.appendChild(screen);
    screen.innerHTML = "<div class=\"loader-inline\"><div class=\"spinner\"></div></div>";
    try {
      const data = await _api("act4_preview", {assembly_id: assemblyId});
      if (data.error) throw new Error(data.error);
      _renderAct(screen, data, assemblyId);
    } catch(e) {
      screen.innerHTML = "<div class=\"error\" style=\"margin:16px;\">Ошибка: " + escHtml(e.message) + "</div>";
    }
  }

  function _renderAct(screen, act, assemblyId) {
    screen.innerHTML = "";
    // Client info
    screen.appendChild(el(
      "<div style=\"margin:12px 16px;padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:12px;\">" +
      "<div style=\"font-size:14px;font-weight:700;margin-bottom:4px;\">" + escHtml(act.client_name || "—") + "</div>" +
      "<div style=\"font-size:12px;color:var(--muted);\">📍 " + escHtml(act.address || "—") + "</div>" +
      (act.client_phone ? "<div style=\"font-size:12px;color:var(--muted);margin-top:2px;\">📞 " + escHtml(act.client_phone) + "</div>" : "") +
      "<div style=\"font-size:11px;color:var(--muted);margin-top:6px;\">Акт № " + escHtml(act.act_num) + " · " + escHtml(act.act_date) + "</div>" +
      "</div>"
    ));
    // Already signed banner
    if (act.is_signed) {
      screen.appendChild(el(
        "<div style=\"margin:0 16px 12px;padding:12px 14px;background:#e8f5e9;border:1px solid #a5d6a7;border-radius:12px;\">" +
        "<div style=\"font-size:13px;font-weight:700;color:#2e7d32;margin-bottom:2px;\">✅ Акт подписан</div>" +
        "<div style=\"font-size:12px;color:#388e3c;\">" + escHtml(act.signed_by_name) + " · " + fmtDate(act.signed_at) + " · " + escHtml(act.signed_via || "") + "</div>" +
        "</div>"
      ));
    }
    // Items list (existing)
    const itemsList = act.items || [];
    const itemsWrap = el("<div style=\"margin:0 16px 10px;\"></div>");
    if (itemsList.length) {
      itemsList.forEach(item => itemsWrap.appendChild(_itemCard(item)));
    }
    screen.appendChild(itemsWrap);
    // If not signed — show signature section
    if (!act.is_signed) {
      _renderSignatureSection(screen, assemblyId);
    }
  }

  function _itemCard(item) {
    const cond = item.condition === "damaged"
      ? "<span style=\"color:#e53935;font-weight:600;\">⚠ Повреждение</span>"
      : "<span style=\"color:#43a047;\">✓ OK</span>";
    return el(
      "<div style=\"display:flex;justify-content:space-between;align-items:center;padding:10px 12px;margin-bottom:6px;background:var(--surface);border:1px solid var(--border);border-radius:10px;\">" +
      "<div><div style=\"font-size:13px;font-weight:600;\">" + escHtml(item.name || "Позиция") + "</div>" +
      "<div style=\"font-size:11px;color:var(--muted);\">Кол-во: " + escHtml(String(item.qty || 1)) + "</div></div>" +
      "<div>" + cond + "</div></div>"
    );
  }

  // ── SIGNATURE SECTION ────────────────────────────────────────────────────
  function _renderSignatureSection(screen, assemblyId) {
    const wrap = el("<div style=\"margin:0 16px 24px;\"></div>");
    screen.appendChild(wrap);
    const tabs = el(
      "<div style=\"display:flex;gap:8px;margin-bottom:14px;\">" +
      "<button data-tab=\"otp\" class=\"sig-tab sig-active\" style=\"flex:1;padding:10px;border-radius:10px;border:1.5px solid var(--accent);background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;\">📱 Код в Telegram</button>" +
      "<button data-tab=\"canvas\" class=\"sig-tab\" style=\"flex:1;padding:10px;border-radius:10px;border:1.5px solid var(--border);background:none;color:var(--ink);font-size:13px;font-weight:600;cursor:pointer;\">✍️ Подпись рукой</button>" +
      "</div>"
    );
    const otpPanel  = el("<div class=\"sig-panel\" data-panel=\"otp\"></div>");
    const canvasPanel = el("<div class=\"sig-panel\" data-panel=\"canvas\" style=\"display:none;\"></div>");
    _buildOtpPanel(otpPanel, assemblyId, wrap);
    _buildCanvasPanel(canvasPanel, assemblyId, wrap);
    tabs.querySelectorAll(".sig-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        const tgt = btn.dataset.tab;
        tabs.querySelectorAll(".sig-tab").forEach(b => {
          const active = b.dataset.tab === tgt;
          b.style.background = active ? "var(--accent)" : "none";
          b.style.color = active ? "#fff" : "var(--ink)";
          b.style.borderColor = active ? "var(--accent)" : "var(--border)";
        });
        [otpPanel, canvasPanel].forEach(p => {
          p.style.display = p.dataset.panel === tgt ? "" : "none";
        });
      });
    });
    wrap.appendChild(tabs);
    wrap.appendChild(otpPanel);
    wrap.appendChild(canvasPanel);
  }

  function _buildOtpPanel(panel, assemblyId, wrap) {
    panel.innerHTML = "";
    panel.appendChild(el(
      "<div style=\"font-size:12px;color:var(--muted);margin-bottom:10px;\">Бот пришлёт 6-значный код в этот чат. Введите его для подписи.</div>"
    ));
    const nameField = el(
      "<div style=\"margin-bottom:10px;\"><label style=\"font-size:12px;color:var(--muted);display:block;margin-bottom:4px;\">Подписант (ФИО или должность)</label>" +
      "<input id=\"otpName\" type=\"text\" placeholder=\"Иванов И.И.\" style=\"width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:14px;background:var(--surface);\"></div>"
    );
    panel.appendChild(nameField);
    const sendBtn = el(
      "<button id=\"sendOtpBtn\" style=\"width:100%;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:12px;\">Получить код</button>"
    );
    const codeSection = el("<div id=\"codeSection\" style=\"display:none;\"></div>");
    const codeField = el(
      "<div><label style=\"font-size:12px;color:var(--muted);display:block;margin-bottom:4px;\">Введите код из Telegram</label>" +
      "<input id=\"otpInput\" type=\"number\" inputmode=\"numeric\" maxlength=\"6\" placeholder=\"123456\" style=\"width:100%;box-sizing:border-box;padding:12px;border:1.5px solid var(--accent);border-radius:8px;font-size:20px;letter-spacing:6px;text-align:center;background:var(--surface);\"></div>"
    );
    const verifyBtn = el(
      "<button id=\"verifyOtpBtn\" style=\"width:100%;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;margin-top:10px;\">Подтвердить</button>"
    );
    const errEl = el("<div id=\"otpErr\" style=\"color:#e53935;font-size:12px;margin-top:6px;\"></div>");
    codeSection.appendChild(codeField);
    codeSection.appendChild(verifyBtn);
    codeSection.appendChild(errEl);
    panel.appendChild(sendBtn);
    panel.appendChild(codeSection);

    sendBtn.addEventListener("click", async () => {
      sendBtn.disabled = true; sendBtn.textContent = "Отправляем…";
      try {
        const data = await _api("act4_request_otp", {assembly_id: assemblyId});
        if (data.error) { sendBtn.textContent = "Ошибка: " + data.error; sendBtn.disabled = false; return; }
        sendBtn.textContent = "✅ Код отправлен — проверьте Telegram";
        codeSection.style.display = "";
        panel.querySelector("#otpInput").focus();
      } catch(e) { sendBtn.textContent = "Ошибка: " + e.message; sendBtn.disabled = false; }
    });

    verifyBtn.addEventListener("click", async () => {
      const code = panel.querySelector("#otpInput").value.trim();
      const name = panel.querySelector("#otpName").value.trim();
      errEl.textContent = "";
      if (code.length < 6) { errEl.textContent = "Введите 6-значный код"; return; }
      verifyBtn.disabled = true; verifyBtn.textContent = "Проверяем…";
      try {
        const data = await _api("act4_verify_otp", {assembly_id: assemblyId, code, signed_by_name: name});
        if (data.error) {
          const msgs = {invalid_code:"Неверный код",code_expired:"Код устарел, запросите новый",act_not_found:"Акт не найден"};
          errEl.textContent = msgs[data.error] || data.error;
          verifyBtn.disabled = false; verifyBtn.textContent = "Подтвердить"; return;
        }
        if (typeof haptic !== "undefined") haptic("success");
        wrap.innerHTML = "<div style=\"padding:16px;background:#e8f5e9;border:2px solid #43a047;border-radius:14px;text-align:center;\"><div style=\"font-size:22px;margin-bottom:8px;\">✅</div><div style=\"font-weight:700;color:#2e7d32;font-size:15px;\">Акт подписан</div><div style=\"font-size:12px;color:#388e3c;margin-top:4px;\">" + escHtml(data.signed_by_name) + "</div></div>";
      } catch(e) { errEl.textContent = e.message; verifyBtn.disabled = false; verifyBtn.textContent = "Подтвердить"; }
    });
  }

  function _buildCanvasPanel(panel, assemblyId, wrap) {
    panel.innerHTML = "";
    panel.appendChild(el("<div style=\"font-size:12px;color:var(--muted);margin-bottom:10px;\">Нарисуйте подпись пальцем на экране.</div>"));
    const nameField = el(
      "<div style=\"margin-bottom:10px;\"><label style=\"font-size:12px;color:var(--muted);display:block;margin-bottom:4px;\">Подписант (ФИО или должность)</label>" +
      "<input id=\"canvasName\" type=\"text\" placeholder=\"Иванов И.И.\" style=\"width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:14px;background:var(--surface);\"></div>"
    );
    panel.appendChild(nameField);
    const canvasWrap = el(
      "<div style=\"border:1.5px solid var(--border);border-radius:10px;overflow:hidden;background:#fafafa;margin-bottom:10px;position:relative;\">" +
      "<canvas id=\"sigCanvas\" style=\"width:100%;height:140px;display:block;touch-action:none;\"></canvas>" +
      "<button id=\"clearCanvas\" style=\"position:absolute;top:6px;right:8px;font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;\">Очистить</button>" +
      "</div>"
    );
    panel.appendChild(canvasWrap);
    const saveBtn = el(
      "<button id=\"saveCanvasBtn\" style=\"width:100%;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;\">Подписать</button>"
    );
    const errEl = el("<div id=\"canvasErr\" style=\"color:#e53935;font-size:12px;margin-top:6px;\"></div>");
    panel.appendChild(saveBtn);
    panel.appendChild(errEl);

    // Init canvas after DOM insertion (needs layout)
    requestAnimationFrame(() => {
      const canvas = panel.querySelector("#sigCanvas");
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width  = rect.width  * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1a1a1a";
      let drawing = false, lastX = 0, lastY = 0, hasStrokes = false;

      function pos(e) {
        const r = canvas.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return [src.clientX - r.left, src.clientY - r.top];
      }
      canvas.addEventListener("pointerdown", e => {
        drawing = true; [lastX, lastY] = pos(e);
        ctx.beginPath(); ctx.moveTo(lastX, lastY);
        e.preventDefault();
      });
      canvas.addEventListener("pointermove", e => {
        if (!drawing) return;
        const [x, y] = pos(e);
        ctx.lineTo(x, y); ctx.stroke();
        lastX = x; lastY = y; hasStrokes = true;
        e.preventDefault();
      });
      canvas.addEventListener("pointerup",   () => { drawing = false; });
      canvas.addEventListener("pointerleave",() => { drawing = false; });

      panel.querySelector("#clearCanvas").addEventListener("click", () => {
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        hasStrokes = false;
      });

      saveBtn.addEventListener("click", async () => {
        if (!hasStrokes) { errEl.textContent = "Нарисуйте подпись"; return; }
        const name = panel.querySelector("#canvasName").value.trim();
        const b64 = canvas.toDataURL("image/png").replace("data:image/png;base64,", "");
        saveBtn.disabled = true; saveBtn.textContent = "Сохраняем…"; errEl.textContent = "";
        try {
          const data = await _api("act4_save_signature", {assembly_id: assemblyId, signature_b64: b64, signed_by_name: name});
          if (data.error) throw new Error(data.error);
          if (typeof haptic !== "undefined") haptic("success");
          wrap.innerHTML = "<div style=\"padding:16px;background:#e8f5e9;border:2px solid #43a047;border-radius:14px;text-align:center;\"><div style=\"font-size:22px;margin-bottom:8px;\">✅</div><div style=\"font-weight:700;color:#2e7d32;font-size:15px;\">Акт подписан</div><div style=\"font-size:12px;color:#388e3c;margin-top:4px;\">" + escHtml(data.signed_by_name) + "</div></div>";
        } catch(e) { errEl.textContent = e.message; saveBtn.disabled = false; saveBtn.textContent = "Подписать"; }
      });
    });
  }

  return { mount, mountAct };
})();
