"""Парсеры маркетплейсов для обогащения карточек моделей.

Все парсеры используют общий proxy_pool (Proxy6.net), если PROXY6_TOKEN задан.
Без прокси крупные маркетплейсы РФ (DNS, OZON, Я.Маркет) возвращают 401/307.

Источники:
- dns.py      — DNS Shop      (характеристики, цена одного магазина)
- wb.py       — Wildberries   (JSON API, цена + отзывы + рейтинг)
- ozon.py     — OZON          (composer-api JSON)
- yamarket.py — Я.Маркет      (HTML + встроенный JSON, сравнение цен)

Унифицированный формат результата (item):
{
    "title": str,                # Название как на странице
    "url": str,                  # Ссылка на товар
    "image_url": str | None,     # URL основного фото
    "price_min_rub": int | None,
    "price_max_rub": int | None,
    "rating": float | None,      # 0.0 - 5.0
    "reviews_count": int | None,
    "stores_count": int | None,  # Только Я.Маркет (сравнение)
    "specs": dict[str, str],
    "source": str,               # 'dns' | 'wb' | 'ozon' | 'yamarket'
}
"""
from __future__ import annotations
import logging
import time
from typing import Any

from .dns import search_dns
from .wb import search_wb
from .ozon import search_ozon
from .yamarket import search_yamarket
from .citilink import search_citilink

log = logging.getLogger("zov.parser")

__all__ = ["search_dns", "search_wb", "search_ozon", "search_yamarket", "search_citilink",
           "enrich_one", "enrich_models"]

# Источники по умолчанию (работают с DC-IP без прокси):
# - ozon, citilink: Playwright
# - wb: прямой JSON API (с задержкой)
# Опциональные (требуют residential proxy):
# - yamarket, dns
DEFAULT_SOURCES = ("ozon", "citilink", "wb")


def enrich_one(query: str, sources: tuple = DEFAULT_SOURCES) -> dict[str, Any]:
    """Спрашивает все указанные источники и объединяет лучшее в единый отчёт.

    Возвращает:
    {
        "wb":       {item dict} или None,
        "ozon":     {item dict} или None,
        "yamarket": {item dict} или None,
        "dns":      {item dict} или None,
        "price_min_rub": int | None,    # минимум по всем источникам
        "price_max_rub": int | None,
        "image_url": str | None,
        "rating_max": float | None,
        "reviews_total": int | None,
        "stores_count": int | None,     # макс. из yamarket
        "best_url": str | None,
    }
    """
    fetchers = {
        "wb":       lambda: _safe_first(search_wb, query),
        "ozon":     lambda: _safe_first(search_ozon, query),
        "citilink": lambda: _safe_first(search_citilink, query),
        "yamarket": lambda: _safe_first(search_yamarket, query),
        "dns":      lambda: _safe_first(search_dns, query),
    }

    items: dict[str, dict] = {}
    for src in sources:
        fn = fetchers.get(src)
        if not fn:
            continue
        try:
            items[src] = fn()
        except Exception as e:
            log.warning("Source %s failed for %r: %s", src, query, e)
            items[src] = None

    # Агрегация
    prices = [i["price_min_rub"] for i in items.values() if i and i.get("price_min_rub")]
    images = [i["image_url"]     for i in items.values() if i and i.get("image_url")]
    ratings = [i["rating"]       for i in items.values() if i and i.get("rating")]
    reviews = [i["reviews_count"] for i in items.values() if i and i.get("reviews_count")]

    # Я.Маркет даёт количество магазинов
    stores = None
    if items.get("yamarket") and items["yamarket"].get("stores_count"):
        stores = items["yamarket"]["stores_count"]

    best_url = None
    # Приоритет: ozon → citilink → wb → yamarket → dns
    for src in ("ozon", "citilink", "wb", "yamarket", "dns"):
        i = items.get(src)
        if i and i.get("url"):
            best_url = i["url"]
            break

    return {
        **{src: items.get(src) for src in fetchers.keys()},
        "price_min_rub": min(prices) if prices else None,
        "price_max_rub": max(prices) if prices else None,
        "image_url": images[0] if images else None,
        "rating_max": max(ratings) if ratings else None,
        "reviews_total": sum(reviews) if reviews else None,
        "stores_count": stores,
        "best_url": best_url,
    }


def enrich_models(models: list[dict[str, Any]], delay_sec: float = 0.5,
                  sources: tuple = DEFAULT_SOURCES) -> list[dict[str, Any]]:
    """Обогащает список моделей от AI данными со всех источников."""
    enriched: list[dict[str, Any]] = []
    for i, m in enumerate(models):
        q = m.get("search_query") or f"{m.get('brand', '')} {m.get('model', '')}".strip()
        if not q:
            enriched.append({**m, "enriched": None})
            continue
        try:
            data = enrich_one(q, sources=sources)
        except Exception as e:
            log.warning("Enrich failed for %r: %s", q, e)
            data = None
        enriched.append({**m, "enriched": data})
        if i < len(models) - 1 and delay_sec > 0:
            time.sleep(delay_sec)
    return enriched


def _safe_first(search_fn, query: str) -> dict[str, Any] | None:
    """Вызывает поиск и возвращает первый результат или None."""
    results = search_fn(query, limit=1)
    return results[0] if results else None
