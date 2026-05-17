# Claude — правила работы с проектом zov-tech

## ⚠️ ОБЯЗАТЕЛЬНЫЙ PRE-COMMIT CHECKLIST для любых UI/CSS изменений

Перед каждым `git commit` с изменениями в `miniapp/` — пройти все пункты:

### 1. Цвет и читаемость
- [ ] Используется ли `color: transparent` для скрытия текста? (НЕ `var(--card)` — она зависит от Telegram-темы и может быть не нужным цветом)
- [ ] Нет ли текста, где `color` и `background` одинаковы только в светлой теме?
- [ ] Проверены ли все 4 темы: **Default, Foundry, Boardroom, Atelier** — в каждой из них `--card`, `--paper`, `--ink`, `--muted` могут быть разными
- [ ] Если добавляется новый CSS-класс — указан ли явный `color:` (не наследование)?

### 2. Новые CSS-классы
- [ ] Для каждого нового класса (`.foo`) — проверить, что стили явно определены и не полагаются на наследование от `body`
- [ ] Добавлены ли стили для всех тем (ищи блоки `[data-theme="foundry"]`, `[data-theme="boardroom"]`, `[data-theme="atelier"]` в styles.css)?

### 3. Версия кэша
- [ ] Бамп `?v=` в `index.html` для каждого изменённого `.css` или `.js` файла
- [ ] Формат: `?v=YYYYMMDD[буква]` — буква растёт по алфавиту в течение дня

### 4. Деплой
- [ ] После `git push` — GitHub Actions деплоит ~1-2 мин (смотреть на вкладке Actions в GitHub)
- [ ] VPS (бот + бэкенд) обновляется отдельно: `ssh root@94.241.170.144 "cd /opt/zov-tech && git pull && docker compose -f deploy/docker-compose.yml up -d --build bot"`

---

## Архитектура проекта

```
miniapp/          → статика, деплой через GitHub Pages (github.com/wasrusgen/zov-tech)
bot/              → Telegram-бот, работает на VPS 94.241.170.144
backend-py/       → FastAPI-бэкенд, работает на VPS
deploy/           → docker-compose.yml, Caddyfile.snippet
```

- **MINIAPP_URL**: `https://wasrusgen.github.io/zov-tech/`
- **API**: `https://api.wasrusgen1.pro`
- **VPS SSH**: `ssh -i ~/.ssh/zov_vps_ed25519 root@94.241.170.144`

## CSS-переменные по темам

| Переменная | Default (светлая) | Foundry | Boardroom | Atelier |
|---|---|---|---|---|
| `--card` | `tg-section-bg` (≈белый) | `#EAE3CC` | `#EDE5D0` | `#FFFFFF` |
| `--ink` | `tg-text-color` | `#1A150E` | `#1A150E` | тёмный |
| `--muted` | серый | `#7A6E5F` | `#6B6256` | серый |

> ⚠️ `var(--card)` в дефолтной теме читается из `--tg-theme-section-bg-color` Telegram.
> В тёмном Telegram-клиенте это НЕ белый цвет. Для полного скрытия текста — только `color: transparent`.

## Типичные ошибки (уже были)

1. **`color: var(--card)` для скрытия текста** → не работает в тёмных Telegram-темах. Используй `color: transparent`
2. **Новый JS-класс без CSS** → текст наследует `color: var(--ink)` от body → видим на фоне карточки
3. **Не бамп версии** → WebView грузит старый кэш → изменения не видны
4. **`var(--card)` как фон у hero-секции** → при изменении темы текст становится невидимым (светлый текст на светлом фоне). Решение: явный `color: var(--ink)` inline
