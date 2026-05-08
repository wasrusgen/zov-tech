# Backend (Google Apps Script)

Этот код — зеркало того, что лежит в Apps Script-проекте, привязанном к Google Sheet «ЗОВ — База».

## Как синхронизировать

Вариант 1 (вручную): копировать содержимое `Code.gs` в редактор Apps Script.

Вариант 2 (через clasp): использовать [clasp](https://github.com/google/clasp).

```bash
npm install -g @google/clasp
clasp login
clasp clone <SCRIPT_ID>
# или для уже существующего:
clasp pull / clasp push
```

## Деплой

1. Открыть Apps Script проект, привязанный к Sheet.
2. Deploy → New deployment.
3. Type: **Web app**.
4. Execute as: **Me**.
5. Who has access: **Anyone** (только так MiniApp сможет POST'ить).
6. Скопировать выданный URL — это `BACKEND_URL` в `miniapp/assets/app.js`.

## Script Properties (секреты)

В Apps Script: ⚙️ Project Settings → Script Properties → Add property.

| Key | Value |
|---|---|
| `BOT_TOKEN` | токен @BotFather |
| `ANTHROPIC_API_KEY` | ключ Anthropic Console |
| `ADMIN_TG_ID` | tg_id куратора |
| `SHEET_ID` | ID Google Sheet (из URL) |
