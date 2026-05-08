/**
 * ЗОВ — База: одноразовый setup всех 8 листов с заголовками и формулами.
 *
 * Как запустить:
 *   1. Открыть таблицу «ЗОВ — База» в Google Sheets.
 *   2. Extensions (Расширения) → Apps Script.
 *   3. В редакторе скопировать сюда содержимое этого файла.
 *   4. Сохранить (Ctrl+S).
 *   5. В верхней панели выбрать функцию `setupDatabase` → нажать Run.
 *   6. Authorize при первом запуске (Google спросит разрешение на работу со Sheet).
 *   7. Вернуться в таблицу — все 8 листов готовы.
 */

const SHEETS = {
  Users:        ["tg_id","tg_username","first_name","last_name","role","created_at","last_seen_at","invite_code_used"],
  Managers:     ["tg_id","full_name","email","phone","salon","city","is_zov_employee","status","last_order_date","active_until","total_leads","total_deals","conversion_rate","invite_code"],
  Clients:      ["tg_id","full_name","phone","email","address","city","budget_total","manager_tg_id","source","last_measurement_id"],
  Measurements: ["id","created_at","client_tg_id","manager_tg_id","filled_by","layout","area_m2","ceiling_mm","walls_json","openings_json","infra_json","niches_json","photos_urls","notes","status"],
  Leads:        ["id","created_at","manager_tg_id","client_tg_id","client_name","measurement_id","checklist_json","ai_response","ai_model","ai_tokens_used","sent_to_tg","deal_status","deal_amount"],
  Logs:         ["timestamp","event","tg_id","payload"],
  Settings:     ["key","value","description"],
  Dashboard:    ["metric","value"],
};

const SETTINGS_DEFAULTS = [
  ["ACTIVE_PERIOD_DAYS", 90,             "Дней active-статуса после сделки через куратора"],
  ["GRACE_PERIOD_DAYS",  14,             "Grace-период перед переводом в lapsed"],
  ["AI_MODEL",           "claude-haiku-4-5-20251001", "Модель Anthropic для подбора"],
  ["AI_TEMPERATURE",     0.3,            "Температура генерации"],
  ["ADMIN_TG_ID",        5937498515,     "Tg_id куратора (Руслан Васильев)"],
  ["PAID_PRICE_PER_LEAD", 500,           "Цена pay-per-use для lapsed-менеджеров, ₽"],
  ["PAID_SUBSCRIPTION",   3000,          "Цена месячной подписки, ₽"],
];

const DASHBOARD_ROWS = [
  ["Активных менеджеров",       '=COUNTIF(Managers!H2:H; "active")'],
  ["Lapsed-менеджеров",         '=COUNTIF(Managers!H2:H; "lapsed")'],
  ["Заявок за 30 дней",         '=COUNTIFS(Leads!B2:B; ">="&(TODAY()-30))'],
  ["Сделок won",                '=COUNTIF(Leads!L2:L; "won")'],
  ["Конверсия в сделку",        '=IFERROR(COUNTIF(Leads!L2:L; "won")/COUNTA(Leads!A2:A); 0)'],
  ["Средний чек won-сделок, ₽", '=IFERROR(AVERAGEIF(Leads!L2:L; "won"; Leads!M2:M); 0)'],
  ["Замеров всего",             '=COUNTA(Measurements!A2:A)'],
  ["Расход на AI, токенов",     '=SUM(Leads!J2:J)'],
];

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Удалить дефолтный пустой лист, если есть
  const defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("Лист1");

  Object.keys(SHEETS).forEach((name, idx) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name, idx);
    } else {
      sheet.clear();
    }
    const headers = SHEETS[name];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#F0F9E8");
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  });

  // Settings — заполнить дефолтами
  const settings = ss.getSheetByName("Settings");
  settings.getRange(2, 1, SETTINGS_DEFAULTS.length, 3).setValues(SETTINGS_DEFAULTS);

  // Dashboard — заполнить формулами
  const dashboard = ss.getSheetByName("Dashboard");
  for (let i = 0; i < DASHBOARD_ROWS.length; i++) {
    const [metric, formula] = DASHBOARD_ROWS[i];
    dashboard.getRange(i + 2, 1).setValue(metric);
    dashboard.getRange(i + 2, 2).setFormula(formula);
  }
  dashboard.setColumnWidth(1, 280);
  dashboard.setColumnWidth(2, 140);

  // Удалить пустой Sheet1 в самом конце (если был)
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  SpreadsheetApp.getActive().toast("✅ База готова — 8 листов созданы");
}

/** Удобный вызов через меню — необязательно */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("ЗОВ")
    .addItem("Setup database", "setupDatabase")
    .addToUi();
}
