/**
 * ЗОВ — Backend (Google Apps Script Web App)
 *
 * Точки входа:
 *   POST {WEBAPP_URL}?path=me           → handleMe
 *   POST {WEBAPP_URL}?path=measurement  → handleMeasurement
 *   POST {WEBAPP_URL}?path=podbor       → handlePodbor
 *   GET  {WEBAPP_URL}                   → ping (health check)
 *
 * Тело POST: JSON { initData: "tg-init-data", ...payload }
 *
 * Script Properties (Project Settings → Script Properties):
 *   BOT_TOKEN          — токен Telegram-бота (для проверки initData и отправки уведомлений)
 *   ANTHROPIC_API_KEY  — ключ Claude API
 *   ANTHROPIC_MODEL    — опционально, модель (default: claude-haiku-4-5-20251001)
 *   ADMIN_TG_ID        — tg_id куратора, кому слать алерты об ошибках
 */

// =================================================================
// 1. Entry & routing
// =================================================================

function doPost(e) {
  try {
    const path = (e.parameter && e.parameter.path) || "";
    const body = e.postData && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : {};

    let result;
    switch (path) {
      case "me":            result = handleMe(body); break;
      case "measurement":   result = handleMeasurement(body); break;
      case "podbor":        result = handlePodbor(body); break;
      case "ping":          result = { pong: true, time: new Date().toISOString() }; break;
      // Сервисные эндпоинты для разовых тестов (без авторизации, на этапе разработки)
      case "seed_admin":    result = seedAdminAsManager(); break;
      case "test_claude":   result = testClaude(); break;
      case "test_telegram": result = testTelegram(); break;
      default:
        return jsonResponse({ error: "unknown_path", path });
    }
    return jsonResponse(result);
  } catch (err) {
    log("api_error", null, { path: e.parameter && e.parameter.path, error: String(err), stack: err.stack });
    return jsonResponse({ error: String(err) });
  }
}

