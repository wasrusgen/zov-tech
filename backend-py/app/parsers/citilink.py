"""Парсер Citilink (citilink.ru) — через Playwright.

Citilink — крупный российский магазин электроники. Работает с DC-IP, не требует
прокси. Карточки помечены `data-meta-name=ProductCard...` или `data-meta-name=Snippet...`.
"""
from __future__ import annotations
import logging
import re
from typing import Any
from urllib.parse import quote_plus

from bs4 import BeautifulSoup

from . import playwright_engine

log = logging.getLogger("zov.parser.citilink")

_BASE_URL = "https://www.citilink.ru"
_SEARCH_URL = "https://www.citilink.ru/search/"
_PRICE_RE = re.compile(r"(\d[\d\s  ]+)\s*₽|(\d[\d\s  ]+)\s*руб")


def search_citilink(query: str, limit: int = 3, timeout: float = 30.0,
                    max_retries: int = 1) -> list[dict[str, Any]]:
    """Поиск товара на Citilink через Playwright."""
    url = f"{_SEARCH_URL}?text={quote_plus(query)}"

    html = None
    for attempt in range(max_retries + 1):
        html = playwright_engine.fetch_page(
            url,
            wait_selector="[data-meta-name*='Snippet'], [data-meta-name*='ProductCard']",
            wait_ms=4000,
            timeout_ms=int(timeout * 1000),
        )
        if html:
            break

    if not html:
        log.warning("Citilink: no HTML for query=%r", query)
        return []

    return _parse_html(html, limit=limit)


def _parse_html(html: str, limit: int) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict[str, Any]] = []

    # Карточки товаров
    cards = (
        soup.select("[data-meta-name*='Snippet']")
        or soup.select("[data-meta-name*='ProductCard']")
        or soup.select("div.ProductCardHorizontal")
    )

    for card in cards:
        if len(results) >= limit:
            break
        item = _extract_card(card)
        if item:
            results.append(item)

    return results


def _extract_card(card) -> dict[str, Any] | None:
    """Достаём title, url, цену, картинку, рейтинг, отзывы."""
    # Ссылка на товар
    link = card.select_one("a[href*='/product/']") or card.find("a", href=True)
    if not link:
        return None
    href = link.get("href") or ""
    if "/product/" not in href and "/promo/" not in href:
        return None
    url = href if href.startswith("http") else f"{_BASE_URL}{href}"

    # Название
    title = ""
    # Citilink использует разные классы — пробуем несколько
    for sel in [
        "[data-meta-name*='Snippet__title']",
        "[data-meta-name*='ProductCardHorizontal__title']",
        "a[href*='/product/'] span",
        "a[title]",
    ]:
        el = card.select_one(sel)
        if el:
            title = (el.get("title") or el.get_text(strip=True)).strip()
            if title and len(title) > 5:
                break
    if not title:
        # Резерв — длинный текст в карточке
        for s in card.find_all(["span", "div"]):
            t = s.get_text(strip=True)
            if t and 15 < len(t) < 200 and "₽" not in t and "%" not in t:
                title = t
                break
    if not title or len(title) < 5:
        return None

    full_text = card.get_text(" ", strip=True)

    # Цена
    price = None
    for m in _PRICE_RE.finditer(full_text):
        raw = (m.group(1) or m.group(2) or "").replace(" ", "").replace(" ", "").replace(" ", "")
        try:
            v = int(raw)
            if 100 < v < 10_000_000:  # разумные пределы
                price = v
                break
        except ValueError:
            pass

    # Картинка
    img_url = None
    img_el = card.find("img")
    if img_el:
        src = img_el.get("src") or img_el.get("data-src") or ""
        if src and "data:image" not in src:
            if src.startswith("//"):
                src = "https:" + src
            img_url = src

    # Рейтинг
    rating = None
    m = re.search(r"(\d[.,]\d)\s*[\\(\\d]", full_text)
    if m:
        try:
            r = float(m.group(1).replace(",", "."))
            if 0 < r <= 5.0:
                rating = r
        except ValueError:
            pass

    # Отзывы
    reviews = None
    m = re.search(r"(\d[\d\s]*)\s*(?:отзыв|оценок)", full_text)
    if m:
        try:
            reviews = int(m.group(1).replace(" ", "").replace(" ", ""))
        except ValueError:
            pass

    return {
        "title": title[:250],
        "url": url,
        "image_url": img_url,
        "price_min_rub": price,
        "price_max_rub": None,
        "rating": rating,
        "reviews_count": reviews,
        "stores_count": None,
        "specs": {},
        "source": "citilink",
    }
