# Backend (Google Apps Script)

Это код, который живёт в Apps Script-проекте, привязанном к Google Sheet «ЗОВ — База».

## Файлы

| Файл | Когда запускать |
|---|---|
| `setup_database.gs` | **один раз**, чтобы создать 8 листов (уже выполнено) |
| `Code.gs` | основной backend, обслуживает MiniApp и бот через `doPost` |

## Шаги после первой установки `Code.gs`

### 1. Добавить Script Properties (секреты)

В Apps Script: **⚙️ Project Settings** → секция **Script Properties** → **Add property**.

| Key | Value |
|---|---|
| `BOT_TOKEN` | токен Telegram-бота (из @BotFather) |
| `ANTHROPIC_API_KEY` | `sk-ant-api03-…` из console.anthropic.com |
| `ADMIN_TG_ID` | `5937498515` (ваш tg_id) |
| `ANTHROPIC_MODEL` | (опционально) `claude-haiku-4-5-20251001` |

### 2. Запустить разовые setup-функции

В верхней панели селект функций → выбрать → **▶ Run**:

- **`seedAdminAsManager`** — заведёт Руслана Васильева как admin-менеджера в Managers/Users (статус всегда active как ZOV-employee).
- **`testClaude`** — проверит, что Anthropic API ключ работает (увидите ответ AI в Execution log).
- **`testTelegram`** — проверит связку: бот должен прислать вам "🟢 Привет из Apps Script бэкенда".

### 3. Деплой как Web App

В Apps Script: **Deploy** → **New deployment** → шестерёнка **Type → Web app**.

Параметры:
- **Description:** `zov-tech-backend v1`
- **Execute as:** `Me (vasrusgen@gmail.com)`
- **Who has access:** `Anyone` (чтобы MiniApp мог POST'ить, ОБЯЗАТЕЛЬНО)

Жмём **Deploy**. Получим URL вида:
```
https://script.google.com/macros/s/AKfycbz.../exec
```
Этот URL — `BACKEND_URL` для MiniApp.

### 4. Прислать URL разработчику

После деплоя URL подставляется в `miniapp/assets/app.js`, MiniApp начинает реально читать профиль из Sheet вместо мок-данных.

## API endpoints

Все запросы — `POST {BACKEND_URL}?path=<endpoint>` с JSON-телом `{ initData, ... }`.

| Endpoint | Body | Ответ |
|---|---|---|
| `?path=ping` | `{}` | `{ pong: true, time }` (для health-check) |
| `?path=me` | `{ initData, startParam? }` | профиль пользователя (роль, имя, статус, менеджер) |
| `?path=measurement` | `{ initData, measurement: { layout, area_m2, ... } }` | `{ ok: true, id }` |
| `?path=podbor` | `{ initData, checklist, measurement_id?, client_name? }` | `{ ok: true, id, summary }` + AI-ответ в Telegram |

## Безопасность

- Все запросы (кроме `ping`) обязательно содержат `initData` от Telegram WebApp.
- Backend проверяет HMAC-SHA-256 подпись `initData` по `BOT_TOKEN`.
- При невалидной подписи → `{ error: "invalid_init_data" }`.
- 24-часовая свежесть подписи (`auth_date`).

## Обновление

Изменили `Code.gs` локально → скопировать в Apps Script → **Save** → **Deploy → Manage deployments → Edit → Version: New version → Deploy**. URL не меняется.