function doGet(e) {
  // Для удобного тестирования через GET-запросы из браузера
  const path = (e && e.parameter && e.parameter.path) || "";
  try {
    switch (path) {
      case "ping":          return jsonResponse({ pong: true, time: new Date().toISOString() });
      case "seed_admin":    return jsonResponse(seedAdminAsManager());
      case "test_claude":   return jsonResponse(testClaude());
      case "test_telegram": return jsonResponse(testTelegram());
      default:
        return jsonResponse({ status: "ok", service: "zov-tech-backend", time: new Date().toISOString(),
          available_paths: ["ping", "seed_admin", "test_claude", "test_telegram"] });
    }
  } catch (err) {
    return jsonResponse({ error: String(err), stack: err.stack });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// =================================================================
// 2. Auth — Telegram WebApp initData verification
// =================================================================

function verifyInitData(initData) {
  if (!initData) return null;
  const props = PropertiesService.getScriptProperties();
  const botToken = props.getProperty("BOT_TOKEN");
  if (!botToken) throw new Error("BOT_TOKEN not in Script Properties");

  const params = parseInitData(initData);
  const receivedHash = params["hash"];
  if (!receivedHash) return null;
  delete params["hash"];

  const keys = Object.keys(params).sort();
  const dataCheckString = keys.map(k => k + "=" + params[k]).join("\n");

  const tokenBytes = Utilities.newBlob(botToken).getBytes();
  const wadBytes = Utilities.newBlob("WebAppData").getBytes();
  const dcsBytes = Utilities.newBlob(dataCheckString).getBytes();

  const secretKey = Utilities.computeHmacSha256Signature(tokenBytes, wadBytes);
  const computedBytes = Utilities.computeHmacSha256Signature(dcsBytes, secretKey);
  const computedHash = bytesToHex(computedBytes);

  if (computedHash !== receivedHash) return null;

  // 24-hour freshness check
  const authDate = parseInt(params["auth_date"] || "0", 10);
  const ageSec = Math.floor(Date.now() / 1000) - authDate;
  if (ageSec > 86400) return null;

  let user = null;
  try { user = JSON.parse(params["user"] || "null"); } catch (e) {}

  return {
    user,
    auth_date: authDate,
    start_param: params["start_param"] || null,
    chat_instance: params["chat_instance"] || null,
  };
}

function parseInitData(initData) {
  const result = {};
  initData.split("&").forEach(pair => {
    const idx = pair.indexOf("=");
    if (idx < 0) return;
    const key = decodeURIComponent(pair.slice(0, idx));
    const val = decodeURIComponent(pair.slice(idx + 1));
    result[key] = val;
  });
  return result;
}

function bytesToHex(bytes) {
  return bytes.map(b => {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? "0" + v : v;
  }).join("");
}

// =================================================================
// 3. Handlers
// =================================================================

function handleMe(body) {
  const auth = verifyInitData(body.initData);
  if (!auth || !auth.user || !auth.user.id) {
    return { error: "invalid_init_data" };
  }
  const tgId = auth.user.id;

  // Регистрируем пользователя если первый раз, обновляем last_seen_at
  const startParam = body.startParam || auth.start_param;
  const user = getOrCreateUser(auth.user, startParam);

  if (user.role === "manager") {
    const m = getManagerProfile(tgId) || synthesizeManagerFromUser(user);
    return {
      role: "manager",
      user: {
        tg_id: tgId,
        full_name: m.full_name || user.full_name,
        salon: m.salon || "",
        avatar_initial: getInitial(m.full_name || user.first_name),
      },
      status: m.status || "lapsed",
      status_until: m.active_until ? formatDate(m.active_until) : null,
    };
  }

  // client
  const c = getClientProfile(tgId);
  let manager = null;
  if (c && c.manager_tg_id) {
    const mp = getManagerProfile(c.manager_tg_id);
    manager = mp ? { full_name: mp.full_name, salon: mp.salon } : null;
  }
  return {
    role: "client",
    user: {
      tg_id: tgId,
      full_name: (c && c.full_name) || user.full_name,
      avatar_initial: getInitial((c && c.full_name) || user.first_name),
    },
    manager,
  };
}

function handleMeasurement(body) {
  const auth = verifyInitData(body.initData);
  if (!auth || !auth.user || !auth.user.id) return { error: "invalid_init_data" };
  const tgId = auth.user.id;
  const user = findUser(tgId);
  if (!user) return { error: "user_not_found" };

  const m = body.measurement || {};
  const id = generateId();
  const now = new Date();
  const filledBy = user.role === "manager" ? "manager_for_client" : "client_self";
  const clientTgId = user.role === "client" ? tgId : (m.client_tg_id || "");
  const c = user.role === "client" ? getClientProfile(tgId) : null;
  const managerTgId = user.role === "manager" ? tgId : (c && c.manager_tg_id) || "";

  appendRow("Measurements", [
    id,
    now,
    clientTgId,
    managerTgId,
    filledBy,
    m.layout || "",
    m.area_m2 || "",
    m.ceiling_mm || "",
    JSON.stringify(m.walls || {}),
    JSON.stringify(m.openings || {}),
    JSON.stringify(m.infra || {}),
    JSON.stringify(m.niches || {}),
    (m.photos || []).join(","),
    m.notes || "",
    "submitted",
  ]);

  // Обновляем last_measurement_id у клиента
  if (clientTgId) {
    updateColumnByKey("Clients", "tg_id", clientTgId, "last_measurement_id", id);
  }

  // Уведомляем менеджера, если замер сделал клиент
  if (filledBy === "client_self" && managerTgId) {
    sendTelegram(
      managerTgId,
      `📐 Новый замер от клиента <b>${user.full_name || tgId}</b>.\n` +
      `Площадь: ${m.area_m2 || "?"} м², форма: ${m.layout || "?"}.\n` +
      `Открыть в кабинете для просмотра.`
    );
  }

  log("measurement_submitted", tgId, { id, filledBy });
  return { ok: true, id };
}

function handlePodbor(body) {
  const auth = verifyInitData(body.initData);
  if (!auth || !auth.user || !auth.user.id) return { error: "invalid_init_data" };
  const tgId = auth.user.id;
  const user = findUser(tgId);
  if (!user) return { error: "user_not_found" };
  if (user.role !== "manager") return { error: "only_manager_can_request_podbor" };

  const checklist = body.checklist || {};
  const measurementId = body.measurement_id || "";
  const clientName = body.client_name || "";
  const clientTgId = body.client_tg_id || "";
  const id = generateId();
  const now = new Date();

  // Pre-create lead row
  appendRow("Leads", [
    id, now, tgId, clientTgId, clientName, measurementId,
    JSON.stringify(checklist), "", "", 0, false, "new", 0
  ]);

  // Build prompt and call Claude
  const measurement = measurementId ? getMeasurement(measurementId) : null;
  const prompt = buildPickerPrompt(checklist, measurement, clientName);
  const ai = callClaude(prompt);

  // Update lead row with AI response
  updateLeadAI(id, ai);

  // Send result to manager via bot
  const summary = formatPodborForTelegram(ai, clientName);
  sendTelegram(tgId, summary);

  log("podbor_completed", tgId, { id, tokens: ai.tokens, has_json: !!ai.json });
  return { ok: true, id, summary };
}

// =================================================================
// 4. Sheet helpers
// =================================================================

function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }
function sheet(name) {
  const s = ss().getSheetByName(name);
  if (!s) throw new Error("Sheet not found: " + name);
  return s;
}
function appendRow(sheetName, row) { sheet(sheetName).appendRow(row); }

function findUser(tgId) {
  if (!tgId) return null;
  const data = sheet("Users").getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(tgId)) {
      return {
        tg_id: data[i][0],
        tg_username: data[i][1],
        first_name: data[i][2],
        last_name: data[i][3],
        role: data[i][4],
        full_name: ((data[i][2] || "") + " " + (data[i][3] || "")).trim() || data[i][1] || "",
      };
    }
  }
  return null;
}

