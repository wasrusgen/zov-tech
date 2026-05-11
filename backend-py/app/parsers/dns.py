"""Парсер DNS Shop (dns-shop.ru) — MVP без anti-bot защиты.

DNS отдаёт классический HTML с серверным рендерингом + AJAX-цены через
GraphQL. Для нашего MVP достаточно поисковой страницы — там есть title,
URL, картинка и цена в data-атрибутах карточки товара.

Если DNS изменит вёрстку — селекторы ниже придётся обновить.
"""
from __future__ import annotations
import logging
import re
import time
from typing import Any
from urllib.parse import quote_plus

import httpx
from bs4 import BeautifulSoup

from .. import proxy_pool
from . import playwright_engine

log = logging.getLogger("zov.parser.dns")

_BASE_URL = "https://www.dns-shop.ru"
_SEARCH_URL = "https://www.dns-shop.ru/search/"

# Реалистичный User-Agent (свежий Chrome on Windows)
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/130.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
}

_PRICE_RE = re.compile(r"(\d[\d\s]*)\s*₽")


def search_dns(query: str, limit: int = 1, timeout: float = 30.0,
               max_retries: int = 1) -> list[dict[str, Any]]:
    """Поиск на DNS через Playwright + residential proxy.

    DNS защищён Qrator (JS challenge) — обычный HTTP не пройдёт даже с прокси.
    Playwright решает challenge автоматически (как реальный браузер).
    """
    url = f"{_SEARCH_URL}?q={quote_plus(query)}"
    log.info("DNS search: %s", url)

    html = None
    for attempt in range(max_retries + 1):
        html = playwright_engine.fetch_page(
            url,
            wait_selector="a[href*='/product/']",
            wait_ms=5000,
            timeout_ms=int(timeout * 1000),
        )
        if html:
            break

    if not html:
        log.warning("DNS: no HTML for query=%r", query)
        return []
    if "qrator" in html.lower()[:5000]:
        log.warning("DNS: Qrator block for query=%r", query)
        return []

    return _parse_search_html(html, limit=limit)


def _parse_search_html(html: str, limit: int) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict[str, Any]] = []

    # DNS использует разные шаблоны карточек. Пробуем несколько селекторов.
    candidates = (
        soup.select("div.catalog-product")
        or soup.select("[data-product-card]")
        or soup.select("div.product-buy")
    )

    for card in candidates:
        if len(results) >= limit:
            break
        item = _extract_card(card)
        if item:
            results.append(item)

    if not results:
        # Резерв: попытаемся достать товар из JSON-LD
        for script in soup.find_all("script", type="application/ld+json"):
            data = _try_json(script.string or "")
            if not data:
                continue
            items = data if isinstance(data, list) else [data]
            for d in items:
                if isinstance(d, dict) and d.get("@type") == "Product":
                    results.append({
                        "title": d.get("name") or "",
                        "url": d.get("url") or "",
                        "image_url": (d.get("image") or [None])[0] if isinstance(d.get("image"), list) else d.get("image"),
                        "price_min_rub": _try_int((d.get("offers") or {}).get("price")),
                        "price_max_rub": None,
                        "rating": _try_float((d.get("aggregateRating") or {}).get("ratingValue")),
                        "reviews_count": _try_int((d.get("aggregateRating") or {}).get("reviewCount")),
                        "stores_count": None,
                        "specs": {},
                        "source": "dns",
                    })
                    if len(results) >= limit:
                        break
            if len(results) >= limit:
                break

    return results


def _extract_card(card) -> dict[str, Any] | None:
    """Извлекает данные карточки товара из произвольного блока."""
    # Заголовок и ссылка
    link_el = (
        card.select_one("a.catalog-product__name")
        or card.select_one("a.product-buy__title")
        or card.select_one("a[href*='/product/']")
    )
    if not link_el:
        return None
    title = link_el.get_text(strip=True) or link_el.get("title") or ""
    href = link_el.get("href") or ""
    url = href if href.startswith("http") else f"{_BASE_URL}{href}"

    # Цена
    price = None
    price_el = (
        card.select_one(".product-buy__price")
        or card.select_one("[data-price]")
        or card.select_one(".product-min-price__current")
    )
    if price_el:
        # data-price атрибут — самый надёжный
        dp = price_el.get("data-price") or price_el.get("data-product-price")
        if dp:
            price = _try_int(dp)
        if not price:
            m = _PRICE_RE.search(price_el.get_text(" ", strip=True))
            if m:
                price = _try_int(m.group(1).replace(" ", ""))

    # Изображение
    img_url = None
    img_el = card.select_one("img.catalog-product__image, img.loaded-product__image, img[data-src], img[src]")
    if img_el:
        img_url = img_el.get("data-src") or img_el.get("src") or img_el.get("data-original")
        if img_url and img_url.startswith("//"):
            img_url = "https:" + img_url

    # Рейтинг и кол-во отзывов
    rating = None
    rating_el = card.select_one(".catalog-product__rating, [data-rating]")
    if rating_el:
        rating = _try_float(rating_el.get("data-rating") or rating_el.get_text(strip=True))

    reviews = None
    reviews_el = card.select_one(".catalog-product__reviews, [data-reviews]")
    if reviews_el:
        m = re.search(r"\d+", reviews_el.get_text(" ", strip=True))
        if m:
            reviews = int(m.group(0))

    if not title:
        return None

    return {
        "title": title,
        "url": url,
        "image_url": img_url,
        "price_min_rub": price,
        "price_max_rub": price,  # DNS показывает одну цену
        "rating": rating,
        "reviews_count": reviews,
        "stores_count": 1,
        "specs": {},
        "source": "dns",
    }


def _try_int(v: Any) -> int | None:
    if v is None:
        return None
    try:
        s = str(v).strip().replace(" ", "").replace(" ", "").replace(",", ".")
        # Цена может быть строкой "79990" или "79990.00"
        return int(float(s))
    except (ValueError, TypeError):
        return None


def _try_float(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(str(v).strip().replace(",", "."))
    except (ValueError, TypeError):
        return None


def _try_json(s: str) -> Any:
    import json
    try:
        return json.loads(s)
    except (ValueError, TypeError):
        return None


def enrich_models(models: list[dict[str, Any]], delay_sec: float = 0.5) -> list[dict[str, Any]]:
    """Обогащает список моделей данными с DNS.

    На входе: список моделей от AI с полем `search_query` (или brand+model).
    На выходе: те же модели + ключи `dns: {...}` с парсингом.
    """
    enriched: list[dict[str, Any]] = []
    for i, m in enumerate(models):
        q = m.get("search_query") or f"{m.get('brand', '')} {m.get('model', '')}".strip()
        if not q:
            enriched.append({**m, "dns": None})
            continue
        try:
            results = search_dns(q, limit=1)
        except Exception as e:
            log.warning("DNS enrich failed for %r: %s", q, e)
            results = []
        enriched.append({**m, "dns": results[0] if results else None})
        if i < len(models) - 1 and delay_sec > 0:
            time.sleep(delay_sec)  # вежливая задержка между запросами
    return enriched
