"""Парсер Citilink (citilink.ru) — через Playwright.

Citilink — крупный российский магазин электроники. Работает с DC-IP, не требует
прокси. Товары — `a[href*='/product/']`, ближайший родительский div — карточка.
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
_PRICE_RE = re.compile(r"(\d[\d\s  ]+)\s*₽")


def search_citilink(query: str, limit: int = 3, timeout: float = 35.0,
                    max_retries: int = 1) -> list[dict[str, Any]]:
    """Поиск товара на Citilink через Playwright."""
    url = f"{_SEARCH_URL}?text={quote_plus(query)}"

    html = None
    for attempt in range(max_retries + 1):
        html = playwright_engine.fetch_page(
            url,
            wait_selector="a[href*='/product/']",
            wait_ms=8000,  # товары грузятся через XHR, нужна пауза
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
    seen_urls = set()

    for link in soup.select("a[href*='/product/']"):
        if len(results) >= limit:
            break
        href = link.get("href") or ""
        # Пропускаем подстраницы того же товара (/otzyvy/, /opisanie/ и т.п.)
        if not re.search(r"/product/[^/]+/?$", href.split("?")[0]):
            continue
        # Извлекаем product ID для надёжного дедупа
        m = re.search(r"-(\d+)/?$", href.split("?")[0])
        product_id = m.group(1) if m else href.split("?")[0]
        if product_id in seen_urls:
            continue
        seen_urls.add(product_id)

        # Финальный URL — БЕЗ query params (sponsored / cpc / tracking)
        href_clean = href.split("?")[0]
        full_url = href_clean if href_clean.startswith("http") else f"{_BASE_URL}{href_clean}"

        # Поднимаемся к родительской карточке — у Citilink CSS-in-JS, поэтому
        # ищем ближайший div, в котором есть и цена и название
        card = link.find_parent("div")
        if not card:
            continue
        # Если в этом div'е нет цены — поднимемся ещё выше
        for _ in range(3):
            if "₽" in card.get_text():
                break
            parent = card.find_parent("div")
            if not parent:
                break
            card = parent

        item = _extract_card(card, full_url)
        if item:
            results.append(item)

    return results


def _extract_card(card, url: str) -> dict[str, Any] | None:
    """Из карточки достаём название, цену, картинку."""
    full_text = card.get_text(" ", strip=True)

    # Цена
    price = None
    for m in _PRICE_RE.finditer(full_text):
        raw = m.group(1).replace(" ", "").replace(" ", "").replace(" ", "")
        try:
            v = int(raw)
            if 1000 < v < 10_000_000:
                price = v
                break
        except ValueError:
            pass

    # Название — ищем по типу «Холодильник Bosch KGN…»
    # Citilink обычно выделяет название в отдельном span внутри карточки
    title = ""
    # Сначала пробуем явные селекторы
    for sel in [
        "[data-meta-name*='Snippet__title']",
        "[data-meta-name*='title']",
        "a[href*='/product/']",
        "h2", "h3",
    ]:
        el = card.select_one(sel)
        if el:
            t = (el.get("title") or el.get_text(strip=True)).strip()
            if t and len(t) > 10:
                title = t
                break
    # Резерв: ищем самый длинный текстовый span без цены/процентов
    if not title:
        candidates = []
        for s in card.find_all(["span", "div", "a"]):
            t = s.get_text(" ", strip=True)
            if 15 < len(t) < 200 and "₽" not in t and "%" not in t and "Рассрочка" not in t and "просмотр" not in t.lower():
                candidates.append(t)
        if candidates:
            # Самый «осмысленный» — содержащий «Холодильник», «Bosch» и т.п. + достаточно длинный
            candidates.sort(key=len, reverse=True)
            title = candidates[0]
    if not title or len(title) < 10:
        return None

    # Картинка — пробуем разные источники: src, data-src, srcset
    img_url = None
    for img_el in card.find_all("img"):
        # Источники в порядке приоритета
        candidates = []
        for attr in ("data-src", "data-original", "data-srcset", "srcset", "src"):
            val = img_el.get(attr) or ""
            if not val:
                continue
            if attr in ("srcset", "data-srcset"):
                # Берём самый большой размер (последний в srcset)
                parts = val.split(",")
                if parts:
                    largest = parts[-1].strip().split(" ")[0]
                    candidates.append(largest)
            else:
                candidates.append(val)

        for src in candidates:
            if not src or "data:image" in src:
                continue
            if src.startswith("//"):
                src = "https:" + src
            # Отсеиваем placeholder'ы Next.js (всегда заглушки)
            if "_next/static/images" in src or "placeholder" in src.lower():
                continue
            # Реальные товарные фото — обычно на cs.citilink.ru / c.citilink.ru / images.citilink.ru
            img_url = src
            break
        if img_url:
            break

    # Рейтинг
    rating = None
    m = re.search(r"(\d[.,]\d)\s*[\\(\d]", full_text)
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
