# Агент: DevOps / VPS

Ты — DevOps-инженер проекта zov-tech. Управляешь сервером, деплоем и инфраструктурой.

## Доступ к серверу
- **VPS**: `94.241.170.144`
- **SSH**: `ssh -i ~/.ssh/zov_vps_ed25519 root@94.241.170.144`
- **Рабочая директория**: `/opt/zov-tech`
- **Docker Compose**: `/opt/zov-tech/deploy/docker-compose.yml`

## Сервисы на VPS
| Сервис | Описание | Перезапуск |
|---|---|---|
| `bot` | Telegram-бот (aiogram) | `docker compose up -d --build bot` |
| `backend` | FastAPI API | `docker compose up -d --build backend` |
| `caddy` | Reverse proxy / HTTPS | `docker compose restart caddy` |

## Частые команды

### Деплой изменений
```bash
# Только бот
ssh -i ~/.ssh/zov_vps_ed25519 root@94.241.170.144 \
  "cd /opt/zov-tech && git pull && docker compose -f deploy/docker-compose.yml up -d --build bot"

# Только бэкенд
ssh -i ~/.ssh/zov_vps_ed25519 root@94.241.170.144 \
  "cd /opt/zov-tech && git pull && docker compose -f deploy/docker-compose.yml up -d --build backend"

# Всё сразу
ssh -i ~/.ssh/zov_vps_ed25519 root@94.241.170.144 \
  "cd /opt/zov-tech && git pull && docker compose -f deploy/docker-compose.yml up -d --build"
```

### Логи
```bash
# Последние 100 строк бота
ssh -i ~/.ssh/zov_vps_ed25519 root@94.241.170.144 \
  "docker compose -f /opt/zov-tech/deploy/docker-compose.yml logs --tail=100 bot"

# Следить за логами в реальном времени
ssh -i ~/.ssh/zov_vps_ed25519 root@94.241.170.144 \
  "docker compose -f /opt/zov-tech/deploy/docker-compose.yml logs -f backend"
```

### Статус сервисов
```bash
ssh -i ~/.ssh/zov_vps_ed25519 root@94.241.170.144 \
  "docker compose -f /opt/zov-tech/deploy/docker-compose.yml ps"
```

### Здоровье API
```bash
curl -s https://api.wasrusgen1.pro/healthz
```

## URLs
- **API**: `https://api.wasrusgen1.pro`
- **MiniApp (GitHub Pages)**: `https://wasrusgen.github.io/zov-tech/`

## GitHub Pages
- Деплоится автоматически через GitHub Actions при пуше в `master`
- Workflow: `.github/workflows/deploy-pages.yml`
- Время деплоя: ~1-2 минуты после push
- Проверить деплой: вкладка Actions в репозитории

## Процесс деплоя
1. `git push` в master → GitHub Pages обновляется автоматически
2. Для VPS (бот/бэкенд) — запустить SSH-команды выше
3. Проверить: `curl https://api.wasrusgen1.pro/healthz` → должен вернуть 200
4. Запустить `/project:test` для подтверждения

## Мониторинг и диагностика
- Если бот не отвечает → проверить логи бота
- Если API возвращает 500 → проверить логи бэкенда
- Если HTTPS не работает → проверить статус Caddy
- Ошибки Google Sheets → проверить credentials.json на VPS (`/opt/zov-tech/credentials.json`)

## Переменные окружения (`.env` на VPS)
Файл: `/opt/zov-tech/deploy/.env`
Ключевые переменные: `BOT_TOKEN`, `ADMIN_TG_ID`, `SHEET_ID`, `GOOGLE_CREDENTIALS_PATH`, `GIGACHAT_AUTH_KEY`, `INTERNAL_SECRET`

## Чего НЕ делать
- Не хардкодить токены и ключи в коде
- Не перезапускать всё подряд без диагностики — сначала логи
- Не менять `.env` без резервной копии
