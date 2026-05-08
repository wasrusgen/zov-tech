# ZOV Tech — AI-подбор кухонной техники

Telegram-бот + MiniApp для подбора техники под кухню фабрики ЗОВ.
Менеджер заполняет с клиентом чек-лист → нейросеть собирает предложение → менеджер получает результат за минуту.

## Структура

```
zov-tech/
├── bot/         — Telegram-бот (Python + aiogram)
├── miniapp/     — MiniApp (HTML + JS, хост на GitHub Pages)
├── backend/     — Google Apps Script (бэкенд + работа с Sheets)
├── docs/        — Документация (ТЗ, deployment, decisions)
└── .claude/     — настройки Claude Code (вне репо)
```

## Стек

| Слой | Технология |
|---|---|
| Бот | Python 3.10+, aiogram 3.x |
| AI | Anthropic Claude (Haiku 4.5) |
| MiniApp | Vanilla JS + HTML, без сборки |
| Backend | Google Apps Script (Web App) |
| БД | Google Sheets (на старте), PostgreSQL (после роста) |
| Хостинг бота | VPS (Selectel / Timeweb) |
| Хостинг MiniApp | GitHub Pages |

## Быстрый старт (когда будет код)

```bash
cd bot
python -m venv .venv
.venv\Scripts\activate    # Windows
pip install -r requirements.txt
copy .env.example .env    # заполнить токены
python main.py
```

## Документация

- [Техническое задание](docs/ТЗ_ЗОВ_Бот_MiniApp_v1.md) — полное ТЗ продукта.

## Контакты

Куратор / заказчик: Василий ([@wasrusgen](https://t.me/wasrusgen))
Канал: [@wasrusgen1](https://t.me/wasrusgen1)
