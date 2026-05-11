"""Парсер Я.Маркета — через Playwright (рендер JS).

Я.Маркет — SPA на React, товары подгружаются через XHR после первой загрузки.
Простой HTTP-запрос не вернёт каталог. Поэтому используем headless Chromium.

Ждём пока в DOM появятся карточки `[data-zone-name="snippet-card"]` или
`a[href*="/product--"]`, потом извлекаем данные.
"""
from __future__ import annotations
import logging
import re
from typing import Any
from urllib.parse import quote_plus

from bs4 import BeautifulSoup

from . import playwright_engine

log = logging.getLogger("zov.parser.yamarket")

_BASE_URL = "https://market.yandex.ru"
_PRICE_RE = re.compile(r"([\d\s]+)\s*₽")


def search_yamarket(query: str, limit: int = 3, timeout: float = 30.0,
                    max_retries: int = 1) -> list[dict[str, Any]]:
    """Поиск товара в Я.Маркете через headless Chromium."""
    url = f"{_BASE_URL}/search?text={quote_plus(query)}"

    html = None
    for attempt in range(max_retries + 1):
        html = playwright_engine.fetch_page(
            url,
            # Ждём появления товарных ссылок или контейнера выдачи
            wait_selector="a[href*='/product--'], [data-auto='SerpItem'], [data-zone-name='snippet-card']",
            wait_ms=3500,
            timeout_ms=int(timeout * 1000),
        )
        if html:
            break

    if not html:
        log.warning("YaMarket: no HTML for query=%r", query)
        return []

    if "showcaptcha" in html.lower() or "qrator" in html.lower()[:5000]:
        log.warning("YaMarket: Qrator/captcha for query=%r", query)
        return []

    return _parse_html(html, limit=limit)


def _parse_html(html: str, limit: int) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict[str, Any]] = []

    # Основной селектор — товарные карточки на странице поиска
    candidates = (
        soup.select("[data-auto='SerpItem']")
        or soup.select("[data-zone-name='snippet-card']")
        or soup.select("article[data-baobab-name='card']")
        or soup.select("article:has(a[href*='/product--'])")
    )

    for card in candidates:
        if len(results) >= limit:
            break
        item = _extract_card(card)
        if item:
            results.append(item)

    # Резерв — собрать по найденным ссылкам product--
    if not results:
        seen = set()
        for a in soup.select("a[href*='/product--']")[:limit * 2]:
            href = a.get("href") or ""
            if href in seen:
                continue
            seen.add(href)
            # Берём родительский article как карточку
            card = a.find_parent("article") or a.find_parent("div")
            if card:
                item = _extract_card(card)
                if item:
                    results.append(item)
                    if len(results) >= limit:
                        break

    return results


def _extract_card(card) -> dict[str, Any] | None:
    """Достаём заголовок, ссылку, цену, рейтинг, отзывы, фото, кол-во магазинов."""
    link_el = (
        card.select_one("a[href*='/product--']")
        or card.select_one("a[data-baobab-name='title']")
    )
    if not link_el:
        return None
    href = link_el.get("href") or ""
    url = href if href.startswith("http") else f"{_BASE_URL}{href}"

    title_el = (
        card.select_one("[data-zone-name='title'] span")
        or card.select_one("h3 span")
        or card.select_one("[data-auto='snippet-title']")
        or link_el
    )
    title = title_el.get_text(strip=True) if title_el else (link_el.get_text(strip=True))
    if not title:
        return None

    # Цена
    price_min = price_max = None
    price_el = (
        card.select_one("[data-auto='snippet-price-current']")
        or card.select_one("[data-auto='price-value']")
        or card.select_one("[class*='Price']")
    )
    if price_el:
        m = _PRICE_RE.search(price_el.get_text(" ", strip=True))
        if m:
            price_min = _try_int(m.group(1).replace(" ", "").replace(" ", ""))

    # Картинка
    img_url = None
    img_el = card.select_one("img[src], img[srcset]")
    if img_el:
        src = img_el.get("src") or img_el.get("data-src") or ""
        # Иногда src — заглушка 1x1px, основное в srcset
        if "data:image" in src or not src:
            srcset = img_el.get("srcset") or ""
            if srcset:
                src = srcset.split(",")[0].strip().split(" ")[0]
        if src.startswith("//"):
            src = "https:" + src
        if src:
            img_url = src

    # Рейтинг
    rating = None
    rating_el = card.select_one("[data-auto='snippet-rating'], [class*='Rating'] span")
    if rating_el:
        rt = rating_el.get_text(strip=True)
        m = re.search(r"\d[.,]\d", rt)
        if m:
            rating = _try_float(m.group(0))

    # Отзывы
    reviews = None
    reviews_el = card.select_one("[data-auto='snippet-feedback'], a[href*='/reviews']")
    if reviews_el:
        m = re.search(r"\d[\d\s]*", reviews_el.get_text(" ", strip=True))
        if m:
            reviews = _try_int(m.group(0).replace(" ", ""))

    # Кол-во магазинов / предложений
    stores = None
    stores_el = card.select_one("[data-auto='offer-count'], a[href*='/offers']")
    if stores_el:
        m = re.search(r"\d+", stores_el.get_text(" ", strip=True))
        if m:
            stores = int(m.group(0))

    return {
        "title": title,
        "url": url,
        "image_url": img_url,
        "price_min_rub": price_min,
        "price_max_rub": price_max if price_max and price_max != price_min else None,
        "rating": rating,
        "reviews_count": reviews,
        "stores_count": stores,
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
