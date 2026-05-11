"""Парсер Wildberries — через их JSON API.

Endpoint search.wb.ru отдаёт чистый JSON с товарами. Цены в копейках/u
(делим на 100). У товаров есть rating, feedbacks (отзывы), brand.

Цена /salePriceU/ — итоговая со скидкой, /priceU/ — RRP.
"""
from __future__ import annotations
import logging
from typing import Any
from urllib.parse import quote_plus

import httpx

from .. import proxy_pool

log = logging.getLogger("zov.parser.wb")

# WB обновил API: v9 → v18 (2026). Новый формат: products на верхнем уровне.
_SEARCH_URL = "https://search.wb.ru/exactmatch/ru/common/v18/search"
_DEFAULT_PARAMS = {
    "TestGroup": "no_test",
    "TestID": "no_test",
    "appType": "1",
    "curr": "rub",
    "dest": "-1257786",  # Москва (можно подменить, нам это не критично)
    "resultset": "catalog",
    "sort": "popular",
    "spp": "30",
    "suppressSpellcheck": "false",
}
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "ru-RU,ru;q=0.9",
    "Origin": "https://www.wildberries.ru",
    "Referer": "https://www.wildberries.ru/",
}


def search_wb(query: str, limit: int = 3, timeout: float = 12.0,
              max_retries: int = 2) -> list[dict[str, Any]]:
    """WB через прямой JSON API. Делает экспоненциальный backoff при 429.

    Пробует несколько вариантов запроса (full → brand+model → brand only)
    чтобы повысить вероятность найти товар."""
    # Генерируем варианты запросов от точного к широкому
    queries = _generate_query_variants(query)
    for q in queries:
        results = _search_wb_one(q, limit=limit, timeout=timeout, max_retries=max_retries)
        if results:
            return results
    return []


def _generate_query_variants(query: str) -> list[str]:
    """Из 'Bosch Serie 4 KGN39NW00R холодильник' делаем варианты от specific к general:
       1. Bosch Serie 4 KGN39NW00R холодильник  (исходный)
       2. Bosch KGN39NW00R                      (brand + model)
       3. KGN39NW00R                            (только индекс)
       4. Bosch холодильник                     (brand + category — последний шанс)
    """
    import re
    variants = [query]
    parts = query.split()
    # Находим модель-индекс (буквы + цифры, длина ≥4)
    model_idx = None
    for p in parts:
        if re.search(r"\d", p) and re.search(r"[a-zA-Z]", p) and len(p) >= 4:
            model_idx = p
            break
    brand = parts[0] if parts else ""

    # Категории-ключевые слова на русском
    cat_words = {
        "холодильник", "холодильника", "варочная", "духовой", "духовка", "плита",
        "посудомоечная", "вытяжка", "микроволновая", "свч", "кофемашина", "стиральная",
        "морозильник", "морозильная",
    }
    cat_in_query = next((w for w in parts if w.lower() in cat_words), None)

    if brand and model_idx:
        variants.append(f"{brand} {model_idx}")
        variants.append(model_idx)

    # Brand + category — широкий fallback
    if brand and cat_in_query and f"{brand} {cat_in_query}" not in variants:
        variants.append(f"{brand} {cat_in_query}")

    return list(dict.fromkeys(variants))


def _search_wb_one(query: str, limit: int, timeout: float, max_retries: int) -> list[dict[str, Any]]:
    """Один запрос к WB API."""
    import time
    params = {**_DEFAULT_PARAMS, "query": query}

    backoff = 2.0
    for attempt in range(max_retries + 1):
        try:
            # Используем прямое подключение (без прокси) — WB лимитирует per-IP,
            # но 1 запрос/несколько секунд проходит
            with proxy_pool.proxied_client(timeout=timeout, headers=_HEADERS) as client:
                resp = client.get(_SEARCH_URL, params=params)
        except httpx.HTTPError as e:
            log.warning("WB request failed (attempt %d): %s", attempt + 1, e)
            time.sleep(backoff)
            backoff *= 2
            continue

        if resp.status_code == 429:
            log.warning("WB rate-limited on attempt %d, sleeping %.1fs", attempt + 1, backoff)
            time.sleep(backoff)
            backoff *= 2
            continue
        if resp.status_code != 200:
            log.warning("WB returned status=%s", resp.status_code)
            return []

        try:
            data = resp.json()
        except Exception as e:
            log.warning("WB JSON parse failed: %s", e)
            return []

        # WB v18: products на верхнем уровне; v9 (legacy fallback): data.products
        products = data.get("products") or (data.get("data") or {}).get("products") or []
        if not products:
            log.info("WB no products for query=%r", query)
            return []

        return [_build_item(p) for p in products[:limit]]

    log.warning("WB gave up after %d attempts for query=%r", max_retries + 1, query)
    return []


def _build_item(p: dict[str, Any]) -> dict[str, Any]:
    """Парсит product из WB API.
    v9: salePriceU / priceU (в копейках, делим на 100)
    v18: sizes[0].price.{basic, product, total} (в копейках)
    """
    price_min = None
    price_max = None

    # v18: цены в sizes[].price.{product, total, basic}
    sizes = p.get("sizes") or []
    size_prices = []
    for s in sizes:
        pr = s.get("price") or {}
        # Приоритет: product (с учётом скидки) > total > basic
        for fld in ("product", "total", "basic"):
            v = pr.get(fld) or 0
            if v:
                size_prices.append(v // 100)
                break
    if size_prices:
        price_min = min(size_prices)
        if len(size_prices) > 1 and max(size_prices) != price_min:
            price_max = max(size_prices)

    # v9 fallback — только если ничего не нашли в sizes
    if price_min is None:
        sale_u = p.get("salePriceU") or 0
        price_u = p.get("priceU") or 0
        price_min = (sale_u // 100) if sale_u else (price_u // 100 if price_u else None)
        if price_u and price_u != sale_u:
            price_max = price_u // 100

    pid = p.get("id")
    image_url = _build_image_url(pid) if pid else None

    return {
        "title": p.get("name") or "",
        "url": f"https://www.wildberries.ru/catalog/{pid}/detail.aspx" if pid else "",
        "image_url": image_url,
        "price_min_rub": price_min,
        "price_max_rub": price_max if price_max and price_max != price_min else None,
        "rating": p.get("reviewRating") or p.get("rating"),
        "reviews_count": p.get("feedbacks"),
        "stores_count": None,
        "specs": {
            "brand": p.get("brand", ""),
            "supplier": p.get("supplier", ""),
        },
        "source": "wb",
    }


def _build_image_url(product_id: int) -> str:
    """WB хранит фото на nm-1..20.wbbasket.ru. URL зависит от диапазона id."""
    pid = int(product_id)
    short = pid // 100000
    # Маппинг WB корзин (упрощённый)
    if   pid < 144_000_000: basket = (short // 1431) + 1
    elif pid < 287_000_000: basket = (short // 1431) + 1
    else:                   basket = (short // 1431) + 1
    # Безопасный fallback — basket 10 покрывает почти все ID
    if basket < 1 or basket > 25:
        basket = 10
    bn = str(basket).zfill(2)
    vol = pid // 100000
    part = pid // 1000
    return f"https://basket-{bn}.wbbasket.ru/vol{vol}/part{part}/{pid}/images/big/1.webp"
