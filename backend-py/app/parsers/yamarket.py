"""Парсер Я.Маркета — HTML страница поиска.

Я.Маркет защищён Qrator. Через резидентный РФ-IP + правильные заголовки
+ cookies на сессию обычно проходит. Без прокси — 401.

Из HTML вытаскиваем JSON, который Я.Маркет встраивает в <script type="application/json">.
"""
from __future__ import annotations
import json
import logging
import re
from typing import Any
from urllib.parse import quote_plus

import httpx
from bs4 import BeautifulSoup

from .. import proxy_pool

log = logging.getLogger("zov.parser.yamarket")

_BASE_URL = "https://market.yandex.ru"
_SEARCH_URL = "https://market.yandex.ru/search"

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}

_PRICE_RE = re.compile(r"(\d[\d\s]*)\s*₽")


def search_yamarket(query: str, limit: int = 3, timeout: float = 20.0,
                    max_retries: int = 2) -> list[dict[str, Any]]:
    """Поиск товара в Я.Маркете. Возвращает топ-N с ценами и кол-вом магазинов."""
    params = {"text": query, "cvredirect": "2"}

    for attempt in range(max_retries + 1):
        try:
            with proxy_pool.proxied_client(timeout=timeout, headers=_HEADERS,
                                            follow_redirects=True) as client:
                resp = client.get(_SEARCH_URL, params=params)
        except httpx.HTTPError as e:
            log.warning("YaMarket request failed (attempt %d): %s", attempt + 1, e)
            continue

        if resp.status_code != 200:
            log.warning("YaMarket status=%s on attempt %d", resp.status_code, attempt + 1)
            continue

        text = resp.text
        if "qrator" in text.lower() or "showcaptcha" in text.lower():
            log.warning("YaMarket Qrator/captcha on attempt %d, rotating proxy", attempt + 1)
            continue

        return _parse_html(text, limit=limit)

    log.warning("YaMarket gave up after %d attempts for query=%r", max_retries + 1, query)
    return []


def _parse_html(html: str, limit: int) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict[str, Any]] = []

    # Я.Маркет встраивает данные в JSON внутри скриптов
    for script in soup.find_all("script", type="application/json"):
        data = _try_json(script.string or "")
        if not data:
            continue
        # Структуры разные; ищем массив с offers/products
        items = _find_products(data)
        for it in items:
            if len(results) >= limit:
                break
            item = _build_item(it)
            if item:
                results.append(item)
        if len(results) >= limit:
            break

    # Резервный путь — карточки прямо в HTML
    if not results:
        cards = soup.select("[data-zone-name='snippet-card'], [data-baobab-name='card']")
        for card in cards:
            if len(results) >= limit:
                break
            item = _extract_html_card(card)
            if item:
                results.append(item)

    return results


def _find_products(data: Any, _depth: int = 0) -> list[dict]:
    """Рекурсивно ищем массив товаров в JSON Я.Маркета."""
    if _depth > 8:
        return []
    if isinstance(data, list):
        # Эвристика: список объектов с offers/price/title
        if data and isinstance(data[0], dict) and (
            data[0].get("offers") or data[0].get("prices") or data[0].get("titles")
        ):
            return data
        for item in data:
            found = _find_products(item, _depth + 1)
            if found:
                return found
    elif isinstance(data, dict):
        for v in data.values():
            found = _find_products(v, _depth + 1)
            if found:
                return found
    return []


def _build_item(p: dict) -> dict[str, Any] | None:
    title_obj = p.get("titles") or {}
    title = (title_obj.get("raw") if isinstance(title_obj, dict) else "") or p.get("title", "")
    if not title:
        return None

    url_obj = p.get("url") or p.get("urls", {}).get("encrypted", "")
    url = url_obj if isinstance(url_obj, str) else ""
    if url and url.startswith("/"):
        url = f"{_BASE_URL}{url}"

    pic = ""
    pictures = p.get("pictures") or []
    if pictures and isinstance(pictures, list):
        pic_obj = pictures[0]
        if isinstance(pic_obj, dict):
            pic = pic_obj.get("original", {}).get("url") or pic_obj.get("url") or ""

    # Цена + кол-во магазинов
    prices = p.get("prices") or p.get("offers") or {}
    price_min = price_max = None
    stores = None
    if isinstance(prices, dict):
        price_min = _try_int(prices.get("min", {}).get("value") if isinstance(prices.get("min"), dict) else prices.get("min"))
        price_max = _try_int(prices.get("max", {}).get("value") if isinstance(prices.get("max"), dict) else prices.get("max"))
        stores = _try_int(prices.get("count") or prices.get("offersCount"))

    rating = _try_float((p.get("rating") or {}).get("value") if isinstance(p.get("rating"), dict) else p.get("rating"))
    reviews = _try_int((p.get("reviews") or {}).get("count") if isinstance(p.get("reviews"), dict) else p.get("reviews"))

    return {
        "title": re.sub(r"<[^>]+>", "", title).strip(),
        "url": url,
        "image_url": pic,
        "price_min_rub": price_min,
        "price_max_rub": price_max if price_max and price_max != price_min else None,
        "rating": rating,
        "reviews_count": reviews,
        "stores_count": stores,
        "specs": {},
        "source": "yamarket",
    }


def _extract_html_card(card) -> dict[str, Any] | None:
    """Резервный парсинг HTML-карточки если JSON не нашёлся."""
    title_el = card.select_one("[data-zone-name='title'] span, h3, [class*='Title']")
    if not title_el:
        return None
    title = title_el.get_text(strip=True)

    price_el = card.select_one("[data-auto='snippet-price-current'], [class*='Price']")
    price = None
    if price_el:
        m = _PRICE_RE.search(price_el.get_text(" ", strip=True))
        if m:
            price = _try_int(m.group(1).replace(" ", ""))

    img_el = card.select_one("img[srcset], img[src]")
    img_url = ""
    if img_el:
        src = img_el.get("src") or img_el.get("data-src") or ""
        if src.startswith("//"):
            src = "https:" + src
        img_url = src

    link_el = card.select_one("a[href*='/product--'], a[data-baobab-name='title']")
    url = ""
    if link_el:
        href = link_el.get("href") or ""
        url = href if href.startswith("http") else f"{_BASE_URL}{href}"

    if not title:
        return None
    return {
        "title": title,
        "url": url,
        "image_url": img_url,
        "price_min_rub": price,
        "price_max_rub": None,
        "rating": None,
        "reviews_count": None,
        "stores_count": None,
        "specs": {},
        "source": "yamarket",
    }


def _try_int(v: Any) -> int | None:
    if v is None:
        return None
    try:
        return int(float(str(v).replace(" ", "").replace(",", ".")))
    except (ValueError, TypeError):
        return None


def _try_float(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(str(v).replace(" ", "").replace(",", "."))
    except (ValueError, TypeError):
        return None


def _try_json(s: str) -> Any:
    try:
        return json.loads(s)
    except (ValueError, TypeError):
        return None
