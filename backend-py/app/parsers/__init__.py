"""Парсеры маркетплейсов для обогащения карточек моделей.

Подход MVP: парсим публичные HTML-страницы напрямую с VPS (без прокси).
При обнаружении anti-bot блокировок — переходим на резидентные прокси (Proxy6).

Источники:
- dns.py — DNS Shop (dns-shop.ru) — самый простой anti-bot, основной источник характеристик
- yamarket.py — Я.Маркет (market.yandex.ru) — для сравнения цен между магазинами
- wildberries.py — Wildberries (wildberries.ru) — для отзывов и рейтингов

Унифицированный формат результата:
{
    "title": str,                # Название как на странице
    "url": str,                  # Ссылка на товар
    "image_url": str | None,     # URL основного фото
    "price_min_rub": int | None, # Минимальная найденная цена
    "price_max_rub": int | None, # Максимальная (если есть данные по нескольким магазинам)
    "rating": float | None,      # 0.0 - 5.0
    "reviews_count": int | None, # Кол-во отзывов
    "stores_count": int | None,  # На скольких сайтах найдено (Я.Маркет)
    "specs": dict[str, str],     # Ключевые характеристики
    "source": str,               # "dns" / "yamarket" / "wildberries"
}
"""
from .dns import search_dns

__all__ = ["search_dns"]
