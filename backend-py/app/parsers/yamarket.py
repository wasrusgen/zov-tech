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
    """Поиск товара в Я.Маркете через headless Chromium + residential proxy.

    Я.Маркет (2025-2026) использует URL pattern `/card/{slug}/{productId}`.
    Старые URL `/product--` больше не применяются.
    """
    url = f"{_BASE_URL}/search?text={quote_plus(query)}"

    html = None
    for attempt in range(max_retries + 1):
        html = playwright_engine.fetch_page(
            url,
            # Ждём появления товарных ссылок /card/...
            wait_selector="a[href*='/card/']",
            wait_ms=5000,
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
    if "Похоже, вы&nbsp;используете" in html[:30000] or "используете VPN" in html[:30000]:
        log.warning("YaMarket: VPN warning page for query=%r", query)
        return []

    return _parse_html(html, limit=limit)


def _parse_html(html: str, limit: int) -> list[dict[str, Any]]:
    """Парсим товары через URL pattern /card/{slug}/{productId} (Я.Маркет 2026)."""
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict[str, Any]] = []
    seen_ids = set()

    for link in soup.select("a[href*='/card/']"):
        if len(results) >= limit:
            break
        href = link.get("href") or ""
        m_id = re.search(r"/card/[^/]+/(\d+)", href)
        if not m_id:
            continue
        product_id = m_id.group(1)
        if product_id in seen_ids:
            continue
        seen_ids.add(product_id)

        full_url = href if href.startswith("http") else f"{_BASE_URL}{href}"
        clean_url = full_url.split("?")[0]

        # Карточка-родитель — article, div с data-zone-name или просто ближайший div
        card = (
            link.find_parent("article")
            or link.find_parent("div", attrs={"data-zone-name": True})
            or link.find_parent("div")
        )
        if not card:
            continue
        item = _extract_card(card, link, clean_url)
        if item:
            results.append(item)

    return results


def _extract_card(card, link_el, url: str) -> dict[str, Any] | None:
    """Достаём title, price, image, rating, reviews, stores из карточки."""
    full_text = card.get_text(" ", strip=True)

    # Title — обычно в самой ссылке, либо в h3/h2/span внутри
    title = (link_el.get("title") or link_el.get_text(strip=True) or "").strip()
    if not title or len(title) < 5:
        for sel in ["h3", "h2", "[data-auto='snippet-title']", "span[itemprop='name']"]:
            el = card.select_one(sel)
            if el:
                t = (el.get("title") or el.get_text(strip=True)).strip()
                if t and len(t) > 5:
                    title = t
                    break
    if not title:
        # Резерв — длинный текст без цены/рейтинга
        for s in card.find_all("span"):
            t = s.get_text(strip=True)
            if 15 < len(t) < 250 and "₽" not in t and "★" not in t and "отзыв" not in t.lower():
                title = t
                break
    if not title or len(title) < 5:
        return None

    # Цена — минимальная в карточке
    price_min = None
    for m in _PRICE_RE.finditer(full_text):
        raw = m.group(1).replace(" ", "").replace(" ", "").replace(" ", "")
        try:
            v = int(raw)
            if 100 < v < 10_000_000:
                if price_min is None or v < price_min:
                    price_min = v
        except ValueError:
            pass

    # Картинка (исключаем placeholder'ы)
    img_url = None
    for img_el in card.find_all("img"):
        src = img_el.get("src") or img_el.get("data-src") or ""
        if not src or "data:image" in src:
            srcset = img_el.get("srcset") or ""
            if srcset:
                src = srcset.split(",")[0].strip().split(" ")[0]
        if src.startswith("//"):
            src = "https:" + src
        if not src or "yastatic" in src or "_next/static" in src:
            continue
        img_url = src
        break

    # Рейтинг
    rating = None
    m = re.search(r"(\d[.,]\d)(?:\s*★|\s*\(?\d+\s*оцен)", full_text)
    if m:
        try:
            r = float(m.group(1).replace(",", "."))
            if 0 < r <= 5.0:
                rating = r
        except ValueError:
            pass

    # Отзывы
    reviews = None
    m = re.search(r"(\d[\d\s ]*)\s*(?:отзыв|оценок|review)", full_text, re.I)
    if m:
        try:
            reviews = int(m.group(1).replace(" ", "").replace(" ", "").replace(" ", ""))
        except ValueError:
            pass

    # Кол-во магазинов / предложений
    stores = None
    m = re.search(r"(?:от|в)\s+(\d+)\s+(?:магазин|предложен)", full_text)
    if m:
        try:
            stores = int(m.group(1))
        except ValueError:
            pass

    return {
        "title": title[:250],
        "url": url,
        "image_url": img_url,
        "price_min_rub": price_min,
        "price_max_rub": None,
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
