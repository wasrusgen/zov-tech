/**
 * UI smoke-тест MiniApp через Playwright.
 * Запуск: node tests/ui_smoke.js           — локальный сервер (по умолчанию)
 *         SMOKE_URL=https://... node tests/ui_smoke.js — произвольный URL
 *
 * Что проверяет:
 *  - Нет JS-ошибок (ReferenceError, TypeError и т.п.) на каждом экране
 *  - Список клиентов загружается
 *  - Карточка клиента открывается без ошибок
 *  - Форма нового клиента открывается без ошибок
 *  - Экраны замеров, сборок, #/inbox, #/me открываются без ошибок
 */

const { chromium } = require("playwright");
const crypto = require("crypto");
const { spawn } = require("child_process");
const path = require("path");

// ─── Конфигурация ────────────────────────────────────────────────────────────
const BOT_TOKEN      = "8281503057:AAEXmOepY8quH8E3RqOjFbgn7owV1ngnbGA";
const ADMIN_TG_ID    = 5937498515;
const LOCAL_PORT     = 8787;
const PROJECT_ROOT   = path.resolve(__dirname, "..");   // без пробелов в аргументах
const REMOTE_URL     = "https://wasrusgen.github.io/zov-tech/";
// Если задана переменная окружения — используем её; иначе поднимаем локальный сервер
const USE_REMOTE     = !!process.env.SMOKE_URL;
const MINIAPP_URL    = process.env.SMOKE_URL || `http://localhost:${LOCAL_PORT}/`;
const TIMEOUT_MS     = 15000;

// ─── Локальный сервер ────────────────────────────────────────────────────────
const http = require("http");
let _serveProc = null;

function pingServer(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, (res) => { res.resume(); resolve(true); });
    req.on("error", () => resolve(false));
    req.setTimeout(500, () => { req.destroy(); resolve(false); });
  });
}

function startLocalServer() {
  return new Promise((resolve, reject) => {
    if (USE_REMOTE) { resolve(); return; }
    _serveProc = spawn("npx", ["serve", "miniapp", "-p", String(LOCAL_PORT), "--no-clipboard", "-s"], {
      stdio: "ignore",
      shell: true,
      cwd: PROJECT_ROOT,
    });
    _serveProc.on("error", reject);

    // Polling: ждём HTTP-ответа, максимум 15 сек
    const deadline = Date.now() + 15000;
    const poll = setInterval(async () => {
      if (await pingServer(LOCAL_PORT)) { clearInterval(poll); resolve(); return; }
      if (Date.now() > deadline)        { clearInterval(poll); reject(new Error("Локальный сервер не запустился за 15 сек")); }
    }, 400);
  });
}

function stopLocalServer() {
  if (_serveProc) { _serveProc.kill(); _serveProc = null; }
}

// ─── Генерация валидного initData ─────────────────────────────────────────────
function makeInitData() {
  const user = JSON.stringify({
    id: ADMIN_TG_ID,
    first_name: "Руслан",
    username: "wasrusgen",
    language_code: "ru",
    allows_write_to_pm: true,
  });
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user,
  };
  const dataCheckString = Object.keys(fields).sort()
    .map(k => `${k}=${fields[k]}`).join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN).digest();
  const hash = crypto.createHmac("sha256", secretKey)
    .update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

// ─── Отчёт ───────────────────────────────────────────────────────────────────
const RESULTS = [];
function pass(name, detail = "") {
  RESULTS.push({ ok: true, name, detail });
  console.log(`  ✅  ${name}${detail ? "  — " + detail : ""}`);
}
function fail(name, detail = "") {
  RESULTS.push({ ok: false, name, detail });
  console.log(`  ❌  ${name}${detail ? "  — " + detail : ""}`);
}
function section(title) {
  console.log(`\n${"─".repeat(55)}\n  ${title}\n${"─".repeat(55)}`);
}

// ─── Вспомогательные функции ─────────────────────────────────────────────────

/** Ждёт появления элемента на странице (или возвращает null по таймауту) */
async function waitForSelector(page, selector, timeout = TIMEOUT_MS) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

/** Возвращает JS-ошибки накопленные с момента последнего вызова reset */
function makeErrorCollector(page) {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", msg => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return {
    flush() { const copy = [...errors]; errors.length = 0; return copy; },
    any()   { return errors.length > 0; },
  };
}

// ─── Основные тесты ──────────────────────────────────────────────────────────

