"""Парсер OZON — через composer-api (внутренний JSON API сайта).

OZON отдаёт JSON через `/api/composer-api.bx/page/json/v2?url=/search/?text=…`.
JSON содержит вложенные виджеты — нас интересует `widgetStates.searchResults...`.

Без прокси возвращает 307/403. Через резидентный РФ-IP проходит.
"""
from __future__ import annotations
import logging
import re
from typing import Any
from urllib.parse import quote_plus

import httpx
from bs4 import BeautifulSoup

from .. import proxy_pool
from . import playwright_engine

log = logging.getLogger("zov.parser.ozon")

_BASE_URL = "https://www.ozon.ru"
_API_URL = "https://www.ozon.ru/api/composer-api.bx/page/json/v2"

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "ru-RU,ru;q=0.9",
    "x-o3-app-name": "dweb_client",
    "x-o3-app-version": "release_18.04",
    "x-o3-page-type": "search",
    "Referer": "https://www.ozon.ru/",
}

_PRICE_RE = re.compile(r"([\d\s]+)\s*₽")


def search_ozon(query: str, limit: int = 3, timeout: float = 30.0,
                max_retries: int = 1, use_playwright: bool = True) -> list[dict[str, Any]]:
    """Поиск товара в OZON.

    Сначала пробуем composer-api JSON (быстро), при challenge — Playwright (медленно но точно).
    """
    # Путь 1: быстрый composer-api
    url_param = f"/search/?text={quote_plus(query)}&from_global=true"
    params = {"url": url_param}
    for attempt in range(max_retries + 1):
        try:
            with proxy_pool.proxied_client(timeout=timeout, headers=_HEADERS,
                                            follow_redirects=False) as client:
                resp = client.get(_API_URL, params=params)
            if resp.status_code == 200:
                try:
                    return _extract_products(resp.json(), limit=limit)
                except Exception:
                    pass
            log.debug("OZON composer-api attempt %d: status=%s", attempt + 1, resp.status_code)
        except httpx.HTTPError as e:
            log.debug("OZON composer-api err: %s", e)

    # Путь 2: Playwright (рендерим обычную HTML-страницу поиска)
    if not use_playwright:
        return []
    log.info("OZON falling back to Playwright for query=%r", query)
    page_url = f"{_BASE_URL}/search/?text={quote_plus(query)}"
    html = playwright_engine.fetch_page(
        page_url,
        wait_selector="a[href*='/product/'], [data-widget='searchResultsV2']",
        wait_ms=3500,
        timeout_ms=int(timeout * 1000),
    )
    if not html:
        return []
    return _parse_html_via_dom(html, limit=limit)


def _parse_html_via_dom(html: str, limit: int) -> list[dict[str, Any]]:
    """Fallback: парсим товары из отрендеренного Chrome HTML."""
    soup = BeautifulSoup(html, "html.parser")
    seen = set()
    results: list[dict[str, Any]] = []

    for link in soup.select("a[href*='/product/']"):
        if len(results) >= limit:
            break
        href = link.get("href") or ""
        if href in seen:
            continue
        seen.add(href)

        # Поднимаемся до карточки
        card = link.find_parent("div") or link
        title = link.get_text(strip=True) or (card.select_one("span") or {}).get_text(strip=True) if hasattr(card.select_one("span"), "get_text") else ""
        if not title or len(title) < 5:
            continue

        url = href if href.startswith("http") else f"{_BASE_URL}{href}"
        url = url.split("?")[0]

        # Цена в ближайшем родителе
        price = None
        price_card = link.find_parent("div", recursive=True)
        if price_card:
            txt = price_card.get_text(" ", strip=True)
            m = _PRICE_RE.search(txt)
            if m:
                price = _try_int(m.group(1).replace(" ", ""))

        # Картинка в карточке
        img = None
        img_el = card.find("img") if card else None
        if img_el:
            src = img_el.get("src") or ""
            if src.startswith("//"):
                src = "https:" + src
            if src and "data:image" not in src:
                img = src

        results.append({
            "title": title[:200],
            "url": url,
            "image_url": img,
            "price_min_rub": price,
            "price_max_rub": None,
            "rating": None,
            "reviews_count": None,
            "stores_count": None,
            "specs": {},
            "source": "ozon",
        })

    return results