function getOrCreateUser(tgUser, startParam) {
  const tgId = tgUser.id;
  const props = PropertiesService.getScriptProperties();
  const adminId = parseInt(props.getProperty("ADMIN_TG_ID") || "0", 10);

  const existing = findUser(tgId);
  if (existing) {
    updateColumnByKey("Users", "tg_id", tgId, "last_seen_at", new Date());
    // Если это админ и роль ещё не manager — повышаем + автозавод в Managers
    if (tgId === adminId && existing.role !== "manager") {
      updateColumnByKey("Users", "tg_id", tgId, "role", "manager");
      ensureAdminManager(tgUser);
      existing.role = "manager";
    }
    return existing;
  }
  // Определяем роль:
  // - админ → manager (автозавод в Managers как ZOV-employee)
  // - invite-код менеджера → клиент с привязкой
  // - иначе → client
  let role = "client";
  let inviteCode = "";
  if (tgId === adminId) {
    role = "manager";
  } else if (startParam && startParam.indexOf("client_inv_") === 0) {
    role = "client";
    inviteCode = startParam;
  }
  const now = new Date();
  appendRow("Users", [
    tgId, tgUser.username || "", tgUser.first_name || "", tgUser.last_name || "",
    role, now, now, inviteCode,
  ]);
  if (tgId === adminId) {
    ensureAdminManager(tgUser);
  }
  log("user_registered", tgId, { role, startParam });
  return findUser(tgId);
}

// Гарантирует что админ есть в Managers как ZOV-employee
function ensureAdminManager(tgUser) {
  const tgId = tgUser.id;
  const data = sheet("Managers").getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(tgId)) return; // уже есть
  }
  const fullName = ((tgUser.first_name || "") + " " + (tgUser.last_name || "")).trim() || tgUser.username || String(tgId);
  appendRow("Managers", [
    tgId, fullName, "", "", "ЗОВ — куратор сети", "Санкт-Петербург",
    true, "active", "", "", 0, 0, 0, "MGR_ADMIN"
  ]);
}

