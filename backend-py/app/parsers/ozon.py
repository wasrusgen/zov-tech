"""Парсер OZON — через Playwright (рендер JS).

OZON блокирует прямой HTTP с DC-IP (403/307). С Playwright рендерит обычную
HTML-страницу `/search/?text=…`, в которой есть карточки `a[href*='/product/']`.

В карточке: название, цена, картинка, рейтинг, отзывы — в DOM рядом со ссылкой.
"""
from __future__ import annotations
import logging
import re
from typing import Any
from urllib.parse import quote_plus

from bs4 import BeautifulSoup

from . import playwright_engine

log = logging.getLogger("zov.parser.ozon")

_BASE_URL = "https://www.ozon.ru"
_PRICE_RE = re.compile(r"(\d[\d\s  ]+)\s*₽")


def search_ozon(query: str, limit: int = 3, timeout: float = 30.0,
                max_retries: int = 4) -> list[dict[str, Any]]:
    """Поиск товара в OZON через Playwright + ротация residential прокси."""
    url = f"{_BASE_URL}/search/?text={quote_plus(query)}"

    import re as _re
    for attempt in range(max_retries + 1):
        html = playwright_engine.fetch_page(
            url,
            wait_selector="a[href*='/product/']",
            wait_ms=4000,
            timeout_ms=int(timeout * 1000),
        )
        if not html:
            log.warning("OZON attempt %d: no HTML", attempt + 1)
            continue
        title_m = _re.search(r"<title>(.*?)</title>", html, _re.IGNORECASE)
        page_title = title_m.group(1) if title_m else ""
        if "доступ ограничен" in page_title.lower() or "/antibot/" in html[:5000]:
            log.info("OZON attempt %d: anti-bot, retry with new proxy", attempt + 1)
            continue
        results = _parse_html(html, limit=limit)
        if results:
            return results
        log.info("OZON attempt %d: 0 results, retry", attempt + 1)

    log.warning("OZON gave up after %d attempts", max_retries + 1)
    return []


def _parse_html(html: str, limit: int) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict[str, Any]] = []
    seen_urls = set()

    # Находим все ссылки на товары
    product_links = soup.select("a[href*='/product/']")

    for link in product_links:
        if len(results) >= limit:
            break

        href = link.get("href") or ""
        # Пропускаем спонсорные ссылки — они истекают через 2-3 часа
        if "sponsored=1" in href or "/promo/" in href or "cpc=" in href:
            continue
        # Чистим URL — убираем все query-параметры
        url_clean = href.split("?")[0]
        if url_clean in seen_urls:
            continue
        seen_urls.add(url_clean)

        # Финальный URL — БЕЗ query params (sponsored ссылки иначе через 2-3ч 404)
        full_url = url_clean if url_clean.startswith("http") else f"{_BASE_URL}{url_clean}"

        # Поднимаемся до карточки — у OZON это обычно ближайший div с tile-* классом
        card = (
            link.find_parent("div", class_=re.compile("tile|search-item|product"))
            or link.find_parent("div")
        )
        if not card:
            continue

        item = _extract_from_card(card, full_url, link)
        if item and item.get("title") and len(item["title"]) > 5:
            results.append(item)

    return results


def _extract_from_card(card, url: str, link_el) -> dict[str, Any] | None:
    """Достаём данные из карточки OZON: title, price, image, rating, reviews."""
    full_text = card.get_text(" ", strip=True)

    # Название — может быть прямо в ссылке, либо в соседнем span
    title = link_el.get("title") or link_el.get_text(strip=True) or ""
    if not title or len(title) < 5 or title in ("Распродажа", "Скидка", "Топ"):
        # Ищем во вложенных span — обычно длинные строки = название
        spans = card.find_all("span")
        for s in spans:
            t = s.get_text(strip=True)
            if t and len(t) > 15 and len(t) < 200 and "₽" not in t and "%" not in t:
                title = t
                break
    title = title.strip()
    if not title or len(title) < 5:
        return None

    # Цена — первое число с ₽ в карточке (минимальная)
    price = None
    m = _PRICE_RE.search(full_text)
    if m:
        raw = m.group(1).replace(" ", "").replace(" ", "").replace(" ", "")
        try:
            price = int(raw)
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

    # Рейтинг (если есть на карточке — иногда показывают)
    rating = None
    m = re.search(r"(\d[.,]\d)\s*\(?\d", full_text)  # "4.7 (1242 отзыва)"
    if m:
        try:
            rating = float(m.group(1).replace(",", "."))
            if rating > 5.0:
                rating = None  # видимо не рейтинг
        except ValueError:
            pass

    reviews = None
    m = re.search(r"(\d[\d\s ]*)\s*(?:отзыв|оценок|review)", full_text, re.I)
    if m:
        try:
            reviews = int(m.group(1).replace(" ", "").replace(" ", "").replace(" ", ""))
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
        "source": "ozon",
    }
