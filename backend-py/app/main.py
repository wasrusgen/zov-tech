"""ЗОВ Backend — FastAPI app. Полный порт Apps Script Code.gs."""
from __future__ import annotations
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_config
from .auth import verify_init_data
from . import sheets, ai, telegram as tg, proxy_pool, catalog
from . import parsers
from .parsers import dns as parser_dns, wb as parser_wb, ozon as parser_ozon, yamarket as parser_ym, citilink as parser_cl

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("zov.backend")

app = FastAPI(title="ZOV Backend", version="2.0")

# CORS — MiniApp хостится на github.io, бэкенд на api.wasrusgen1.pro.
# Простые запросы (text/plain или без Content-Type) не триггерят preflight.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# =================================================================
# Health & ping
# =================================================================

@app.get("/healthz")
async def healthz():
    return {"ok": True, "service": "zov-tech-backend", "time": _now_iso()}


@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "zov-tech-backend",
        "version": "2.0",
        "available_paths": ["me", "measurement", "podbor", "ping", "test_ai", "test_telegram", "seed_admin"],
    }


# =================================================================
# Compatibility layer with Apps Script (?path=X)
# =================================================================

@app.post("/")
async def root_post(request: Request):
    return await _dispatch_post(request)


@app.api_route("/exec", methods=["GET", "POST"])
async def apps_script_compat(request: Request):
    """Эмулируем поведение `/exec?path=X` чтобы старый MiniApp-код тоже работал."""
    if request.method == "GET":
        path = request.query_params.get("path", "")
        if path == "ping":
            return {"pong": True, "time": _now_iso()}
        if path == "seed_admin":
            return JSONResponse(_handle_seed_admin())
        if path == "test_ai" or path == "test_claude":
            return JSONResponse(_handle_test_ai())
        if path == "test_telegram":
            return JSONResponse(_handle_test_telegram())
        return {"status": "ok", "service": "zov-tech-backend"}
    return await _dispatch_post(request)


async def _dispatch_post(request: Request):
    path = request.query_params.get("path", "")
    try:
        body = await request.json()
    except Exception:
        body = {}

    handlers = {
        "me":            _handle_me,
        "measurement":   _handle_measurement,
        "podbor":        _handle_podbor,
        "ping":          lambda b: {"pong": True, "time": _now_iso()},
        "seed_admin":    lambda b: _handle_seed_admin(),
        "test_ai":       lambda b: _handle_test_ai(),
        "test_claude":   lambda b: _handle_test_ai(),
        "test_telegram": lambda b: _handle_test_telegram(),
    }
    fn = handlers.get(path)
    if not fn:
        return JSONResponse({"error": "unknown_path", "path": path}, status_code=404)

    try:
        # podbor использует Playwright sync API → выполняем в threadpool
        if path == "podbor":
            import asyncio
            result = await asyncio.to_thread(fn, body)
        else:
            result = fn(body)
        return JSONResponse(result)
    except Exception as e:
        log.exception("api error on path=%s", path)
        sheets.log_event("api_error", None, {"path": path, "error": str(e)})
        return JSONResponse({"error": str(e)}, status_code=500)


# =================================================================
# Native /api/* routes (preferred for new MiniApp)
# =================================================================

@app.post("/api/me")
async def api_me(request: Request):
    body = await _safe_json(request)
    return _handle_me(body)


@app.post("/api/measurement")
async def api_measurement(request: Request):
    body = await _safe_json(request)
    return _handle_measurement(body)


@app.post("/api/podbor")
async def api_podbor(request: Request):
    body = await _safe_json(request)
    # _handle_podbor использует Playwright sync API — выполняем в threadpool
    import asyncio
    return await asyncio.to_thread(_handle_podbor, body)


@app.get("/api/test_ai")
async def api_test_ai():
    return _handle_test_ai()


@app.get("/api/test_telegram")
async def api_test_telegram():
    return _handle_test_telegram()


@app.get("/api/seed_admin")
async def api_seed_admin():
    return _handle_seed_admin()