function getManagerProfile(tgId) {
  const data = sheet("Managers").getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(tgId)) {
      const isZov = !!data[i][6];
      const lastOrder = data[i][8];
      const activePeriod = parseInt(getSetting("ACTIVE_PERIOD_DAYS") || "90", 10);
      const gracePeriod = parseInt(getSetting("GRACE_PERIOD_DAYS") || "14", 10);
      let activeUntil = null;
      let status = "lapsed";
      if (isZov) {
        status = "active";
      } else if (lastOrder instanceof Date) {
        activeUntil = new Date(lastOrder.getTime() + activePeriod * 86400000);
        const grace = new Date(activeUntil.getTime() + gracePeriod * 86400000);
        const now = new Date();
        if (now <= activeUntil) status = "active";
        else if (now <= grace)  status = "grace";
        else                    status = "lapsed";
      }
      return {
        tg_id: data[i][0],
        full_name: data[i][1],
        email: data[i][2],
        phone: data[i][3],
        salon: data[i][4],
        city: data[i][5],
        is_zov_employee: isZov,
        last_order_date: lastOrder,
        active_until: activeUntil,
        status,
        invite_code: data[i][13],
      };
    }
  }
  return null;
}

function getClientProfile(tgId) {
  const data = sheet("Clients").getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(tgId)) {
      return {
        tg_id: data[i][0],
        full_name: data[i][1],
        phone: data[i][2],
        email: data[i][3],
        address: data[i][4],
        city: data[i][5],
        budget_total: data[i][6],
        manager_tg_id: data[i][7],
        source: data[i][8],
        last_measurement_id: data[i][9],
      };
    }
  }
  return null;
}

function getMeasurement(id) {
  const data = sheet("Measurements").getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      return {
        id, layout: data[i][5], area_m2: data[i][6], ceiling_mm: data[i][7],
        walls: safeParse(data[i][8]),
        openings: safeParse(data[i][9]),
        infra: safeParse(data[i][10]),
        niches: safeParse(data[i][11]),
      };
    }
  }
  return null;
}

function safeParse(s) { try { return JSON.parse(s || "{}"); } catch (e) { return {}; } }

function updateColumnByKey(sheetName, keyCol, keyVal, targetCol, newVal) {
  const s = sheet(sheetName);
  const headers = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
  const keyIdx = headers.indexOf(keyCol);
  const targetIdx = headers.indexOf(targetCol);
  if (keyIdx < 0 || targetIdx < 0) return false;
  const data = s.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyIdx]) === String(keyVal)) {
      s.getRange(i + 1, targetIdx + 1).setValue(newVal);
      return true;
    }
  }
  return false;
}

function updateLeadAI(leadId, ai) {
  const s = sheet("Leads");
  const data = s.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === leadId) {
      const props = PropertiesService.getScriptProperties();
      const model = props.getProperty("ANTHROPIC_MODEL") || "claude-haiku-4-5-20251001";
      s.getRange(i + 1, 8).setValue(JSON.stringify(ai.json || ai.text || ""));
      s.getRange(i + 1, 9).setValue(model);
      s.getRange(i + 1, 10).setValue(ai.tokens || 0);
      s.getRange(i + 1, 11).setValue(true);
      return;
    }
  }
}

function getSetting(key) {
  const data = sheet("Settings").getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(key)) return String(data[i][1]);
  }
  return null;
}

// Если менеджер ещё не заведён в Managers — синтезируем «болванку» с lapsed-статусом
function synthesizeManagerFromUser(user) {
  return {
    full_name: user.full_name,
    salon: "",
    is_zov_employee: false,
    status: "lapsed",
    active_until: null,
  };
}

// =================================================================
// 5. Claude AI
// =================================================================

