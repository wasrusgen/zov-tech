"""Кэш каталога моделей в Google Sheets.

Зачем: AI должен выбирать модели из РЕАЛЬНОГО списка (собранного парсерами),
а не выдумывать артикулы. Раз в неделю обновляем каталог запуском
парсеров по seed-комбинациям бренд+категория.

Использование:
- POST /api/catalog/refresh?cat=fridge   — обновить одну категорию
- POST /api/catalog/refresh              — обновить все 8 категорий (медленно)
- GET  /api/catalog/list?cat=fridge      — прочитать каталог одной категории
- В _handle_podbor: catalog.list_for_ai(...) для AI prompt
"""
from __future__ import annotations
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from . import sheets
from . import parsers

log = logging.getLogger("zov.catalog")

SHEET_NAME = "Catalog"
HEADERS = [
    "id", "category", "brand", "tier", "model_name",
    "search_query", "price_min_rub", "price_max_rub",
    "image_url", "source", "url", "last_seen_at",
]

# Бренды по тирам — реалии РФ 2026
SEED_BRANDS_BY_TIER = {
    "premium": ["Miele", "Liebherr", "Gaggenau", "V-Zug", "Asko", "Smeg"],
    "middle":  ["Bosch", "Siemens", "NEFF", "Haier", "Samsung", "LG", "Electrolux", "AEG"],
    "budget":  ["Kuppersberg", "Maunfeld", "Weissgauff", "Korting",
                "Hansa", "Beko", "Gorenje", "Hisense"],
}

# Категории и поисковое слово на русском
CATEGORY_QUERIES = {
    "fridge":    "холодильник",
    "hob":       "варочная панель",
    "oven":      "духовой шкаф",
    "dw":        "посудомоечная машина",
    "hood":      "вытяжка",
    "microwave": "микроволновая печь",
    "coffee":    "кофемашина",
    "washer":    "стиральная машина",
}


def refresh_catalog(categories: list[str] | None = None,
                    sources: tuple = ("yamarket", "wb", "citilink"),
                    per_brand: int = 2,
                    delay_sec: float = 1.0) -> dict[str, Any]:
    """Запускает парсеры для каждого (brand × category) комбо, сохраняет результаты в Sheets.

    Args:
        categories: список ключей категорий (если None — все 8)
        sources: какие парсеры использовать
        per_brand: сколько результатов сохранять на (brand × category)
        delay_sec: пауза между запросами к парсерам (не нагружать)

    Returns:
        dict со статистикой: {total_added, by_category, errors}
    """
    if categories is None:
        categories = list(CATEGORY_QUERIES.keys())

    # Гарантируем что лист есть
    sheets.ensure_sheet(SHEET_NAME, HEADERS)

    total_added = 0
    by_category: dict[str, int] = {}
    errors: list[str] = []

    for cat in categories:
        cat_label = CATEGORY_QUERIES.get(cat)
        if not cat_label:
            errors.append(f"unknown category: {cat}")
            continue

        added_cat = 0
        for tier, brands in SEED_BRANDS_BY_TIER.items():
            for brand in brands:
                query = f"{brand} {cat_label}"
                log.info("Catalog refresh: %s · %s · %r", cat, brand, query)
                try:
                    enriched = parsers.enrich_one(query, sources=sources)
                except Exception as e:
                    err = f"{cat}/{brand}: {e}"
                    log.warning("enrich_one failed: %s", err)
                    errors.append(err)
                    if delay_sec > 0:
                        time.sleep(delay_sec)
                    continue

                items_added = _save_results(cat, brand, tier, query, enriched, per_brand)
                added_cat += items_added
                total_added += items_added

                if delay_sec > 0:
                    time.sleep(delay_sec)

        by_category[cat] = added_cat
        log.info("Catalog refresh: category %s — %d items added", cat, added_cat)

    return {
        "ok": True,
        "total_added": total_added,
        "by_category": by_category,
        "errors": errors[:10],  # первые 10 ошибок
    }


def _save_results(cat: str, brand: str, tier: str, query: str,
                  enriched: dict, max_items: int) -> int:
    """Сохраняет до max_items релевантных результатов из enriched."""
    if not enriched:
        return 0

    saved = 0
    seen_titles = set()
    sources_priority = ["yamarket", "wb", "citilink", "ozon", "dns"]

    for src in sources_priority:
        if saved >= max_items:
            break
        item = enriched.get(src)
        if not item or not item.get("title"):
            continue

        # Фильтр релевантности: бренд должен упоминаться в названии или specs.brand
        title = (item.get("title") or "").lower()
        item_brand = (item.get("specs") or {}).get("brand", "").lower()
        if brand.lower() not in title and brand.lower() not in item_brand:
            continue

        # Дедуп по title в рамках одного (cat, brand)
        title_key = item["title"][:100].lower().strip()
        if title_key in seen_titles:
            continue
        seen_titles.add(title_key)

        try:
            sheets.append_row(SHEET_NAME, [
                _short_id(),
                cat,
                brand,
                tier,
                item["title"][:250],
                query,
                item.get("price_min_rub") or "",
                item.get("price_max_rub") or "",
                item.get("image_url") or "",
                src,
                item.get("url") or "",
                _now_iso(),
            ])
            saved += 1
        except Exception as e:
            log.warning("Failed to save row: %s", e)

    return saved


def list_catalog(category: str | None = None, tier: str | None = None,
                 brand: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
    """Читает каталог из Sheets с опциональными фильтрами."""
    try:
        ws = sheets.sheet(SHEET_NAME)
        rows = ws.get_all_values()
    except Exception as e:
        log.warning("Cannot read Catalog sheet: %s", e)
        return []

    if not rows or len(rows) < 2:
        return []

    headers = rows[0]
    out: list[dict[str, Any]] = []
    for r in rows[1:]:
        row = dict(zip(headers, r + [""] * (len(headers) - len(r))))
        if category and row.get("category") != category:
            continue
        if tier and row.get("tier") != tier:
            continue
        if brand and row.get("brand", "").lower() != brand.lower():
            continue
        out.append(row)
        if len(out) >= limit:
            break
    return out


def list_for_ai(categories: list[str], tiers: list[str] | None = None,
                limit_per_cat: int = 30) -> str:
    """Формирует короткий текст-каталог для AI prompt.

    Пример вывода:
      fridge candidates (Haier, Bosch ⚠, ...):
        - Haier C2F619CFU1 [middle] · ~44 800 ₽
        - Haier C4F744CMG [middle] · ~79 990 ₽
        - Bosch Serie 4 KGN39NW00R ⚠ [middle] · ~85 000 ₽
        ...
    """
    lines = []
    for cat in categories:
        items = list_catalog(category=cat, limit=limit_per_cat * 3)  # с запасом
        if tiers:
            items = [i for i in items if i.get("tier") in tiers]
        items = items[:limit_per_cat]
        if not items:
            continue
        lines.append(f"\n{cat} ({len(items)} моделей):")
        for it in items:
            price = it.get("price_min_rub") or ""
            price_str = f" · ~{price} ₽" if price else ""
            lines.append(f"  - {it.get('brand', '')} {it.get('model_name', '')} [{it.get('tier', '')}]{price_str}")
    return "\n".join(lines).strip()


def _short_id() -> str:
    return uuid.uuid4().hex[:13]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