@app.get("/api/parse_dns")
def api_parse_dns(q: str = "", limit: int = 1):  # sync — для threadpool
    """Тест парсера DNS."""
    if not q:
        return {"error": "missing_query", "hint": "use ?q=<search>"}
    try:
        results = parser_dns.search_dns(q, limit=min(max(1, limit), 5))
        return {"ok": True, "query": q, "count": len(results), "results": results}
    except Exception as e:
        return {"ok": False, "error": str(e), "query": q}


@app.get("/api/parse_wb")
def api_parse_wb(q: str = "", limit: int = 3):
    if not q:
        return {"error": "missing_query"}
    try:
        results = parser_wb.search_wb(q, limit=min(max(1, limit), 10))
        return {"ok": True, "query": q, "count": len(results), "results": results}
    except Exception as e:
        return {"ok": False, "error": str(e), "query": q}


@app.get("/api/parse_ozon")
def api_parse_ozon(q: str = "", limit: int = 3):
    if not q:
        return {"error": "missing_query"}
    try:
        results = parser_ozon.search_ozon(q, limit=min(max(1, limit), 10))
        return {"ok": True, "query": q, "count": len(results), "results": results}
    except Exception as e:
        return {"ok": False, "error": str(e), "query": q}


@app.get("/api/parse_yamarket")
def api_parse_yamarket(q: str = "", limit: int = 3):
    if not q:
        return {"error": "missing_query"}
    try:
        results = parser_ym.search_yamarket(q, limit=min(max(1, limit), 10))
        return {"ok": True, "query": q, "count": len(results), "results": results}
    except Exception as e:
        return {"ok": False, "error": str(e), "query": q}


@app.get("/api/parse_citilink")
def api_parse_citilink(q: str = "", limit: int = 3):
    if not q:
        return {"error": "missing_query"}
    try:
        results = parser_cl.search_citilink(q, limit=min(max(1, limit), 10))
        return {"ok": True, "query": q, "count": len(results), "results": results}
    except Exception as e:
        return {"ok": False, "error": str(e), "query": q}


@app.get("/api/parse_all")
def api_parse_all(q: str = ""):
    """Спрашивает все источники и возвращает агрегированный результат."""
    if not q:
        return {"error": "missing_query"}
    try:
        data = parsers.enrich_one(q)
        return {"ok": True, "query": q, "data": data}
    except Exception as e:
        return {"ok": False, "error": str(e), "query": q}


@app.get("/api/proxy_status")
async def api_proxy_status():
    """Диагностика: показывает текущее состояние proxy-пула."""
    return proxy_pool.pool_status()


@app.post("/api/catalog/refresh")
def api_catalog_refresh(cat: str = "", per_brand: int = 2, delay: float = 1.0):
    """Запускает парсинг каталога (медленно — несколько минут на категорию).

    Параметры:
      cat: одна категория (fridge|hob|oven|dw|hood|microwave|coffee|washer)
           или пусто = все 8 (очень долго)
      per_brand: сколько моделей сохранять на (brand × category) — default 2
      delay: задержка между запросами к парсерам, сек — default 1.0
    """
    categories = [cat] if cat else None
    try:
        result = catalog.refresh_catalog(
            categories=categories,
            per_brand=max(1, min(per_brand, 5)),
            delay_sec=max(0.0, min(delay, 10.0)),
        )
        return result
    except Exception as e:
        log.exception("catalog refresh failed")
        return {"ok": False, "error": str(e)}


@app.get("/api/catalog/list")
def api_catalog_list(cat: str = "", tier: str = "", brand: str = "", limit: int = 100):
    """Читает каталог моделей из Sheets с фильтрами."""
    items = catalog.list_catalog(
        category=cat or None,
        tier=tier or None,
        brand=brand or None,
        limit=min(limit, 500),
    )
    return {
        "ok": True,
        "filters": {"category": cat, "tier": tier, "brand": brand},
        "count": len(items),
        "items": items,
    }