const SYSTEM_PROMPT_PICKER = (
  "Ты — эксперт-консультант по подбору кухонной техники для фабрики мебели «ЗОВ».\n" +
  "Помогаешь менеджерам салонов быстро согласовать с клиентом комплект техники.\n\n" +
  "Принципы:\n" +
  "1. Физические ограничения важнее эстетики. Если ниша 600×1850×600 — не предлагай 700×2000×650.\n" +
  "2. Уважай бюджет. Лимит в категории — не превышай >10%.\n" +
  "3. Уважай предпочтения по брендам: сначала preferred (★), потом alternative (✓).\n" +
  "4. Сценарий использования. Семья с детьми = простой UI, защита от детей. Выпечка = пар + конвекция.\n" +
  "5. Инфраструктура. Газ исключает индукцию. Нет шахты = только рециркуляция.\n" +
  "6. По каждой позиции: модель (линейка), цена, 2-3 преимущества под клиента, 1 предупреждение.\n\n" +
  "Формат ответа — валидный JSON без markdown:\n" +
  "{\n" +
  '  "summary": "...", \n' +
  '  "items": [{"category":"fridge","brand":"Bosch","model":"Serie 4 60см","price_rub":79990,' +
  '"size_mm":{"w":600,"h":2030,"d":660},"fits_niche":true,"highlights":["NoFrost","инвертор"],' +
  '"caveats":"Глубина 660мм","match_score":0.92}],\n' +
  '  "total_price_rub": 350000,\n' +
  '  "budget_status": "в_рамках|превышение|значительно_ниже",\n' +
  '  "warnings": [],\n' +
  '  "next_steps": []\n' +
  "}\n\n" +
  "Не выдумывай несуществующие артикулы — указывай линейку (Bosch Serie 4 60см)."
);

function buildPickerPrompt(checklist, measurement, clientName) {
  const payload = {
    client: { name: clientName || "" },
    checklist: checklist,
    measurement: measurement || null,
  };
  return "Подбери технику для следующего клиента:\n\n" + JSON.stringify(payload, null, 2);
}

function callClaude(userPrompt) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not in Script Properties");
  const model = props.getProperty("ANTHROPIC_MODEL") || "claude-haiku-4-5-20251001";
  const temperature = parseFloat(getSetting("AI_TEMPERATURE") || "0.3");

  const payload = {
    model,
    max_tokens: 4000,
    temperature,
    system: SYSTEM_PROMPT_PICKER,
    messages: [{ role: "user", content: userPrompt }],
  };

  const res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const status = res.getResponseCode();
  const text = res.getContentText();
  if (status >= 400) {
    log("claude_error", null, { status, text: text.slice(0, 500) });
    return { json: null, text: "AI ошибка: HTTP " + status, tokens: 0, error: true };
  }
  const data = JSON.parse(text);
  const responseText = (data.content || []).map(c => c.text || "").join("");
  const tokens = (data.usage && (data.usage.input_tokens + data.usage.output_tokens)) || 0;
  let json = null;
  try { json = JSON.parse(responseText); } catch (e) {}
  return { json, text: responseText, tokens };
}

function formatPodborForTelegram(ai, clientName) {
  if (ai.error) return "❌ Не удалось получить подбор от AI. Попробуйте позже.";
  if (!ai.json) return "<b>Подбор готов</b>\n\n" + (ai.text || "").slice(0, 3500);

  const j = ai.json;
  const lines = [
    "✅ <b>Подбор готов</b>",
    clientName ? "Клиент: <b>" + clientName + "</b>" : "",
    "",
    j.summary || "",
    "",
  ];
  (j.items || []).forEach(item => {
    const sizeStr = item.size_mm ? " (" + item.size_mm.w + "×" + item.size_mm.h + "×" + item.size_mm.d + "мм)" : "";
    lines.push("<b>" + (item.brand || "") + " " + (item.model || "") + "</b>" + sizeStr);
    if (item.price_rub) lines.push("💰 " + formatPrice(item.price_rub) + " ₽");
    if (item.highlights && item.highlights.length) lines.push("✓ " + item.highlights.join(", "));
    if (item.caveats) lines.push("⚠️ " + item.caveats);
    lines.push("");
  });
  if (j.total_price_rub) lines.push("<b>ИТОГО: " + formatPrice(j.total_price_rub) + " ₽</b> · " + (j.budget_status || ""));
  if (j.warnings && j.warnings.length) lines.push("\n⚠️ " + j.warnings.join("; "));
  return lines.join("\n");
}

