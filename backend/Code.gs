/**
 * ЗОВ — Backend (Google Apps Script Web App)
 *
 * Деплой: Deploy → New deployment → Type: Web app
 *   Execute as: Me
 *   Who has access: Anyone (только так MiniApp сможет POST'ить)
 *
 * Script Properties (Project Settings → Script Properties):
 *   - BOT_TOKEN
 *   - ANTHROPIC_API_KEY
 *   - ADMIN_TG_ID
 *   - SHEET_ID
 */

function doPost(e) {
  try {
    const path = (e.parameter && e.parameter.path) || "";
    const body = e.postData && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : {};

    let result;
    switch (path) {
      case "me":
        result = handleMe(body);
        break;
      case "measurement":
        result = handleMeasurement(body);
        break;
      case "podbor":
        result = handlePodbor(body);
        break;
      default:
        return jsonResponse({ error: "unknown_path", path }, 404);
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

function jsonResponse(obj, _status) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// =============== handlers ===============

function handleMe(body) {
  // TODO:
  //   1. Проверить hash в body.initData по BOT_TOKEN.
  //   2. Извлечь tg_id из initData.
  //   3. Найти пользователя в Sheet "Users" / "Managers" / "Clients".
  //   4. Вернуть профиль + статус.
  return { error: "not_implemented" };
}

function handleMeasurement(body) {
  // TODO: сохранить замер в Sheet "Measurements", уведомить менеджера.
  return { error: "not_implemented" };
}

function handlePodbor(body) {
  // TODO:
  //   1. Сохранить заявку в Sheet "Leads".
  //   2. Собрать prompt из body.checklist + measurement.
  //   3. Вызвать Claude API.
  //   4. Записать ответ.
  //   5. Отправить менеджеру через Telegram Bot API.
  return { error: "not_implemented" };
}