@app.get("/api/catalog/preview_ai")
def api_catalog_preview_ai(cats: str = "fridge", tiers: str = ""):
    """Превью того, что AI получит в prompt (для отладки)."""
    cat_list = [c.strip() for c in cats.split(",") if c.strip()]
    tier_list = [t.strip() for t in tiers.split(",") if t.strip()] or None
    text = catalog.list_for_ai(cat_list, tiers=tier_list, limit_per_cat=30)
    return {"text": text, "length_chars": len(text)}


# =================================================================
# Handlers
# =================================================================

def _handle_me(body: dict[str, Any]) -> dict[str, Any]:
    cfg = get_config()
    init_data = body.get("initData") or ""
    auth = verify_init_data(init_data, cfg.bot_token)
    if not auth or not auth.get("user"):
        return {"error": "invalid_init_data"}

    tg_user = auth["user"]
    tg_id = tg_user["id"]
    start_param = body.get("startParam") or auth.get("start_param")
    explicit_role = body.get("role") if body.get("role") in ("manager", "client") else None
    user = sheets.get_or_create_user(tg_user, start_param, explicit_role)

    if user.get("role") == "manager":
        m = sheets.get_manager_profile(tg_id) or {
            "full_name": user.get("full_name", ""), "salon": "",
            "is_zov_employee": False, "status": "lapsed", "active_until": None,
        }
        return {
            "role": "manager",
            "user": {
                "tg_id": tg_id,
                "full_name": m.get("full_name") or user.get("full_name", ""),
                "salon": m.get("salon", ""),
                "avatar_initial": _initial(m.get("full_name") or tg_user.get("first_name", "")),
            },
            "status": m.get("status", "lapsed"),
            "status_until": _format_date(m.get("active_until")),
        }

    # client
    c = sheets.get_client_profile(tg_id) or {}
    manager = None
    mgr_id = c.get("manager_tg_id")
    if mgr_id:
        try:
            mgr_id_int = int(mgr_id)
            mp = sheets.get_manager_profile(mgr_id_int)
            if mp:
                manager = {"full_name": mp.get("full_name"), "salon": mp.get("salon")}
        except (TypeError, ValueError):
            pass

    full_name = c.get("full_name") or user.get("full_name", "")
    return {
        "role": "client",
        "user": {
            "tg_id": tg_id,
            "full_name": full_name,
            "avatar_initial": _initial(full_name or tg_user.get("first_name", "")),
        },
        "manager": manager,
    }


def _handle_measurement(body: dict[str, Any]) -> dict[str, Any]:
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user:
        return {"error": "user_not_found"}

    m = body.get("measurement") or {}
    measurement_id = _short_id()
    filled_by = "manager_for_client" if user.get("role") == "manager" else "client_self"

    client_tg_id = m.get("client_tg_id") if user.get("role") == "manager" else tg_id
    manager_tg_id = tg_id if user.get("role") == "manager" else (
        sheets.find_row("Clients", "tg_id", tg_id) or {}
    ).get("manager_tg_id", "")

    sheets.append_row("Measurements", [
        measurement_id, _now_iso(), client_tg_id or "", manager_tg_id or "",
        filled_by,
        m.get("layout", ""), m.get("area_m2", ""), m.get("ceiling_mm", ""),
        json.dumps(m.get("walls") or {}, ensure_ascii=False),
        json.dumps(m.get("openings") or {}, ensure_ascii=False),
        json.dumps(m.get("infra") or {}, ensure_ascii=False),
        json.dumps(m.get("niches") or {}, ensure_ascii=False),
        ",".join(m.get("photos") or []),
        m.get("notes", ""),
        "submitted",
    ])

    if client_tg_id:
        sheets.update_cell_by_key("Clients", "tg_id", client_tg_id, "last_measurement_id", measurement_id)

    if filled_by == "client_self" and manager_tg_id:
        tg.send_message(
            manager_tg_id,
            f"📐 Новый замер от клиента <b>{user.get('full_name') or tg_id}</b>.\n"
            f"Площадь: {m.get('area_m2', '?')} м², форма: {m.get('layout', '?')}.\n"
            f"Открыть в кабинете для просмотра."
        )

    sheets.log_event("measurement_submitted", tg_id, {"id": measurement_id, "filled_by": filled_by})
    return {"ok": True, "id": measurement_id}