function formatPrice(n) {
  if (n === null || n === undefined || n === "") return "—";
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// =================================================================
// 6. Telegram Bot API
// =================================================================

function sendTelegram(chatId, text, options) {
  const props = PropertiesService.getScriptProperties();
  const botToken = props.getProperty("BOT_TOKEN");
  if (!botToken || !chatId) return;
  const url = "https://api.telegram.org/bot" + botToken + "/sendMessage";
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (options) Object.keys(options).forEach(k => payload[k] = options[k]);
  try {
    UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
  } catch (e) {
    log("telegram_send_error", chatId, { error: String(e) });
  }
}

// =================================================================
// 7. Util
// =================================================================

function generateId() { return Utilities.getUuid().slice(0, 13); }

function formatDate(d) {
  if (!(d instanceof Date)) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return dd + "." + mm + "." + d.getFullYear();
}

function getInitial(name) {
  return ((name || "").trim().slice(0, 1) || "?").toUpperCase();
}

function log(event, tgId, payload) {
  try {
    appendRow("Logs", [new Date(), event, tgId || "", payload ? JSON.stringify(payload) : ""]);
  } catch (e) {}
}

// =================================================================
// 8. Утилиты для одноразового запуска (через Apps Script Run)
// =================================================================

/**
 * Заводит Руслана (admin) как ZOV-employee менеджера.
 * Можно дёрнуть через GET ?path=seed_admin или нажать Run в редакторе.
 */
function seedAdminAsManager() {
  const props = PropertiesService.getScriptProperties();
  const adminId = parseInt(props.getProperty("ADMIN_TG_ID") || "5937498515", 10);
  const data = sheet("Managers").getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(adminId)) {
      return { ok: true, status: "already_seeded", admin_id: adminId };
    }
  }
  appendRow("Managers", [
    adminId, "Руслан Васильев", "vasrusgen@gmail.com", "",
    "ЗОВ — куратор сети", "Санкт-Петербург",
    true, "active", "", "", 0, 0, 0, "MGR_ADMIN"
  ]);
  // Также заводим в Users с ролью manager, если ещё нет
  const u = findUser(adminId);
  if (!u) {
    appendRow("Users", [adminId, "VASRUSGEN", "Руслан", "Васильев", "manager", new Date(), new Date(), ""]);
  } else if (u.role !== "manager") {
    updateColumnByKey("Users", "tg_id", adminId, "role", "manager");
  }
  return { ok: true, status: "seeded", admin_id: adminId, full_name: "Руслан Васильев" };
}

/** Тестовый прогон Claude API: проверяет что ключ работает. */
function testClaude() {
  const ai = callClaude("Скажи одной фразой: что за фабрика ЗОВ?");
  return { ok: !ai.error, response_text: (ai.text || "").slice(0, 500), tokens: ai.tokens, model: PropertiesService.getScriptProperties().getProperty("ANTHROPIC_MODEL") || "claude-haiku-4-5-20251001" };
}

/** Тест отправки сообщения через бота — пришлёт админу «привет». */
function testTelegram() {
  const props = PropertiesService.getScriptProperties();
  const adminId = props.getProperty("ADMIN_TG_ID") || "5937498515";
  sendTelegram(adminId, "🟢 Привет из Apps Script бэкенда! Если видишь — связка бот↔backend работает.");
  return { ok: true, sent_to: adminId };
}