async function run() {
  await startLocalServer();

  console.log(`\n${"=".repeat(55)}`);
  console.log("  UI SMOKE-ТЕСТ  MiniApp (Playwright)");
  console.log(`  ${MINIAPP_URL}${USE_REMOTE ? "" : "  (локальный сервер)"}`);
  console.log(`${"=".repeat(55)}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) TelegramBot",
  });
  const page = await context.newPage();
  const errors = makeErrorCollector(page);

  const initData     = makeInitData();
  const initDataUnsafe = {
    user: { id: ADMIN_TG_ID, first_name: "Руслан", username: "wasrusgen", language_code: "ru" },
    auth_date: Math.floor(Date.now() / 1000),
    hash: "",
  };

  // ── Инжектируем mock Telegram.WebApp ──────────────────────────────────────
  await page.addInitScript(({ initData, initDataUnsafe }) => {
    window.Telegram = {
      WebApp: {
        initData,
        initDataUnsafe,
        colorScheme: "dark",
        themeParams: {},
        isExpanded: true,
        viewportHeight: 844,
        viewportStableHeight: 844,
        MainButton: { show() {}, hide() {}, setText() {}, onClick() {} },
        BackButton: { show() {}, hide() {}, onClick() {} },
        HapticFeedback: { impactOccurred() {}, notificationOccurred() {} },
        ready() {},
        expand() {},
        close() {},
        showAlert(msg) { console.log("[tg.showAlert]", msg); },
        showConfirm(msg, cb) { cb(true); },
      },
    };
  }, { initData, initDataUnsafe });

  // ── 1. Загрузка страницы ──────────────────────────────────────────────────
  section("📄 Загрузка приложения");
  try {
    await page.goto(MINIAPP_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
    const appEl = await waitForSelector(page, "#app", 5000);
    appEl ? pass("MiniApp загрузился (#app найден)") : fail("MiniApp не загрузился (#app не найден)");
  } catch (e) {
    fail("Ошибка загрузки страницы", e.message);
    await browser.close();
    stopLocalServer();
    printSummary();
    return;
  }
  const jsErrOnLoad = errors.flush();
  jsErrOnLoad.length === 0
    ? pass("Нет JS-ошибок при загрузке")
    : fail("JS-ошибки при загрузке", jsErrOnLoad.slice(0, 2).join(" | "));

  // Авторизуемся как менеджер
  try {
    await page.goto(MINIAPP_URL + "?role=manager", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(1500);
  } catch { /* ок */ }

  // ── Mock API: подставляем тестового клиента ──────────────────────────────
  // Mock: список клиентов с тестовой записью
  await page.route("**/api/clients", route => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        clients: [{
          client_name:  "Тест Смоук",
          client_phone: "+70000000000",
          client_tg_id: "",
          address:      "ул. Тестовая, 1",
          leads_count:  0,
          last_lead_at: "",
        }],
      }),
    });
  });

  // ── 2. Экран клиентов ─────────────────────────────────────────────────────
  section("👥 Список клиентов");
  await page.evaluate(() => { location.hash = "#/clients"; });
  await page.waitForTimeout(3000);
  const jsErrClients = errors.flush();
  jsErrClients.length === 0
    ? pass("Нет JS-ошибок на экране клиентов")
    : fail("JS-ошибки на экране клиентов", jsErrClients.slice(0, 2).join(" | "));

  // Проверяем что что-то отрендерилось
  const hasClientList = await page.evaluate(() =>
    document.querySelector(".client-card, .empty, .error") !== null
  );
  hasClientList
    ? pass("Список клиентов отрендерился")
    : fail("Список клиентов пустой (нет .client-card, .empty, .error)");

  // ── 3. Карточка первого клиента (mock-фикстура) ───────────────────────────
  section("🪪 Карточка клиента");
  const firstCard = await page.$(".client-card");
  if (firstCard) {
    await firstCard.click();
    await page.waitForTimeout(3000);
    const jsErrCard = errors.flush();
    jsErrCard.length === 0
      ? pass("Нет JS-ошибок при открытии карточки")
      : fail("JS-ошибки в карточке клиента", jsErrCard.slice(0, 2).join(" | "));

    const headerText = await page.evaluate(() =>
      document.querySelector(".podbor-title")?.textContent?.trim() || ""
    );
    (headerText || "").toLowerCase().includes("карточка")
      ? pass("Заголовок карточки", headerText)
      : fail("Ожидался заголовок 'Карточка клиента'", `получили: "${headerText}"`);

    const hasDetails = await page.evaluate(() =>
      document.querySelector(".client-detail-head, .client-quick-actions") !== null
    );
    hasDetails
      ? pass("Содержимое карточки отрендерилось")
      : fail("Карточка пустая (нет .client-detail-head)");
  } else {
    fail("Карточка клиента — .client-card не найден после mock-фикстуры");
  }

  // ── 4. Форма нового клиента ───────────────────────────────────────────────
  section("➕ Форма нового клиента");
  await page.evaluate(() => { location.hash = "#/clients/new"; });
  await page.waitForTimeout(2000);
  const jsErrNew = errors.flush();
  jsErrNew.length === 0
    ? pass("Нет JS-ошибок в форме нового клиента")
    : fail("JS-ошибки в форме нового клиента", jsErrNew.slice(0, 2).join(" | "));

  const hasForm = await page.evaluate(() =>
    document.querySelector("#fn, #ph") !== null
  );
  hasForm
    ? pass("Форма отрендерилась (поля ФИО и телефон)")
    : fail("Форма не отрендерилась");

  // ── 5. Экран замеров ──────────────────────────────────────────────────────
  section("📐 Экран замеров");
  await page.evaluate(() => { location.hash = "#/measurements"; });
  await page.waitForTimeout(3000);
  const jsErrMeasure = errors.flush();
  jsErrMeasure.length === 0
    ? pass("Нет JS-ошибок на экране замеров")
    : fail("JS-ошибки на экране замеров", jsErrMeasure.slice(0, 2).join(" | "));

  // ── 6. Экран сборок ───────────────────────────────────────────────────────
  section("🔧 Экран сборок");
  await page.evaluate(() => { location.hash = "#/assembly"; });
  await page.waitForTimeout(3000);
  const jsErrAssembly = errors.flush();
  jsErrAssembly.length === 0
    ? pass("Нет JS-ошибок на экране сборок")
    : fail("JS-ошибки на экране сборок", jsErrAssembly.slice(0, 2).join(" | "));

  // ── 7. Входящие задачи менеджера (#/inbox) ────────────────────────────────
  section("📥 Входящие менеджера (#/inbox)");
  await page.evaluate(() => { location.hash = "#/inbox"; });
  await page.waitForTimeout(3000);
  const jsErrInbox = errors.flush();
  jsErrInbox.length === 0
    ? pass("Нет JS-ошибок на экране #/inbox")
    : fail("JS-ошибки на экране #/inbox", jsErrInbox.slice(0, 2).join(" | "));

  const inboxRendered = await page.evaluate(() =>
    document.querySelector(".podbor-header, .empty, .error, .assembly-card") !== null
  );
  inboxRendered
    ? pass("#/inbox отрендерился (заголовок или список)")
    : fail("#/inbox не отрендерился — нет .podbor-header / .empty / .error");

  const inboxTitle = await page.evaluate(() =>
    document.querySelector(".podbor-title")?.textContent?.trim() || ""
  );
  inboxTitle === "Входящие"
    ? pass("Заголовок «Входящие» корректен")
    : fail("Неверный заголовок #/inbox", `получили: "${inboxTitle}"`);

  // ── 8. Профиль (#/me) ─────────────────────────────────────────────────────
  section("👤 Профиль (#/me)");
  await page.evaluate(() => { location.hash = "#/me"; });
  await page.waitForTimeout(3000);
  const jsErrMe = errors.flush();
  jsErrMe.length === 0
    ? pass("Нет JS-ошибок на экране #/me")
    : fail("JS-ошибки на экране #/me", jsErrMe.slice(0, 2).join(" | "));

  const meRendered = await page.evaluate(() =>
    document.querySelector(".podbor-header, .error") !== null
  );
  meRendered
    ? pass("#/me отрендерился")
    : fail("#/me не отрендерился — нет .podbor-header");

  // ── 9. Снимок экрана для отчёта ───────────────────────────────────────────
  await page.evaluate(() => { location.hash = "#/clients"; });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "tests/ui_last_run.png", fullPage: false });
  pass("Скриншот сохранён", "tests/ui_last_run.png");

  await browser.close();
  stopLocalServer();
  printSummary();
}

function printSummary() {
  const passed = RESULTS.filter(r => r.ok).length;
  const failed = RESULTS.filter(r => !r.ok).length;
  console.log(`\n${"=".repeat(55)}`);
  console.log(`  ИТОГО: ${passed} ✅  /  ${failed} ❌`);
  console.log(`${"=".repeat(55)}\n`);
  if (failed > 0) {
    console.log("📋 ЗАМЕЧАНИЯ К УСТРАНЕНИЮ:\n");
    RESULTS.filter(r => !r.ok).forEach(r => {
      console.log(`  ❌  ${r.name}`);
      if (r.detail) console.log(`      → ${r.detail}`);
    });
    console.log();
    process.exit(1);
  } else {
    console.log("✅ Все UI-тесты прошли.\n");
    process.exit(0);
  }
}

run().catch(e => {
  stopLocalServer();
  console.error("Критическая ошибка:", e.message);
  process.exit(1);
});