def _handle_podbor(body: dict[str, Any]) -> dict[str, Any]:
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user:
        return {"error": "user_not_found"}
    if user.get("role") != "manager":
        return {"error": "only_manager_can_request_podbor"}

    checklist = body.get("checklist") or {}
    client_name = body.get("client_name", "")
    client_tg_id = body.get("client_tg_id", "")
    measurement_id = body.get("measurement_id", "")
    lead_id = _short_id()

    sheets.append_row("Leads", [
        lead_id, _now_iso(), tg_id, client_tg_id, client_name, measurement_id,
        json.dumps(checklist, ensure_ascii=False),
        "", "", 0, False, "new", 0,
    ])

    # Загружаем релевантный каталог моделей и передаём AI как «доступный пул»
    catalog_text = _build_catalog_context(checklist)

    user_prompt = (
        f"Подбери технику для следующего клиента:\n\n"
        f"{json.dumps({'client': {'name': client_name}, 'checklist': checklist}, ensure_ascii=False, indent=2)}"
    )
    if catalog_text:
        user_prompt += (
            "\n\n═══ ДОСТУПНЫЙ КАТАЛОГ МОДЕЛЕЙ (выбирай ТОЛЬКО из этого списка) ═══\n"
            + catalog_text
            + "\n\nВАЖНО: если модель не из этого списка — НЕ возвращай её. "
              "Каталог собран парсерами с реальных маркетплейсов РФ — это гарантия что артикул существует."
        )
    ai_result = ai.call_ai(user_prompt)

    # Обогащение моделей данными с маркетплейсов (WB / Я.Маркет / OZON / DNS)
    enrich_enabled = body.get("enrich", True)
    if enrich_enabled:
        try:
            _enrich_ai_marketplaces(ai_result)
        except Exception as e:
            log.warning("Marketplace enrich failed: %s", e)

    # Update lead row with AI response
    sheets.update_cell_by_key("Leads", "id", lead_id, "ai_response",
                              json.dumps(ai_result.get("json") or ai_result.get("text", ""), ensure_ascii=False))
    sheets.update_cell_by_key("Leads", "id", lead_id, "ai_model", ai_result.get("model", ""))
    sheets.update_cell_by_key("Leads", "id", lead_id, "ai_tokens_used", ai_result.get("tokens", 0))
    sheets.update_cell_by_key("Leads", "id", lead_id, "sent_to_tg", True)

    summary_text = _format_podbor_for_telegram(ai_result, client_name, lead_id)
    tg.send_message(tg_id, summary_text)

    sheets.log_event("podbor_completed", tg_id, {"id": lead_id, "tokens": ai_result.get("tokens", 0)})
    return {"ok": True, "id": lead_id, "summary": summary_text, "ai": ai_result.get("json")}


def _build_catalog_context(checklist: dict[str, Any]) -> str:
    """Готовит компактный текст-каталог для AI prompt.

    Берёт только релевантные категории + тиры (по budget_preset).
    """
    cats = checklist.get("categories") or []
    if not cats:
        return ""

    # Маппинг бюджет-пресета → тиры каталога
    bp = checklist.get("budget_preset") or ""
    tier_map = {
        "luxe":    ["premium"],
        "premium": ["premium", "middle"],
        "middle":  ["middle"],
        "budget":  ["middle", "budget"],  # средний и ниже
        "exact":   None,
    }
    tiers = tier_map.get(bp)  # None = все тиры

    try:
        return catalog.list_for_ai(cats, tiers=tiers, limit_per_cat=25)
    except Exception as e:
        log.warning("Cannot build catalog context: %s", e)
        return ""


def _enrich_ai_marketplaces(ai_result: dict[str, Any]) -> None:
    """Обогащает каждую модель из ai_result['json']['by_category'] данными
    с маркетплейсов (WB / Я.Маркет / OZON / DNS). Если PROXY6_TOKEN не задан —
    скорее всего вернёт пустые данные (Qrator блокирует прямые HTTP)."""
    j = ai_result.get("json")
    if not j or not isinstance(j, dict):
        return
    by_cat = j.get("by_category") or {}
    for cat_key, cat_data in by_cat.items():
        if not isinstance(cat_data, dict):
            continue
        models = cat_data.get("models") or []
        cat_data["models"] = parsers.enrich_models(models, delay_sec=0.4)