def _try_int(v: Any) -> int | None:
    if v is None:
        return None
    try:
        return int(float(str(v).replace(" ", "").replace(",", ".")))
    except (ValueError, TypeError):
        return None


def _extract_products(data: dict, limit: int) -> list[dict[str, Any]]:
    """OZON прячет данные в widgetStates — ищем все ключи с 'searchResultsV2'."""
    widget_states = data.get("widgetStates") or {}
    products: list[dict[str, Any]] = []

    for key, raw in widget_states.items():
        if "searchResultsV2" not in key and "skuGrid" not in key and "searchCategories" not in key:
            continue
        try:
            import json as _j
            w = _j.loads(raw) if isinstance(raw, str) else raw
        except Exception:
            continue

        items = w.get("items") or w.get("products") or []
        for it in items:
            if len(products) >= limit:
                break
            item = _build_item(it)
            if item:
                products.append(item)
        if len(products) >= limit:
            break

    return products


def _build_item(it: dict[str, Any]) -> dict[str, Any] | None:
    """Парсит карточку товара из OZON widget items[]."""
    # Структура: { mainState: [...], action: { link: '/product/...' }, images: [...] }
    sku = it.get("sku") or it.get("id")
    if not sku:
        return None

    link = (it.get("action") or {}).get("link") or ""
    url = f"{_BASE_URL}{link}" if link.startswith("/") else link

    # Картинка
    image_url = None
    imgs = it.get("images") or it.get("tileImage") or []
    if isinstance(imgs, list) and imgs:
        first = imgs[0]
        image_url = first if isinstance(first, str) else (first.get("image") or first.get("src"))
    if not image_url:
        ti = it.get("tileImage") or {}
        if isinstance(ti, dict):
            items = ti.get("items") or []
            for x in items:
                if isinstance(x, dict) and x.get("image"):
                    image_url = x["image"].get("link") or x["image"].get("src")
                    break

    # Цена и название — берём из mainState текстовых атомов
    title = ""
    price_min = None
    price_max = None
    rating = None
    reviews = None

    for atom in (it.get("mainState") or []):
        atom_id = atom.get("id") or ""
        atom_type = atom.get("type") or ""

        if atom_type == "textAtom":
            text = ((atom.get("textAtom") or {}).get("text") or "").strip()
            if "name" in atom_id.lower() and not title:
                title = re.sub(r"<[^>]+>", "", text)
            elif "price" in atom_id.lower():
                m = _PRICE_RE.search(text)
                if m and not price_min:
                    price_min = int(m.group(1).replace(" ", "").replace(" ", ""))

        elif atom_type == "priceV2":
            pv = atom.get("priceV2") or {}
            for price_obj in (pv.get("price") or []):
                t = (price_obj.get("text") or "").strip()
                m = _PRICE_RE.search(t)
                if m:
                    val = int(m.group(1).replace(" ", "").replace(" ", ""))
                    if price_min is None or val < price_min:
                        price_min = val
                    if price_max is None or val > price_max:
                        price_max = val

        elif atom_type == "labelList":
            for lbl in ((atom.get("labelList") or {}).get("items") or []):
                t = (lbl.get("title") or "").strip()
                # Рейтинг типа "4.7"
                if re.fullmatch(r"\d\.\d", t):
                    rating = float(t)
                # Отзывы типа "1242 отзыва"
                m = re.search(r"(\d[\d\s]*)\s*(?:отзыв|оценок)", t)
                if m:
                    reviews = int(m.group(1).replace(" ", ""))

    if not title:
        # Резервный фолбэк — могут быть атомы в otherState
        for atom in (it.get("otherState") or []):
            text = ((atom.get("textAtom") or {}).get("text") or "").strip()
            if text and len(text) > 5:
                title = re.sub(r"<[^>]+>", "", text)
                break

    if not title:
        return None

    return {
        "title": title,
        "url": url,
        "image_url": image_url,
        "price_min_rub": price_min,
        "price_max_rub": price_max if price_max and price_max != price_min else None,
        "rating": rating,
        "reviews_count": reviews,
        "stores_count": None,
        "specs": {},
        "source": "ozon",
    }