def _handle_test_ai() -> dict[str, Any]:
    cfg = get_config()
    res = ai.call_ai("Скажи одной фразой: что за фабрика ЗОВ?",
                     system_prompt="Ты — кратко и по делу отвечаешь. Без markdown.")
    return {
        "ok": not res.get("error"),
        "provider": "GigaChat",
        "model": res.get("model", cfg.gigachat_model),
        "response_text": (res.get("text") or "")[:500],
        "tokens": res.get("tokens", 0),
    }


def _handle_test_telegram() -> dict[str, Any]:
    cfg = get_config()
    ok = tg.send_message(
        cfg.admin_tg_id,
        "🟢 Привет из Python-бэкенда на VPS! Связка backend↔бот работает.",
    )
    return {"ok": ok, "sent_to": cfg.admin_tg_id}


def _handle_seed_admin() -> dict[str, Any]:
    cfg = get_config()
    admin_id = cfg.admin_tg_id
    if sheets.find_row("Managers", "tg_id", admin_id):
        return {"ok": True, "status": "already_seeded", "admin_id": admin_id}
    sheets.append_row("Managers", [
        admin_id, "Руслан Васильев", "vasrusgen@gmail.com", "",
        "ЗОВ — куратор сети", "Санкт-Петербург",
        True, "active", "", "", 0, 0, 0, "MGR_ADMIN",
    ])
    if not sheets.find_user(admin_id):
        sheets.append_row("Users", [
            admin_id, "VASRUSGEN", "Руслан", "Васильев", "manager",
            _now_iso(), _now_iso(), "",
        ])
    return {"ok": True, "status": "seeded", "admin_id": admin_id, "full_name": "Руслан Васильев"}


# =================================================================
# Helpers
# =================================================================

_CAT_LABELS = {
    "fridge": "❄️ Холодильник",
    "hob": "🔥 Варочная панель",
    "oven": "🔥 Духовой шкаф",
    "dw": "💧 Посудомоечная",
    "hood": "💨 Вытяжка",
    "microwave": "📻 СВЧ",
    "coffee": "☕ Кофемашина",
    "washer": "🧺 Стиральная машина",
}


def _format_podbor_for_telegram(ai_result: dict[str, Any], client_name: str, lead_id: str = "") -> str:
    if ai_result.get("error"):
        return f"❌ Не удалось получить подбор от AI.\n{ai_result.get('text', '')}"
    j = ai_result.get("json")
    if not j:
        return "<b>Подбор готов</b>\n\n" + (ai_result.get("text") or "")[:3500]

    lines = ["✅ <b>Подбор готов</b>"]
    if client_name:
        lines.append(f"Клиент: <b>{client_name}</b>")
    lines.append("")
    if j.get("summary"):
        lines.append(j["summary"])
        lines.append("")

    # Новая структура: by_category
    by_cat = j.get("by_category") or {}
    if by_cat:
        for cat_key, cat_data in by_cat.items():
            cat_label = _CAT_LABELS.get(cat_key, cat_key.upper())
            lines.append(f"━━━ <b>{cat_label}</b> ━━━")
            # Анализ категории от AI
            analysis = (cat_data or {}).get("analysis")
            if analysis:
                lines.append(f"<i>{analysis}</i>")
                lines.append("")
            models = (cat_data or {}).get("models") or []
            for i, m in enumerate(models, 1):
                lines.append(f"<b>{i}. {m.get('brand', '')} {m.get('model', '')}</b>")
                # Цены и магазины из enrichment
                enriched = m.get("enriched") or {}
                pmin = enriched.get("price_min_rub") or m.get("price_min_rub")
                pmax = enriched.get("price_max_rub") or m.get("price_max_rub")
                if pmin and pmax and pmin != pmax:
                    lines.append(f"💰 {_format_price(pmin)} — {_format_price(pmax)} ₽")
                elif pmin:
                    lines.append(f"💰 {_format_price(pmin)} ₽")
                # Отзывы и рейтинг (если есть)
                rating = enriched.get("rating_max")
                reviews = enriched.get("reviews_total")
                meta_parts = []
                if rating: meta_parts.append(f"★ {rating:.1f}")
                if reviews: meta_parts.append(f"{reviews} отзыв.")
                stores = enriched.get("stores_count")
                if stores: meta_parts.append(f"{stores} магаз.")
                if meta_parts:
                    lines.append("📊 " + " · ".join(meta_parts))
                # Источники где нашли товар
                sources_found = [
                    src.upper() for src in ("ozon", "citilink", "wb", "yamarket", "dns")
                    if enriched.get(src)
                ]
                if sources_found:
                    lines.append(f"🛒 Нашли в: {' · '.join(sources_found)}")
                if m.get("highlights"):
                    lines.append("✓ " + ", ".join(m["highlights"]))
                if m.get("pros"):
                    lines.append("<b>⊕ Плюсы:</b>")
                    for p in m["pros"][:4]:
                        lines.append(f"  • {p}")
                if m.get("cons"):
                    lines.append("<b>⊖ Минусы:</b>")
                    for c in m["cons"][:3]:
                        lines.append(f"  • {c}")
                if m.get("reasoning"):
                    lines.append(f"<i>💡 {m['reasoning']}</i>")
                # Ссылка на «лучший» магазин
                best_url = enriched.get("best_url")
                if best_url:
                    lines.append(f"🔗 <a href=\"{best_url}\">Открыть в магазине</a>")
                lines.append("")
            lines.append("")
    else:
        # Fallback: старая структура items[]
        for item in (j.get("items") or []):
            lines.append(f"<b>{item.get('brand', '')} {item.get('model', '')}</b>")
            if item.get("price_rub"):
                lines.append(f"💰 {_format_price(item['price_rub'])} ₽")
            if item.get("highlights"):
                lines.append("✓ " + ", ".join(item["highlights"]))
            if item.get("caveats"):
                lines.append(f"⚠️ {item['caveats']}")
            lines.append("")

    # Итого
    tpe = j.get("total_price_estimate_rub") or {}
    if isinstance(tpe, dict) and (tpe.get("min") or tpe.get("max")):
        tmin = tpe.get("min", 0)
        tmax = tpe.get("max", 0)
        if tmin and tmax and tmin != tmax:
            lines.append(f"<b>ИТОГО: {_format_price(tmin)} — {_format_price(tmax)} ₽</b> · {j.get('budget_status', '')}")
        else:
            lines.append(f"<b>ИТОГО: {_format_price(tmin or tmax)} ₽</b> · {j.get('budget_status', '')}")
    elif j.get("total_price_rub"):
        lines.append(f"<b>ИТОГО: {_format_price(j['total_price_rub'])} ₽</b> · {j.get('budget_status', '')}")

    if j.get("warnings"):
        lines.append("\n⚠️ " + "; ".join(j["warnings"]))
    if lead_id:
        lines.append(f"\n<i>ID: {lead_id[:8]}</i>")
    return "\n".join(lines)


def _format_price(n: int | float) -> str:
    if n is None:
        return "—"
    s = str(int(round(float(n))))
    # Разделители тысяч пробелом
    return " ".join([s[max(0, len(s) - 3 * (i + 1)):len(s) - 3 * i] for i in range((len(s) + 2) // 3)][::-1]).strip()


def _initial(name: str) -> str:
    return ((name or "").strip()[:1] or "?").upper()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _format_date(d) -> str | None:
    if not d:
        return None
    if isinstance(d, datetime):
        return d.strftime("%d.%m.%Y")
    return str(d)


def _short_id() -> str:
    return uuid.uuid4().hex[:13]


async def _safe_json(request: Request) -> dict[str, Any]:
    try:
        return await request.json()
    except Exception:
        return {}
