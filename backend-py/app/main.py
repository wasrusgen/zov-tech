"""ЗОВ Backend — FastAPI app. Полный порт Apps Script Code.gs."""
from __future__ import annotations
import base64
import json
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone, timedelta
import secrets
from pathlib import Path
from typing import Any
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from .config import get_config
from .auth import verify_init_data
from . import sheets, ai, telegram as tg, proxy_pool, catalog, geocoder, drive
from . import parsers
from . import proposals as proposals_mod
from .parsers import dns as parser_dns, wb as parser_wb, ozon as parser_ozon, yamarket as parser_ym, citilink as parser_cl

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("zov.backend")

app = FastAPI(title="ZOV Backend", version="2.0")

# Каталог под фото замеров (монтируется как volume в docker-compose)
PHOTOS_DIR = Path(os.environ.get("PHOTOS_DIR", "/app/photos"))
try:
    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
except Exception as _e:
    logging.getLogger("zov.backend").warning("Не удалось создать PHOTOS_DIR=%s: %s", PHOTOS_DIR, _e)

_SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_\-]{1,64}$")
_SAFE_FILE_RE = re.compile(r"^[A-Za-z0-9_\-.]{1,80}$")

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
# Startup: канонизация схем таблиц
# =================================================================

@app.on_event("startup")
async def _on_startup() -> None:
    """При запуске бэкенда канонизируем схему Measurements один раз.
    Это исправляет рассинхронизацию порядка колонок без ручного вмешательства."""
    import asyncio
    try:
        await asyncio.to_thread(_ensure_measurements_sheet)
        log.info("Startup: Measurements schema OK")
    except Exception as e:
        log.warning("Startup: Measurements schema check failed (non-fatal): %s", e)


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
        "measurements":  _handle_measurements_list,
        "measurement_detail": _handle_measurement_detail,
        "podbor":        _handle_podbor,
        "clients":       _handle_clients,
        "lead":          _handle_lead,
        "grant_role":    _handle_grant_role,
        "staff_list":    _handle_staff_list,
        "measurement_request":   _handle_measurement_request,
        "measurement_inbox":     _handle_measurement_inbox,
        "measurement_schedule":  _handle_measurement_schedule,
        "measurement_next_no":   _handle_measurement_next_no,
        "measurement_logistics": _handle_measurement_logistics,
        "geocode":               _handle_geocode,
        "client_note":           _handle_client_note,
        "client_create":         _handle_client_create,
        "client_update":         _handle_client_update,
        "client_delete":         _handle_client_delete,
        "measurement_design_upload": _handle_measurement_design_upload,
        "measurement_add_photos":    _handle_measurement_add_photos,
        "measurement_decision":  _handle_measurement_decision,
        "measurement_set_status": _handle_measurement_set_status,
        "manager_pending":       _handle_manager_pending,
        "assembly_create":       _handle_assembly_create,
        "assembly_list":         _handle_assembly_list,
        "assembly_detail":       _handle_assembly_detail,
        "assembly_set_kitchen_price": _handle_assembly_set_kitchen_price,
        "sign_request_create":   _handle_sign_request_create,
        "sign_request_submit":   _handle_sign_request_submit,
        "proposal_brief":        proposals_mod.handle_brief,
        "proposal_create":       proposals_mod.handle_create,
        "proposal_upsert_variant": proposals_mod.handle_upsert_variant,
        "proposal_remove_variant": proposals_mod.handle_remove_variant,
        "proposal_send":         proposals_mod.handle_send,
        "proposal_list":         proposals_mod.handle_list,
        "proposal_detail":       proposals_mod.handle_detail,
        "proposal_vote":         proposals_mod.handle_vote,
        "proposal_client_submit": proposals_mod.handle_client_submit,
        "contract_review":        _handle_contract_review,
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


@app.post("/api/clients")
async def api_clients(request: Request):
    body = await _safe_json(request)
    return _handle_clients(body)


@app.post("/api/lead")
async def api_lead(request: Request):
    body = await _safe_json(request)
    return _handle_lead(body)


@app.post("/api/measurements")
async def api_measurements(request: Request):
    body = await _safe_json(request)
    return _handle_measurements_list(body)


@app.post("/api/measurement_detail")
async def api_measurement_detail(request: Request):
    body = await _safe_json(request)
    return _handle_measurement_detail(body)


@app.post("/api/measurement_request")
async def api_measurement_request(request: Request):
    body = await _safe_json(request)
    return _handle_measurement_request(body)


@app.post("/api/measurement_inbox")
async def api_measurement_inbox(request: Request):
    body = await _safe_json(request)
    return _handle_measurement_inbox(body)


@app.post("/api/measurement_schedule")
async def api_measurement_schedule(request: Request):
    body = await _safe_json(request)
    return _handle_measurement_schedule(body)


@app.post("/api/measurement_next_no")
async def api_measurement_next_no(request: Request):
    body = await _safe_json(request)
    return _handle_measurement_next_no(body)


@app.post("/api/measurement_logistics")
async def api_measurement_logistics(request: Request):
    body = await _safe_json(request)
    return _handle_measurement_logistics(body)


@app.post("/api/geocode")
async def api_geocode(request: Request):
    body = await _safe_json(request)
    return _handle_geocode(body)


@app.post("/api/client_note")
async def api_client_note(request: Request):
    body = await _safe_json(request)
    return _handle_client_note(body)


@app.post("/api/client_create")
async def api_client_create(request: Request):
    body = await _safe_json(request)
    try:
        return _handle_client_create(body)
    except Exception as e:
        log.exception("client_create error")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/client_delete")
async def api_client_delete(request: Request):
    body = await _safe_json(request)
    try:
        return _handle_client_delete(body)
    except Exception as e:
        log.exception("client_delete error")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/client_update")
async def api_client_update(request: Request):
    body = await _safe_json(request)
    try:
        return _handle_client_update(body)
    except Exception as e:
        log.exception("client_update error")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/measurement_design_upload")
async def api_measurement_design_upload(request: Request):
    body = await _safe_json(request)
    return _handle_measurement_design_upload(body)


@app.post("/api/measurement_decision")
async def api_measurement_decision(request: Request):
    body = await _safe_json(request)
    return _handle_measurement_decision(body)


@app.post("/api/measurement_set_status")
async def api_measurement_set_status(request: Request):
    body = await _safe_json(request)
    return _handle_measurement_set_status(body)


@app.post("/api/measurement_add_photos")
async def api_measurement_add_photos(request: Request):
    body = await _safe_json(request)
    return _handle_measurement_add_photos(body)


@app.post("/api/manager_pending")
async def api_manager_pending(request: Request):
    body = await _safe_json(request)
    return _handle_manager_pending(body)


@app.post("/api/assembly_create")
async def api_assembly_create(request: Request):
    body = await _safe_json(request)
    return _handle_assembly_create(body)


@app.post("/api/assembly_list")
async def api_assembly_list(request: Request):
    body = await _safe_json(request)
    return _handle_assembly_list(body)


@app.post("/api/assembly_detail")
async def api_assembly_detail(request: Request):
    body = await _safe_json(request)
    return _handle_assembly_detail(body)


@app.post("/api/assembly_set_kitchen_price")
async def api_assembly_set_kitchen_price(request: Request):
    body = await _safe_json(request)
    return _handle_assembly_set_kitchen_price(body)


@app.post("/api/grant_role")
async def api_grant_role(request: Request):
    """Админ выдаёт роль другому пользователю.
    body: {initData, target_tg_id, role: 'measurer'|'assembler'|'manager'|'client', action: 'grant'|'revoke'}"""
    body = await _safe_json(request)
    return _handle_grant_role(body)


@app.post("/api/staff_list")
async def api_staff_list(request: Request):
    body = await _safe_json(request)
    return _handle_staff_list(body)


@app.get("/api/photo/{measurement_id}/{filename}")
async def api_photo(measurement_id: str, filename: str):
    """Отдаёт фото замера. Защита от path traversal — только разрешённые id и имена."""
    if not _SAFE_ID_RE.match(measurement_id) or not _SAFE_FILE_RE.match(filename):
        return JSONResponse({"error": "bad_path"}, status_code=400)
    if filename.startswith(".") or ".." in filename:
        return JSONResponse({"error": "bad_path"}, status_code=400)
    p = PHOTOS_DIR / measurement_id / filename
    try:
        p_resolved = p.resolve()
        if PHOTOS_DIR.resolve() not in p_resolved.parents:
            return JSONResponse({"error": "bad_path"}, status_code=400)
    except Exception:
        return JSONResponse({"error": "bad_path"}, status_code=400)
    if not p.exists() or not p.is_file():
        return JSONResponse({"error": "not_found"}, status_code=404)
    ext = filename.rsplit(".", 1)[-1].lower()
    media = {
        "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "png": "image/png", "webp": "image/webp",
        "pdf": "application/pdf",
        "dwg": "application/acad",
        "dxf": "application/dxf",
    }.get(ext, "application/octet-stream")
    return FileResponse(str(p), media_type=media)


@app.get("/api/daily_reminders")
async def api_daily_reminders(request: Request):
    """Внутренний эндпоинт для бота: клиенты с годовщиной договора сегодня (МСК).
    Защищён через заголовок Authorization: Bearer <INTERNAL_SECRET>."""
    cfg = get_config()
    secret = cfg.internal_secret
    auth_header = request.headers.get("Authorization", "")
    if not secret or auth_header != f"Bearer {secret}":
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    return JSONResponse(_handle_daily_reminders())


@app.post("/api/shipments")
async def api_shipments(request: Request):
    """Отгрузки из ОТГРУЗКИ.xlsx (Google Drive). Только для менеджера."""
    body = await _safe_json(request)
    import asyncio
    return JSONResponse(await asyncio.to_thread(_handle_shipments, body))


@app.post("/api/arrivals")
async def api_arrivals(request: Request):
    """Поступления на склад СПб из «Поступление заказов на склад СПб.xlsx». Только для менеджера."""
    body = await _safe_json(request)
    import asyncio
    return JSONResponse(await asyncio.to_thread(_handle_arrivals, body))


@app.post("/api/proposal_brief")
async def api_proposal_brief(request: Request):
    body = await _safe_json(request)
    return JSONResponse(proposals_mod.handle_brief(body))

@app.post("/api/proposal_create")
async def api_proposal_create(request: Request):
    body = await _safe_json(request)
    return JSONResponse(proposals_mod.handle_create(body))

@app.post("/api/proposal_upsert_variant")
async def api_proposal_upsert_variant(request: Request):
    body = await _safe_json(request)
    return JSONResponse(proposals_mod.handle_upsert_variant(body))

@app.post("/api/proposal_remove_variant")
async def api_proposal_remove_variant(request: Request):
    body = await _safe_json(request)
    return JSONResponse(proposals_mod.handle_remove_variant(body))

@app.post("/api/proposal_send")
async def api_proposal_send(request: Request):
    body = await _safe_json(request)
    return JSONResponse(proposals_mod.handle_send(body))

@app.post("/api/proposal_list")
async def api_proposal_list(request: Request):
    body = await _safe_json(request)
    return JSONResponse(proposals_mod.handle_list(body))

@app.post("/api/proposal_detail")
async def api_proposal_detail(request: Request):
    body = await _safe_json(request)
    return JSONResponse(proposals_mod.handle_detail(body))

@app.post("/api/proposal_vote")
async def api_proposal_vote(request: Request):
    body = await _safe_json(request)
    return JSONResponse(proposals_mod.handle_vote(body))

@app.post("/api/proposal_client_submit")
async def api_proposal_client_submit(request: Request):
    body = await _safe_json(request)
    return JSONResponse(proposals_mod.handle_client_submit(body))


@app.post("/api/contract_review")
async def api_contract_review(request: Request):
    """AI-анализ текста договора. GigaChat → структурированный разбор на русском."""
    body = await _safe_json(request)
    import asyncio
    return JSONResponse(await asyncio.to_thread(_handle_contract_review, body))


def _handle_daily_reminders() -> dict[str, Any]:
    """Находит клиентов с годовщиной договора сегодня по МСК.
    Дедуплицирует: один менеджер + один клиент = одно уведомление,
    даже если по клиенту несколько строк в Measurements."""
    from datetime import timedelta
    moscow_now = datetime.now(timezone.utc) + timedelta(hours=3)
    today_md = (moscow_now.month, moscow_now.day)
    current_year = moscow_now.year

    reminders: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()  # (manager_tg_id, client_key)

    try:
        ws = sheets.sheet("Measurements")
        rows = ws.get_all_values()
    except Exception as e:
        log.exception("daily_reminders: не удалось прочитать Measurements")
        return {"error": str(e)}

    if not rows or len(rows) < 2:
        return {"ok": True, "reminders": [], "date": moscow_now.strftime("%d.%m.%Y")}

    headers = rows[0]
    for r in rows[1:]:
        row = dict(zip(headers, r + [""] * max(0, len(headers) - len(r))))

        if row.get("archived_at"):
            continue

        contract_date_raw = (row.get("contract_date") or "").strip()
        if not contract_date_raw:
            continue

        manager_tg_id = (row.get("manager_tg_id") or "").strip()
        if not manager_tg_id:
            continue

        # Парсим дату договора: ISO YYYY-MM-DD или DD.MM.YYYY
        cd = None
        for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
            try:
                cd = datetime.strptime(contract_date_raw[:10], fmt)
                break
            except ValueError:
                continue
        if cd is None:
            continue

        # Годовщина — месяц и день совпадают с сегодня
        if (cd.month, cd.day) != today_md:
            continue

        # Договор должен быть из прошлых лет, не из нынешнего
        if cd.year >= current_year:
            continue

        client_tg_id = (row.get("client_tg_id") or "").strip()
        client_name = (row.get("client_name") or "Без имени").strip()
        client_key = client_tg_id or client_name.lower()

        dedup_key = (manager_tg_id, client_key)
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        years = current_year - cd.year
        reminders.append({
            "manager_tg_id": manager_tg_id,
            "client_name": client_name,
            "contract_date": contract_date_raw,
            "years": years,
        })

    log.info("daily_reminders: %d годовщин на %s", len(reminders), moscow_now.strftime("%d.%m.%Y"))
    return {"ok": True, "reminders": reminders, "date": moscow_now.strftime("%d.%m.%Y")}


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


from fastapi import BackgroundTasks


_CATALOG_REFRESH_STATUS = {"running": False, "last_result": None, "started_at": None}


def _bg_refresh(categories, per_brand, delay):
    """Фоновая задача обновления каталога — пишет статус в глобал."""
    import datetime as _dt
    _CATALOG_REFRESH_STATUS["running"] = True
    _CATALOG_REFRESH_STATUS["started_at"] = _dt.datetime.now(_dt.timezone.utc).isoformat()
    try:
        result = catalog.refresh_catalog(
            categories=categories,
            per_brand=per_brand,
            delay_sec=delay,
        )
        _CATALOG_REFRESH_STATUS["last_result"] = result
    except Exception as e:
        log.exception("bg catalog refresh failed")
        _CATALOG_REFRESH_STATUS["last_result"] = {"ok": False, "error": str(e)}
    finally:
        _CATALOG_REFRESH_STATUS["running"] = False


@app.post("/api/catalog/refresh")
def api_catalog_refresh(background: BackgroundTasks,
                        cat: str = "", per_brand: int = 2, delay: float = 1.0):
    """Запускает refresh в ФОНЕ. Возвращает сразу, статус смотри в /api/catalog/refresh_status.

    Параметры:
      cat: одна категория или пусто = все 8 (очень долго)
      per_brand: сколько моделей на (brand × category) — default 2
      delay: задержка между запросами, сек — default 1.0
    """
    if _CATALOG_REFRESH_STATUS["running"]:
        return {"ok": False, "error": "already running", "started_at": _CATALOG_REFRESH_STATUS["started_at"]}

    categories = [cat] if cat else None
    background.add_task(
        _bg_refresh,
        categories,
        max(1, min(per_brand, 5)),
        max(0.0, min(delay, 10.0)),
    )
    return {
        "ok": True,
        "queued": True,
        "categories": categories or "all",
        "hint": "GET /api/catalog/refresh_status — узнать прогресс",
    }


@app.get("/api/catalog/refresh_status")
def api_catalog_refresh_status():
    """Статус последнего/текущего refresh'а каталога."""
    return _CATALOG_REFRESH_STATUS


@app.post("/api/catalog/clear")
def api_catalog_clear(cat: str = ""):
    """Удаляет всё содержимое каталога (или одной категории)."""
    removed = catalog.clear_catalog(category=cat or None)
    return {"ok": True, "removed": removed, "category": cat or "all"}


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

    # Fallback для Telegram Desktop side-panel — initData может приходить пустым.
    # Доверяем initDataUnsafe.user (НЕпроверенным данным) — только для UI-режима.
    # Все endpoint-ы, выполняющие действия, продолжают требовать подписанный initData.
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        unsafe_user = unsafe.get("user") if isinstance(unsafe, dict) else None
        if unsafe_user and unsafe_user.get("id"):
            auth = {
                "user": unsafe_user,
                "auth_date": int(time.time()),
                "start_param": unsafe.get("start_param"),
                "_unsafe": True,
            }
        else:
            return {"error": "invalid_init_data"}

    tg_user = auth["user"]
    tg_id = tg_user["id"]
    start_param = body.get("startParam") or auth.get("start_param")
    explicit_role = body.get("role") if body.get("role") in ("manager", "client", "staff") else None
    user = sheets.get_or_create_user(tg_user, start_param, explicit_role)
    # Берём roles из словаря если они уже распарсены (после grant_role),
    # иначе fallback на парсинг сырой CSV-колонки
    roles = user.get("roles") or sheets.parse_roles(user.get("role", ""))

    # Staff (замерщик / сборщик) — отдельный кабинет, доступен только тем у кого роль выдана
    if explicit_role == "staff":
        has_measurer = "measurer" in roles
        has_assembler = "assembler" in roles
        if not (has_measurer or has_assembler):
            return {
                "role": "staff",
                "roles": roles,
                "error": "no_staff_role",
                "user": {
                    "tg_id": tg_id,
                    "full_name": user.get("full_name", ""),
                    "avatar_initial": _initial(user.get("full_name") or tg_user.get("first_name", "")),
                },
            }
        full_name = user.get("full_name", "") or tg_user.get("first_name", "")
        return {
            "role": "staff",
            "roles": roles,
            "user": {
                "tg_id": tg_id,
                "full_name": full_name,
                "avatar_initial": _initial(full_name),
            },
            "capabilities": {
                "measurer": has_measurer,
                "assembler": has_assembler,
            },
        }

    if "manager" in roles:
        m = sheets.get_manager_profile(tg_id) or {
            "full_name": user.get("full_name", ""), "salon": "",
            "is_zov_employee": False, "status": "lapsed", "active_until": None,
        }
        return {
            "role": "manager",
            "roles": roles,
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
        "roles": roles,
        "user": {
            "tg_id": tg_id,
            "full_name": full_name,
            "avatar_initial": _initial(full_name or tg_user.get("first_name", "")),
        },
        "manager": manager,
    }


_DATA_URL_RE = re.compile(r"^data:image/(jpeg|jpg|png|webp);base64,(.+)$", re.DOTALL)

# Маппинг тип фото → префикс имени файла (по чек-листу замера)
_PHOTO_KIND_PREFIX = {
    "wall1":   "w1",
    "wall2":   "w2",
    "wall3":   "w3",
    "wall4":   "w4",
    "plan":    "plan",
    "general": "general",
    "detail":  "detail",
}


def _save_measurement_photo(
    measurement_id: str, idx: int, data_url: str,
    kind: str | None = None, kind_seq: int = 0,
) -> str | None:
    """Сохраняет фото с осмысленным именем: `w1.jpg` / `plan.jpg` / `general_3.jpg`.
    Если несколько фото одного типа — добавляем суффикс _2, _3.
    Возвращает имя файла или None при ошибке."""
    if not isinstance(data_url, str):
        return None
    m = _DATA_URL_RE.match(data_url.strip())
    if not m:
        return None
    ext = "jpg" if m.group(1) in ("jpeg", "jpg") else m.group(1)
    try:
        raw = base64.b64decode(m.group(2), validate=False)
    except Exception:
        return None
    if len(raw) > 10 * 1024 * 1024:  # 10 MB hard cap
        return None
    if not _SAFE_ID_RE.match(measurement_id):
        return None
    target_dir = PHOTOS_DIR / measurement_id
    try:
        target_dir.mkdir(parents=True, exist_ok=True)
        prefix = _PHOTO_KIND_PREFIX.get(kind or "", "")
        if prefix:
            # wall1/2/3/4 — один на стену; если дубль — добавляем _2, _3...
            if prefix.startswith("w") and len(prefix) == 2:
                name_base = prefix
                candidate = f"{name_base}.{ext}"
                n = 2
                while (target_dir / candidate).exists():
                    candidate = f"{name_base}_{n}.{ext}"
                    n += 1
                name = candidate
            else:
                # plan / general / detail — могут быть множественные
                name = f"{prefix}_{kind_seq}.{ext}" if kind_seq > 0 else f"{prefix}.{ext}"
                if (target_dir / name).exists():
                    name = f"{prefix}_{kind_seq + 1}.{ext}"
        else:
            name = f"{idx}.{ext}"
        (target_dir / name).write_bytes(raw)
        return name
    except Exception:
        log.warning("Не удалось сохранить фото %d для замера %s", idx, measurement_id)
        return None


def _measurement_columns() -> list[str]:
    """Гарантирует что у листа Measurements есть все нужные колонки (расширенный набор)."""
    return [
        "id", "ts", "client_tg_id", "manager_tg_id", "filled_by",
        "layout", "area_m2", "ceiling_mm", "walls", "openings", "infra", "niches",
        "photos", "notes", "status",
        # Поля Commit B (workflow)
        "assigned_to_tg_id", "requested_by_tg_id", "scheduled_at",
        "address", "client_name", "client_phone",
        # Поля Commit C (структура замера по чек-листу)
        "zamer_no", "zamer_date", "floor_base", "photos_meta",
        # Поля для приблизительной даты от менеджера (Commit C2)
        # preferred_type: specific | this_week | next_week | tbd
        # preferred_date: ISO date если specific
        # preferred_time_of_day: morning | day | evening
        # preferred_note: «после звонка», «не раньше вторника», ...
        "preferred_type", "preferred_date", "preferred_time_of_day", "preferred_note",
        # Логистика — заполняет замерщик на месте (Commit C3), нужна также сборщику
        # parking_type: free | paid | street | none
        "entrance", "floor", "gps_lat", "gps_lng",
        "parking_type", "parking_note", "delivery_notes",
        # Google Calendar — событие при scheduled
        "gcal_event_id", "gcal_event_url",
        # Идентификаторы клиента и договора (нумерация)
        "client_no", "contract_no", "contract_date",
        # Soft-delete
        "archived_at",
        # Чертёж/документы — DWG, PDF, PNG превью (B)
        "design_files",
        # Решение менеджера про подбор техники после замера (E)
        # podbor_decision: pending | needed | not_needed | later | done
        # podbor_decision_at — когда зафиксировано решение
        "podbor_decision", "podbor_decision_at", "podbor_lead_id",
    ]


def _ensure_measurements_sheet() -> None:
    """Канонизирует схему Measurements:
    1. Создаёт лист если отсутствует.
    2. Добавляет недостающие колонки.
    3. Если порядок колонок не совпадает с _measurement_columns() —
       перестраивает лист: читает все данные, переставляет колонки по канону,
       перезаписывает лист целиком. Данные не теряются.
    """
    want = _measurement_columns()

    # --- Создать лист если не существует ---
    try:
        ws = sheets.sheet("Measurements")
        existing = ws.row_values(1)
    except Exception:
        sheets.ensure_sheet("Measurements", want)
        log.info("Measurements: создан с каноническим заголовком")
        return

    if not existing:
        ws.update("A1", [want])
        log.info("Measurements: заголовок установлен (лист был пуст)")
        return

    # --- Добавить недостающие колонки (без нарушения порядка) ---
    missing = [c for c in want if c not in existing]
    if missing:
        # Дописываем только в конец; данные встают в те позиции,
        # которые append_named_row() потом найдёт по имени
        ws.update("A1", [existing + missing])
        existing = existing + missing
        log.info("Measurements: добавлены колонки %s", missing)

    # --- Канонизация порядка если он не совпадает ---
    # Берём только колонки из канона (extra-колонки вне канона сохраняем справа)
    canon_set = set(want)
    extra = [c for c in existing if c not in canon_set]
    canonical_order = want + extra           # канон + внекановые справа

    if existing == canonical_order:
        return  # уже в правильном порядке — ничего не делаем

    log.info("Measurements: обнаружен неканонический порядок колонок — запускаем миграцию")
    try:
        all_rows = ws.get_all_values()
        if len(all_rows) < 2:
            # Данных нет — просто переписать заголовок
            ws.update("A1", [canonical_order])
            log.info("Measurements: заголовок канонизирован (данных не было)")
            return

        old_headers = all_rows[0]
        data_rows   = all_rows[1:]

        # Перестраиваем каждую строку: читаем по имени, пишем в канонический порядок
        new_rows = []
        for r in data_rows:
            old_dict = dict(zip(old_headers, r + [""] * max(0, len(old_headers) - len(r))))
            new_rows.append([old_dict.get(col, "") for col in canonical_order])

        # Перезаписываем лист целиком
        ws.clear()
        ws.update("A1", [canonical_order] + new_rows, value_input_option="USER_ENTERED")
        log.info("Measurements: миграция завершена, %d строк пересортировано", len(new_rows))
    except Exception as e:
        log.error("Measurements: ошибка канонизации (данные не тронуты): %s", e)


def _row_for_measurement(measurement_id: str, ts: str, **fields) -> dict[str, str]:
    """Возвращает словарь колонка→значение для записи в Measurements.
    Используется с sheets.append_named_row() — безопасно к порядку колонок."""
    base: dict[str, Any] = {
        "id": measurement_id, "ts": ts,
        "client_tg_id": "", "manager_tg_id": "", "filled_by": "",
        "layout": "", "area_m2": "", "ceiling_mm": "",
        "walls": "{}", "openings": "{}", "infra": "{}", "niches": "{}",
        "photos": "", "notes": "", "status": "submitted",
        "assigned_to_tg_id": "", "requested_by_tg_id": "", "scheduled_at": "",
        "address": "", "client_name": "", "client_phone": "",
        "zamer_no": "", "zamer_date": "", "floor_base": "", "photos_meta": "",
        "preferred_type": "", "preferred_date": "", "preferred_time_of_day": "", "preferred_note": "",
        "entrance": "", "floor": "", "gps_lat": "", "gps_lng": "",
        "parking_type": "", "parking_note": "", "delivery_notes": "",
        "gcal_event_id": "", "gcal_event_url": "",
        "client_no": "", "contract_no": "", "contract_date": "",
        "archived_at": "",
        "design_files": "",
        "podbor_decision": "", "podbor_decision_at": "", "podbor_lead_id": "",
    }
    base.update(fields)
    # Нормализуем: None → "", всё приводим к str
    return {k: str(v) if v is not None else "" for k, v in base.items()}


def _handle_measurement(body: dict[str, Any]) -> dict[str, Any]:
    """Полная сдача замера (когда форма заполнена). Поддерживает 2 режима:
    1. Создать новый замер с данными (старый MVP-режим — сам менеджер сделал замер)
    2. Обновить существующий request — статус → completed (для замерщика после посещения)
    """
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user:
        return {"error": "user_not_found"}

    _ensure_measurements_sheet()
    m = body.get("measurement") or {}
    existing_id = (m.get("measurement_id") or body.get("measurement_id") or "").strip()
    update_mode = bool(existing_id)
    is_manager = sheets.has_role(user, "manager")
    is_measurer = sheets.has_role(user, "measurer")

    measurement_id = existing_id or _short_id()
    if is_manager and not is_measurer:
        filled_by = "manager_for_client"
    elif is_measurer:
        filled_by = "measurer"
    else:
        filled_by = "client_self"

    # При update-mode загружаем существующую заявку и проверяем права
    existing_row = None
    if update_mode:
        existing_row = sheets.find_row("Measurements", "id", measurement_id)
        if not existing_row:
            return {"error": "measurement_not_found"}
        # Только назначенный замерщик или менеджер-владелец могут завершить
        if str(existing_row.get("assigned_to_tg_id")) != str(tg_id) and \
           str(existing_row.get("manager_tg_id")) != str(tg_id):
            return {"error": "forbidden"}

    client_tg_id = (existing_row or {}).get("client_tg_id") or \
                   (m.get("client_tg_id") if is_manager else tg_id) or ""
    manager_tg_id = (existing_row or {}).get("manager_tg_id") or (
        tg_id if is_manager else
        (sheets.find_row("Clients", "tg_id", tg_id) or {}).get("manager_tg_id", "")
    )

    client_name = m.get("client_name") or (existing_row or {}).get("client_name", "")
    client_phone = m.get("client_phone") or (existing_row or {}).get("client_phone", "")
    address = m.get("address") or (existing_row or {}).get("address", "")
    assigned_to = (existing_row or {}).get("assigned_to_tg_id", "")
    requested_by = (existing_row or {}).get("requested_by_tg_id", manager_tg_id or "")
    scheduled_at = (existing_row or {}).get("scheduled_at", "")

    # Прикрепляем имя/телефон/адрес к notes (для совместимости со старым кодом)
    notes_full = m.get("notes", "")
    extras = []
    if client_name:
        extras.append(f"Клиент: {client_name}")
    if client_phone:
        extras.append(f"Тел: {client_phone}")
    if address:
        extras.append(f"Адрес: {address}")
    if extras:
        notes_full = " · ".join(extras) + ("\n" + notes_full if notes_full else "")

    # Сохраняем фотографии (data-URL → файлы), в Sheets кладём только имена.
    # Имена структурные: w1.jpg, plan.jpg, general_2.jpg — по типу из photos_meta.
    raw_photos = m.get("photos") or []
    photos_meta = m.get("photos_meta") or []
    saved_photos: list[str] = []
    kind_counter: dict[str, int] = {}  # сколько раз уже встречался каждый kind
    if isinstance(raw_photos, list):
        for i, p in enumerate(raw_photos[:30]):  # хард-кап 30 фото на замер
            kind = ""
            if i < len(photos_meta) and isinstance(photos_meta[i], dict):
                kind = photos_meta[i].get("kind", "")
            kind_counter[kind] = kind_counter.get(kind, 0) + 1
            seq = kind_counter[kind] - 1  # 0 для первого, 1 для второго и т.д.
            if isinstance(p, str) and p.startswith("data:"):
                fn = _save_measurement_photo(measurement_id, i, p, kind=kind, kind_seq=seq)
                if fn:
                    saved_photos.append(fn)
            elif isinstance(p, str) and p and not p.startswith("data:"):
                saved_photos.append(p)

    status_new = "completed"
    walls_json = json.dumps(m.get("walls") or {}, ensure_ascii=False)
    openings_json = json.dumps(m.get("openings") or {}, ensure_ascii=False)
    infra_json = json.dumps(m.get("infra") or {}, ensure_ascii=False)
    niches_json = json.dumps(m.get("niches") or {}, ensure_ascii=False)
    photos_str = ",".join(saved_photos)
    photos_meta_json = json.dumps(m.get("photos_meta") or [], ensure_ascii=False)

    zamer_no   = (m.get("zamer_no")   or "").strip()
    zamer_date = (m.get("zamer_date") or "").strip()
    floor_base = (m.get("floor_base") or "").strip()

    if update_mode:
        # Обновляем существующую заявку — статус → completed, плюс заполняем поля
        updates = {
            "filled_by": filled_by,
            "layout": m.get("layout", ""),
            "area_m2": m.get("area_m2", ""),
            "ceiling_mm": m.get("ceiling_mm", ""),
            "walls": walls_json,
            "openings": openings_json,
            "infra": infra_json,
            "niches": niches_json,
            "photos": photos_str,
            "photos_meta": photos_meta_json,
            "notes": notes_full,
            "status": status_new,
            "zamer_no": zamer_no,
            "zamer_date": zamer_date,
            "floor_base": floor_base,
        }
        for col, val in updates.items():
            sheets.update_cell_by_key("Measurements", "id", measurement_id, col, val)
    else:
        sheets.append_named_row("Measurements", _row_for_measurement(
            measurement_id, _now_iso(),
            client_tg_id=client_tg_id or "",
            manager_tg_id=manager_tg_id or "",
            filled_by=filled_by,
            layout=m.get("layout", ""),
            area_m2=m.get("area_m2", ""),
            ceiling_mm=m.get("ceiling_mm", ""),
            walls=walls_json,
            openings=openings_json,
            infra=infra_json,
            niches=niches_json,
            photos=photos_str,
            photos_meta=photos_meta_json,
            notes=notes_full,
            status=status_new,
            assigned_to_tg_id=assigned_to,
            requested_by_tg_id=requested_by,
            scheduled_at=scheduled_at,
            address=address,
            client_name=client_name,
            client_phone=client_phone,
            zamer_no=zamer_no,
            zamer_date=zamer_date,
            floor_base=floor_base,
        ))

    if client_tg_id:
        sheets.update_cell_by_key("Clients", "tg_id", client_tg_id, "last_measurement_id", measurement_id)

    # Уведомления
    if update_mode and existing_row:
        # Замерщик завершил — пишем менеджеру который создавал заявку
        notify_to = requested_by or manager_tg_id
        if notify_to and str(notify_to) != str(tg_id):
            tg.send_message(
                notify_to,
                f"✅ <b>Замер выполнен</b>\n"
                f"Клиент: <b>{client_name or '—'}</b>\n"
                f"Замерщик: {user.get('full_name') or tg_id}\n"
                f"Фото: {len(saved_photos)} шт\n\n"
                f"❓ <b>Клиенту потребуется помощь с подбором техники?</b>\n"
                f"Откройте кабинет — на главной появится карточка с этим вопросом."
            )
    elif filled_by == "client_self" and manager_tg_id:
        tg.send_message(
            manager_tg_id,
            f"📐 Новый замер от клиента <b>{user.get('full_name') or tg_id}</b>.\n"
            f"Площадь: {m.get('area_m2', '?')} м², форма: {m.get('layout', '?')}.\n"
            f"Открыть в кабинете для просмотра."
        )

    sheets.log_event("measurement_submitted", tg_id, {
        "id": measurement_id, "filled_by": filled_by, "update_mode": update_mode,
    })
    return {"ok": True, "id": measurement_id, "photos": saved_photos, "status": status_new}


def _handle_podbor(body: dict[str, Any]) -> dict[str, Any]:
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user:
        return {"error": "user_not_found"}
    if not sheets.has_role(user, "manager"):
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


def _handle_clients(body: dict[str, Any]) -> dict[str, Any]:
    """Возвращает список клиентов менеджера со сводкой по подборам.
    Агрегирует клиентов из Leads И Measurements (включая draft-карточки)."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if isinstance(unsafe, dict) and unsafe.get("user", {}).get("id"):
            auth = {"user": unsafe["user"]}
        else:
            return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "manager"):
        return {"error": "only_manager"}

    by_client: dict[str, dict[str, Any]] = {}

    def _ensure_client(key: str, name: str, phone: str, ctg_id: str):
        if key not in by_client:
            by_client[key] = {
                "client_name": name or "Без имени",
                "client_tg_id": ctg_id or None,
                "client_phone": phone or "",
                "address": "",
                "gps_lat": "",
                "gps_lng": "",
                "client_no": "",
                "contract_no": "",
                "contract_date": "",
                "leads_count": 0,
                "measurements_count": 0,
                "last_lead_at": "",
                "last_lead_id": "",
                "leads": [],
                # in_work=True если есть хотя бы один лид или замер не-draft
                "in_work": False,
            }
        else:
            # Заполним пустые поля если в этой записи есть данные
            c = by_client[key]
            if name and not c.get("client_name"): c["client_name"] = name
            if phone and not c.get("client_phone"): c["client_phone"] = phone
        return by_client[key]

    # 1. Из Leads — собираем подборы
    try:
        ws = sheets.sheet("Leads")
        rows = ws.get_all_values()
        if rows and len(rows) >= 2:
            headers = rows[0]
            for r in rows[1:]:
                row = dict(zip(headers, r + [""] * (len(headers) - len(r))))
                if str(row.get("manager_tg_id", "")) != str(tg_id):
                    continue
                client_name = (row.get("client_name") or "").strip()
                client_tg_id = (row.get("client_tg_id") or "").strip()
                phone = ""
                checklist_str = row.get("checklist", "")
                if checklist_str:
                    try:
                        cl = json.loads(checklist_str)
                        phone = cl.get("client_phone", "") or ""
                    except (ValueError, TypeError):
                        pass
                key = client_tg_id or client_name.lower()
                if not key:
                    continue
                c = _ensure_client(key, client_name, phone, client_tg_id)
                c["leads_count"] += 1
                c["in_work"] = True  # есть подбор — клиент в работе
                lead_id = row.get("id", "")
                created_at = row.get("created_at", "")
                status = row.get("status", "")
                c["leads"].append({"id": lead_id, "created_at": created_at, "status": status})
                if created_at > c["last_lead_at"]:
                    c["last_lead_at"] = created_at
                    c["last_lead_id"] = lead_id
                    if phone and not c.get("client_phone"): c["client_phone"] = phone
    except Exception as e:
        log.warning("Failed to read Leads: %s", e)

    # 2. Из Measurements — для draft-карточек и заявок без подборов
    try:
        ws = sheets.sheet("Measurements")
        rows = ws.get_all_values()
        if rows and len(rows) >= 2:
            headers = rows[0]
            for r in rows[1:]:
                row = dict(zip(headers, r + [""] * (len(headers) - len(r))))
                if str(row.get("manager_tg_id", "")) != str(tg_id):
                    continue
                if row.get("archived_at"):
                    continue  # soft-deleted клиент
                client_name = (row.get("client_name") or "").strip()
                client_phone = (row.get("client_phone") or "").strip()
                client_tg_id = (row.get("client_tg_id") or "").strip()
                client_no = (row.get("client_no") or "").strip()
                contract_no = (row.get("contract_no") or "").strip()
                contract_date = (row.get("contract_date") or "").strip()
                address = (row.get("address") or "").strip()
                m_status = (row.get("status") or "").strip()
                key = client_tg_id or client_name.lower()
                if not key:
                    continue
                c = _ensure_client(key, client_name, client_phone, client_tg_id)
                if client_no and not c.get("client_no"): c["client_no"] = client_no
                if contract_no and not c.get("contract_no"): c["contract_no"] = contract_no
                if contract_date and not c.get("contract_date"): c["contract_date"] = contract_date
                if address and not c.get("address"): c["address"] = address
                if client_phone and not c.get("client_phone"): c["client_phone"] = client_phone
                gps_lat = (row.get("gps_lat") or "").strip()
                gps_lng = (row.get("gps_lng") or "").strip()
                if gps_lat and gps_lng and not c.get("gps_lat"): c["gps_lat"] = gps_lat; c["gps_lng"] = gps_lng
                c["measurements_count"] = c.get("measurements_count", 0) + 1
                # Замер не-draft = клиент в работе (requested/scheduled/completed)
                if m_status and m_status != "draft":
                    c["in_work"] = True
                # Если у клиента нет ни одного лида — last_at берём из measurement.ts
                ts = row.get("ts") or row.get("created_at") or ""
                if ts > c["last_lead_at"]:
                    c["last_lead_at"] = ts
    except Exception as e:
        log.warning("Failed to read Measurements for clients: %s", e)

    # 3. Из Assemblies — есть сборка = клиент в работе
    try:
        ws = sheets.sheet("Assemblies")
        rows = ws.get_all_values()
        if rows and len(rows) >= 2:
            headers = rows[0]
            for r in rows[1:]:
                row = dict(zip(headers, r + [""] * (len(headers) - len(r))))
                if str(row.get("manager_tg_id", "")) != str(tg_id):
                    continue
                if row.get("archived_at"):
                    continue
                a_name = (row.get("client_name") or "").strip()
                a_ctg = (row.get("client_tg_id") or "").strip()
                a_phone = (row.get("client_phone") or "").strip()
                key = a_ctg or a_name.lower()
                if not key:
                    continue
                c = _ensure_client(key, a_name, a_phone, a_ctg)
                c["in_work"] = True
    except Exception:
        # Лист может ещё не существовать — не критично
        pass

    # Сортируем по дате последней активности (новые сверху)
    clients = sorted(by_client.values(), key=lambda x: x.get("last_lead_at") or "", reverse=True)
    for c in clients:
        c["leads"].sort(key=lambda x: x.get("created_at", ""), reverse=True)

    return {"ok": True, "count": len(clients), "clients": clients}


def _handle_lead(body: dict[str, Any]) -> dict[str, Any]:
    """Возвращает детали одного лида (включая AI-ответ и checklist)."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]

    lead_id = body.get("lead_id") or body.get("id")
    if not lead_id:
        return {"error": "missing_lead_id"}

    row = sheets.find_row("Leads", "id", lead_id)
    if not row:
        return {"error": "lead_not_found"}

    # Проверяем что это лид этого менеджера
    if str(row.get("manager_tg_id", "")) != str(tg_id):
        return {"error": "forbidden"}

    # Парсим JSONы
    try:
        checklist = json.loads(row.get("checklist") or "{}")
    except (ValueError, TypeError):
        checklist = {}
    ai_response = row.get("ai_response") or ""
    try:
        ai_json = json.loads(ai_response) if ai_response else None
    except (ValueError, TypeError):
        ai_json = None

    return {
        "ok": True,
        "id": lead_id,
        "created_at": row.get("created_at"),
        "client_name": row.get("client_name"),
        "client_tg_id": row.get("client_tg_id"),
        "checklist": checklist,
        "ai": ai_json,
        "ai_text": ai_response if not ai_json else None,
        "status": row.get("status", ""),
    }


def _handle_grant_role(body: dict[str, Any]) -> dict[str, Any]:
    """Только админ может выдавать/отзывать роли."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    if int(tg_id) != int(cfg.admin_tg_id):
        return {"error": "admin_only"}

    target = body.get("target_tg_id")
    role = body.get("role", "").strip()
    action = body.get("action", "grant")
    if not target or not role:
        return {"error": "missing_fields"}
    try:
        target_int = int(target)
    except (TypeError, ValueError):
        return {"error": "bad_target"}

    if role not in sheets.VALID_ROLES:
        return {"error": "unknown_role", "valid": sorted(sheets.VALID_ROLES)}

    if action == "revoke":
        changed = sheets.revoke_role(target_int, role)
    else:
        changed = sheets.grant_role(target_int, role)

    sheets.log_event("role_changed", tg_id, {"target": target_int, "role": role, "action": action, "changed": changed})

    updated_user = sheets.find_user(target_int) or {}
    return {
        "ok": True,
        "target_tg_id": target_int,
        "changed": changed,
        "roles": sheets.parse_roles(updated_user.get("role", "")),
    }


def _handle_staff_list(body: dict[str, Any]) -> dict[str, Any]:
    """Список сотрудников с указанной ролью — для dropdown «выбрать замерщика»."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "manager"):
        return {"error": "only_manager"}

    role = (body.get("role") or "").strip()
    if role not in sheets.VALID_ROLES:
        return {"error": "unknown_role"}

    return {"ok": True, "role": role, "staff": sheets.list_users_with_role(role)}


def _handle_measurement_request(body: dict[str, Any]) -> dict[str, Any]:
    """Менеджер создаёт ЗАЯВКУ на замер (без замеров — пустая заготовка).
    body: {initData, client_name, client_phone, address, assigned_to_tg_id?, notes?, urgent?}
    urgent=True → немедленный push назначенному замерщику (или всем measurer-ам если не назначен)."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "manager"):
        return {"error": "only_manager"}

    _ensure_measurements_sheet()
    client_name = (body.get("client_name") or "").strip()
    client_phone = (body.get("client_phone") or "").strip()
    address = (body.get("address") or "").strip()
    assigned_to = str(body.get("assigned_to_tg_id") or "").strip()
    notes = (body.get("notes") or "").strip()
    urgent = bool(body.get("urgent", False))

    # Приблизительная дата визита (Commit C2)
    preferred_type = (body.get("preferred_type") or "tbd").strip()
    preferred_date = (body.get("preferred_date") or "").strip()
    preferred_time_of_day = (body.get("preferred_time_of_day") or "").strip()
    preferred_note = (body.get("preferred_note") or "").strip()
    if preferred_type not in ("specific", "this_week", "next_week", "tbd"):
        preferred_type = "tbd"
    if preferred_time_of_day not in ("morning", "day", "evening", ""):
        preferred_time_of_day = ""

    if not client_name or not client_phone:
        return {"error": "missing_client_info", "hint": "client_name and client_phone are required"}

    # Если назначен — проверим что у него есть роль measurer
    if assigned_to:
        try:
            assigned_user = sheets.find_user(int(assigned_to))
        except (TypeError, ValueError):
            assigned_user = None
        if not assigned_user or not sheets.has_role(assigned_user, "measurer"):
            return {"error": "assigned_not_measurer"}

    measurement_id = _short_id()
    sheets.append_named_row("Measurements", _row_for_measurement(
        measurement_id, _now_iso(),
        manager_tg_id=tg_id,
        filled_by="request",
        status="requested",
        assigned_to_tg_id=assigned_to,
        requested_by_tg_id=tg_id,
        address=address,
        client_name=client_name,
        client_phone=client_phone,
        notes=notes,
        preferred_type=preferred_type,
        preferred_date=preferred_date,
        preferred_time_of_day=preferred_time_of_day,
        preferred_note=preferred_note,
    ))

    # Уведомление назначенному замерщику
    if assigned_to:
        note_line = f"\nПримечание: {preferred_note}" if preferred_note else ""
        tg.send_message(
            int(assigned_to),
            f"📐 <b>Новая заявка на замер</b>\n\n"
            f"Клиент: <b>{client_name}</b>\n"
            f"Телефон: <code>{client_phone}</code>\n"
            f"Адрес: {address or '—'}\n"
            f"От менеджера: {user.get('full_name') or tg_id}"
            f"{note_line}\n\n"
            f"Откройте кабинет — согласуйте точную дату с клиентом."
        )

    # Срочный замер: push всем замерщикам или конкретному
    if urgent:
        scheduled_line = (
            f"📅 {preferred_date}" if preferred_type == "specific" and preferred_date
            else "📅 дата уточняется"
        )
        urgent_text = (
            f"⚡ <b>СРОЧНЫЙ ЗАМЕР</b>\n\n"
            f"📍 Адрес: {address or '—'}\n"
            f"{scheduled_line}\n"
            f"👤 {client_name}\n\n"
            f"Откройте MiniApp → Входящие"
        )
        if assigned_to:
            tg.send_message(int(assigned_to), urgent_text)
        else:
            measurers = sheets.find_users_by_role("measurer")
            for m in measurers:
                try:
                    m_tg_id = int(m.get("tg_id", 0))
                except (TypeError, ValueError):
                    continue
                if m_tg_id:
                    tg.send_message(m_tg_id, urgent_text)

    sheets.log_event("measurement_requested", tg_id, {
        "id": measurement_id, "assigned_to": assigned_to, "client": client_name, "urgent": urgent,
    })
    return {"ok": True, "id": measurement_id, "status": "requested", "assigned_to_tg_id": assigned_to}


def _handle_measurement_inbox(body: dict[str, Any]) -> dict[str, Any]:
    """Замерщик: список назначенных мне заявок (requested/scheduled/in_progress)."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "measurer"):
        return {"error": "only_measurer"}

    _ensure_measurements_sheet()
    try:
        ws = sheets.sheet("Measurements")
        rows = ws.get_all_values()
    except Exception as e:
        log.warning("inbox read failed: %s", e)
        return {"ok": True, "measurements": []}

    if not rows or len(rows) < 2:
        return {"ok": True, "measurements": []}
    headers = rows[0]
    active_statuses = {"requested", "scheduled", "in_progress"}
    out: list[dict[str, Any]] = []
    for r in rows[1:]:
        row = dict(zip(headers, r + [""] * (len(headers) - len(r))))
        if str(row.get("assigned_to_tg_id", "")) != str(tg_id):
            continue
        if row.get("status") not in active_statuses:
            continue
        out.append({
            "id": row.get("id"),
            "created_at": row.get("ts"),
            "status": row.get("status"),
            "scheduled_at": row.get("scheduled_at", ""),
            "client_name": row.get("client_name", ""),
            "client_phone": row.get("client_phone", ""),
            "address": row.get("address", ""),
            "notes": row.get("notes", ""),
            "manager_tg_id": row.get("manager_tg_id", ""),
            "requested_by_tg_id": row.get("requested_by_tg_id", ""),
            "preferred_type": row.get("preferred_type", ""),
            "preferred_date": row.get("preferred_date", ""),
            "preferred_time_of_day": row.get("preferred_time_of_day", ""),
            "preferred_note": row.get("preferred_note", ""),
        })
    # Назначенная дата → первая; затем requested без даты
    def _sort_key(item):
        sched = item.get("scheduled_at") or ""
        return (0 if sched else 1, sched, item.get("created_at") or "")
    out.sort(key=_sort_key)
    return {"ok": True, "count": len(out), "measurements": out}


def _handle_measurement_schedule(body: dict[str, Any]) -> dict[str, Any]:
    """Замерщик назначает дату посещения. body: {initData, measurement_id, scheduled_at}"""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "measurer"):
        return {"error": "only_measurer"}

    measurement_id = (body.get("measurement_id") or "").strip()
    scheduled_at = (body.get("scheduled_at") or "").strip()
    if not measurement_id or not scheduled_at:
        return {"error": "missing_fields"}

    row = sheets.find_row("Measurements", "id", measurement_id)
    if not row:
        return {"error": "measurement_not_found"}
    if str(row.get("assigned_to_tg_id")) != str(tg_id):
        return {"error": "forbidden"}

    sheets.update_cell_by_key("Measurements", "id", measurement_id, "scheduled_at", scheduled_at)
    sheets.update_cell_by_key("Measurements", "id", measurement_id, "status", "scheduled")

    # Google Calendar — создаём или обновляем событие
    gcal_url = ""
    try:
        from . import gcalendar
        existing_event_id = row.get("gcal_event_id") or ""
        client_name = row.get("client_name") or "—"
        address = row.get("address") or ""
        client_phone = row.get("client_phone") or ""
        descr_parts = [f"Клиент: {client_name}"]
        if client_phone: descr_parts.append(f"Телефон: {client_phone}")
        if row.get("preferred_note"): descr_parts.append(f"Примечание: {row.get('preferred_note')}")
        descr_parts.append(f"Замерщик: {user.get('full_name') or tg_id}")
        descr_parts.append(f"\nЗаявка: {measurement_id}")
        summary = f"Замер: {client_name}"
        description = "\n".join(descr_parts)

        if existing_event_id:
            ev = gcalendar.update_event(
                event_id=existing_event_id,
                summary=summary, description=description,
                start_iso=scheduled_at, location=address,
            )
        else:
            ev = gcalendar.create_event(
                summary=summary, description=description,
                start_iso=scheduled_at, location=address,
            )
        if ev:
            sheets.update_cell_by_key("Measurements", "id", measurement_id, "gcal_event_id", ev.get("id", ""))
            sheets.update_cell_by_key("Measurements", "id", measurement_id, "gcal_event_url", ev.get("html_link", ""))
            gcal_url = ev.get("html_link", "")
    except Exception as e:
        log.warning("GCal integration error: %s", e)

    # Уведомляем менеджера
    notify_to = row.get("requested_by_tg_id") or row.get("manager_tg_id")
    if notify_to and str(notify_to) != str(tg_id):
        try:
            cal_line = f"\n📅 <a href=\"{gcal_url}\">В календаре</a>" if gcal_url else ""
            tg.send_message(
                int(notify_to),
                f"📅 <b>Замер назначен</b>\n\n"
                f"Клиент: <b>{row.get('client_name') or '—'}</b>\n"
                f"Дата: {_format_date_human(scheduled_at)}\n"
                f"Замерщик: {user.get('full_name') or tg_id}\n"
                f"Адрес: {row.get('address') or '—'}"
                f"{cal_line}"
            )
        except Exception:
            pass

    sheets.log_event("measurement_scheduled", tg_id, {
        "id": measurement_id, "scheduled_at": scheduled_at, "gcal": bool(gcal_url),
    })
    return {
        "ok": True, "id": measurement_id, "status": "scheduled",
        "scheduled_at": scheduled_at, "gcal_event_url": gcal_url,
    }


def _handle_measurement_logistics(body: dict[str, Any]) -> dict[str, Any]:
    """Замерщик/сборщик/менеджер обновляет логистику замера —
    подъезд, этаж, GPS, парковка, заметки для логистов.
    body: {initData, measurement_id, entrance, floor, gps_lat, gps_lng,
           parking_type, parking_note, delivery_notes}"""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if isinstance(unsafe, dict) and unsafe.get("user", {}).get("id"):
            auth = {"user": unsafe["user"], "_unsafe": True}
        else:
            return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user:
        return {"error": "user_not_found"}

    measurement_id = (body.get("measurement_id") or "").strip()
    if not measurement_id:
        return {"error": "missing_measurement_id"}

    row = sheets.find_row("Measurements", "id", measurement_id)
    if not row:
        return {"error": "measurement_not_found"}

    # Право редактировать — назначенный замерщик, менеджер-заказчик, или админ
    is_assigned_measurer = str(row.get("assigned_to_tg_id", "")) == str(tg_id)
    is_owner_manager = str(row.get("manager_tg_id", "")) == str(tg_id) or \
                       str(row.get("requested_by_tg_id", "")) == str(tg_id)
    is_assembler = sheets.has_role(user, "assembler")
    if not (is_assigned_measurer or is_owner_manager or is_assembler):
        return {"error": "forbidden"}

    # Валидация значений
    parking_type = (body.get("parking_type") or "").strip()
    if parking_type not in ("free", "paid", "street", "none", ""):
        parking_type = ""

    def _num_or_empty(v):
        if v is None or v == "":
            return ""
        try:
            return str(float(v))
        except (TypeError, ValueError):
            return ""

    updates = {
        "entrance":       (body.get("entrance")        or "").strip()[:80],
        "floor":          (body.get("floor")           or "").strip()[:20],
        "gps_lat":        _num_or_empty(body.get("gps_lat")),
        "gps_lng":        _num_or_empty(body.get("gps_lng")),
        "parking_type":   parking_type,
        "parking_note":   (body.get("parking_note")    or "").strip()[:200],
        "delivery_notes": (body.get("delivery_notes")  or "").strip()[:500],
    }
    for col, val in updates.items():
        sheets.update_cell_by_key("Measurements", "id", measurement_id, col, val)

    sheets.log_event("measurement_logistics_updated", tg_id, {"id": measurement_id})
    return {"ok": True, "id": measurement_id, "logistics": updates}


_DESIGN_DATA_URL_RE = re.compile(r"^data:([\w/\-+.]+);base64,(.+)$", re.DOTALL)
_DESIGN_ALLOWED_EXT = {"dwg", "dxf", "pdf", "png", "jpg", "jpeg", "webp"}
_DESIGN_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9_.\-]+")


def _save_design_file(measurement_id: str, data_url: str, raw_filename: str = "") -> str | None:
    """Сохраняет чертёж/документ (DWG, PDF, PNG) в PHOTOS_DIR/<id>/design_<n>.<ext>.
    Возвращает имя файла или None."""
    if not isinstance(data_url, str):
        return None
    m = _DESIGN_DATA_URL_RE.match(data_url.strip())
    if not m:
        return None
    mime = m.group(1).lower()
    try:
        raw = base64.b64decode(m.group(2), validate=False)
    except Exception:
        return None
    if len(raw) > 30 * 1024 * 1024:  # 30 MB cap (DWG могут быть тяжёлыми)
        return None
    if not _SAFE_ID_RE.match(measurement_id):
        return None

    # Расширение из mime, fallback на filename
    ext_map = {
        "application/x-autocad": "dwg",
        "image/vnd.dwg": "dwg",
        "application/acad": "dwg",
        "application/dxf": "dxf",
        "application/pdf": "pdf",
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/webp": "webp",
    }
    ext = ext_map.get(mime, "")
    if not ext and raw_filename:
        rname = raw_filename.lower().rsplit(".", 1)
        if len(rname) == 2 and rname[1] in _DESIGN_ALLOWED_EXT:
            ext = rname[1]
    if not ext or ext not in _DESIGN_ALLOWED_EXT:
        return None

    target_dir = PHOTOS_DIR / measurement_id
    try:
        target_dir.mkdir(parents=True, exist_ok=True)
        # Подбираем уникальное имя design_1.ext, design_2.ext...
        n = 1
        while (target_dir / f"design_{n}.{ext}").exists():
            n += 1
        name = f"design_{n}.{ext}"
        # Если был передан осмысленный filename — используем его (sanitized)
        if raw_filename:
            base = raw_filename.rsplit(".", 1)[0]
            safe = _DESIGN_SAFE_NAME_RE.sub("_", base)[:60].strip("_")
            if safe:
                name = f"design_{safe}.{ext}"
                k = 1
                while (target_dir / name).exists():
                    k += 1
                    name = f"design_{safe}_{k}.{ext}"
        (target_dir / name).write_bytes(raw)
        return name
    except Exception:
        log.warning("Не удалось сохранить design-файл для %s", measurement_id)
        return None


def _handle_measurement_design_upload(body: dict[str, Any]) -> dict[str, Any]:
    """Загрузка чертежа/документа к замеру.
    body: {initData, measurement_id, files: [{name, data_url}, ...]}"""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if isinstance(unsafe, dict) and unsafe.get("user", {}).get("id"):
            auth = {"user": unsafe["user"]}
        else:
            return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user:
        return {"error": "user_not_found"}

    measurement_id = (body.get("measurement_id") or "").strip()
    if not measurement_id:
        return {"error": "missing_measurement_id"}
    row = sheets.find_row("Measurements", "id", measurement_id)
    if not row:
        return {"error": "measurement_not_found"}
    # Право: менеджер-владелец, замерщик, технолог, админ
    is_owner = str(row.get("manager_tg_id")) == str(tg_id) or \
               str(row.get("requested_by_tg_id")) == str(tg_id) or \
               str(row.get("assigned_to_tg_id")) == str(tg_id)
    if not is_owner and not sheets.has_role(user, "manager"):
        return {"error": "forbidden"}

    files = body.get("files") or []
    if not isinstance(files, list) or not files:
        return {"error": "no_files"}

    saved = []
    for f in files[:10]:  # хард-кап 10 файлов за раз
        if not isinstance(f, dict):
            continue
        data_url = f.get("data_url") or ""
        name = f.get("name") or ""
        fn = _save_design_file(measurement_id, data_url, name)
        if fn:
            saved.append(fn)

    if not saved:
        return {"error": "no_valid_files"}

    # Объединяем с уже сохранёнными
    existing = [s for s in (row.get("design_files") or "").split(",") if s]
    combined = existing + saved
    sheets.update_cell_by_key("Measurements", "id", measurement_id, "design_files", ",".join(combined))

    sheets.log_event("design_uploaded", tg_id, {"id": measurement_id, "count": len(saved)})
    return {
        "ok": True,
        "id": measurement_id,
        "saved": saved,
        "total": len(combined),
        "design_files": combined,
    }


def _handle_measurement_decision(body: dict[str, Any]) -> dict[str, Any]:
    """Менеджер фиксирует решение про подбор техники после замера.
    body: {initData, measurement_id, decision: needed|not_needed|later|done, lead_id?}"""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if isinstance(unsafe, dict) and unsafe.get("user", {}).get("id"):
            auth = {"user": unsafe["user"]}
        else:
            return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "manager"):
        return {"error": "only_manager"}

    measurement_id = (body.get("measurement_id") or "").strip()
    decision = (body.get("decision") or "").strip()
    if decision not in ("needed", "not_needed", "later", "done"):
        return {"error": "bad_decision"}
    row = sheets.find_row("Measurements", "id", measurement_id)
    if not row:
        return {"error": "measurement_not_found"}
    if str(row.get("manager_tg_id")) != str(tg_id) and str(row.get("requested_by_tg_id")) != str(tg_id):
        return {"error": "forbidden"}

    sheets.update_cell_by_key("Measurements", "id", measurement_id, "podbor_decision", decision)
    sheets.update_cell_by_key("Measurements", "id", measurement_id, "podbor_decision_at", _now_iso())
    lead_id = (body.get("lead_id") or "").strip()
    if lead_id:
        sheets.update_cell_by_key("Measurements", "id", measurement_id, "podbor_lead_id", lead_id)

    sheets.log_event("podbor_decision", tg_id, {"id": measurement_id, "decision": decision})
    return {"ok": True, "id": measurement_id, "decision": decision}


def _handle_measurement_add_photos(body: dict[str, Any]) -> dict[str, Any]:
    """Дозагрузка фото к существующему замеру.
    body: {initData, measurement_id, photos: [{data_url, label?}, ...]}
    label: before | after | general | extra (необязательно)."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if isinstance(unsafe, dict) and unsafe.get("user", {}).get("id"):
            auth = {"user": unsafe["user"]}
        else:
            return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user:
        return {"error": "user_not_found"}

    measurement_id = (body.get("measurement_id") or "").strip()
    if not measurement_id or not _SAFE_ID_RE.match(measurement_id):
        return {"error": "missing_measurement_id"}

    row = sheets.find_row("Measurements", "id", measurement_id)
    if not row:
        return {"error": "measurement_not_found"}

    is_owner = (str(row.get("manager_tg_id")) == str(tg_id)
                or str(row.get("requested_by_tg_id")) == str(tg_id)
                or str(row.get("assigned_to_tg_id")) == str(tg_id))
    if not is_owner and not sheets.has_role(user, "manager"):
        return {"error": "forbidden"}

    photos_input = body.get("photos") or []
    if not isinstance(photos_input, list) or not photos_input:
        return {"error": "no_photos"}

    existing = [p for p in (row.get("photos") or "").split(",") if p]
    saved: list[str] = []
    for i, p in enumerate(photos_input[:20]):
        if not isinstance(p, dict):
            continue
        data_url = p.get("data_url") or ""
        label = (p.get("label") or "extra").strip()
        if not isinstance(data_url, str) or not data_url.startswith("data:"):
            continue
        fn = _save_measurement_photo(measurement_id, len(existing) + i, data_url, kind=label)
        if fn:
            saved.append(fn)

    if not saved:
        return {"error": "no_photos_saved"}

    all_photos = existing + saved
    sheets.update_cell_by_key("Measurements", "id", measurement_id, "photos", ",".join(all_photos))
    sheets.log_event("measurement_photos_added", tg_id, {"id": measurement_id, "count": len(saved)})
    return {"ok": True, "id": measurement_id, "saved": saved, "total": len(all_photos)}


def _handle_measurement_set_status(body: dict[str, Any]) -> dict[str, Any]:
    """Менеджер меняет статус замера из карточки.
    body: {initData, measurement_id, status}
    Допустимые целевые статусы: cancelled, completed.
    Из draft/completed/cancelled — изменения запрещены."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if isinstance(unsafe, dict) and unsafe.get("user", {}).get("id"):
            auth = {"user": unsafe["user"]}
        else:
            return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "manager"):
        return {"error": "only_manager"}

    measurement_id = (body.get("measurement_id") or "").strip()
    new_status = (body.get("status") or "").strip()

    if not measurement_id:
        return {"error": "missing_measurement_id"}
    if new_status not in ("cancelled", "completed"):
        return {"error": "bad_status", "msg": "Допустимо: cancelled, completed"}

    row = sheets.find_row("Measurements", "id", measurement_id)
    if not row:
        return {"error": "measurement_not_found"}

    # Только владелец-менеджер
    if str(row.get("manager_tg_id", "")) != str(tg_id):
        return {"error": "forbidden"}

    current = (row.get("status") or "").strip()
    if current in ("draft", "completed", "cancelled"):
        return {"error": "cannot_change", "msg": f"Статус «{current}» нельзя изменить"}
    # requested / scheduled → cancelled или completed
    sheets.update_cell_by_key("Measurements", "id", measurement_id, "status", new_status)
    sheets.log_event("measurement_status_changed", tg_id, {
        "id": measurement_id, "from": current, "to": new_status,
    })
    return {"ok": True, "id": measurement_id, "status": new_status, "prev_status": current}


def _handle_manager_pending(body: dict[str, Any]) -> dict[str, Any]:
    """Возвращает actionable карты для менеджера на главной:
    завершённые замеры где ещё не зафиксировано решение про подбор."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if isinstance(unsafe, dict) and unsafe.get("user", {}).get("id"):
            auth = {"user": unsafe["user"]}
        else:
            return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "manager"):
        return {"error": "only_manager"}

    try:
        ws = sheets.sheet("Measurements")
        rows = ws.get_all_values()
    except Exception:
        return {"ok": True, "pending": []}
    if not rows or len(rows) < 2:
        return {"ok": True, "pending": []}

    headers = rows[0]
    out = []
    for r in rows[1:]:
        row = dict(zip(headers, r + [""] * (len(headers) - len(r))))
        if str(row.get("manager_tg_id", "")) != str(tg_id) and \
           str(row.get("requested_by_tg_id", "")) != str(tg_id):
            continue
        if row.get("archived_at"):
            continue
        if row.get("status") != "completed":
            continue
        decision = row.get("podbor_decision") or ""
        # Показываем pending (нет решения) + later (отложено) — для повторного предложения
        if decision in ("needed", "not_needed", "done"):
            continue
        out.append({
            "id": row.get("id", ""),
            "client_name": row.get("client_name", ""),
            "client_phone": row.get("client_phone", ""),
            "address": row.get("address", ""),
            "ts": row.get("ts", ""),
            "decision": decision,  # пусто или "later"
        })
    # Сортируем самые свежие сверху
    out.sort(key=lambda x: x.get("ts", ""), reverse=True)
    return {"ok": True, "count": len(out), "pending": out}


# =================================================================
# Сборки (Phase 4) — workflow от подписанного договора до приёмки
# =================================================================

def _assembly_columns() -> list[str]:
    return [
        "id", "ts",
        # Связи
        "manager_tg_id", "assigned_to_tg_id",
        "client_name", "client_phone", "address",
        "measurement_id", "lead_id", "client_tg_id",
        # Скоуп и расписание
        "scope_of_work",       # текстовое описание
        "scheduled_at",        # ISO
        # Статус: created | scheduled | in_progress | completed | cancelled
        "status",
        "started_at", "completed_at",
        # Фото-отчёт: списки имён файлов через запятую (внутри PHOTOS_DIR/<assembly_id>/)
        "photos_before", "photos_in_progress", "photos_after",
        # Приёмка / подпись (SignRequest)
        "sign_token", "sign_token_expires_at",
        "signed_via",          # canvas | code | proxy | absent
        "signed_by_name", "signed_by_tg_id", "signed_by_phone",
        "signature_file", "signed_at",
        # Google Calendar
        "gcal_event_id", "gcal_event_url",
        # Прочее
        "manager_note",
        "archived_at",
    ]


def _ensure_assemblies_sheet() -> None:
    """Догоняет схему Assemblies (добавляет недостающие колонки)."""
    try:
        ws = sheets.sheet("Assemblies")
        existing = ws.row_values(1)
    except Exception:
        sheets.ensure_sheet("Assemblies", _assembly_columns())
        return
    want = _assembly_columns()
    missing = [c for c in want if c not in existing]
    if missing:
        new_headers = existing + missing
        ws.update("A1", [new_headers])
        log.info("Assemblies: дополнили колонки: %s", missing)


def _row_for_assembly(assembly_id: str, ts: str, **fields) -> list[str]:
    cols = _assembly_columns()
    base = {c: "" for c in cols}
    base["id"] = assembly_id
    base["ts"] = ts
    base["status"] = "created"
    base.update(fields)
    return [str(base.get(c, "")) for c in cols]


def _handle_assembly_create(body: dict[str, Any]) -> dict[str, Any]:
    """Менеджер заводит сборку.
    body: {initData, client_name, client_phone?, address, scope_of_work,
           measurement_id?, lead_id?, scheduled_at?, manager_note?}"""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if isinstance(unsafe, dict) and unsafe.get("user", {}).get("id"):
            auth = {"user": unsafe["user"]}
        else:
            return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "manager"):
        return {"error": "only_manager"}

    _ensure_assemblies_sheet()

    client_name = (body.get("client_name") or "").strip()
    address = (body.get("address") or "").strip()
    scope = (body.get("scope_of_work") or "").strip()
    if not client_name:
        return {"error": "missing_client_name"}
    if not address:
        return {"error": "missing_address"}
    if not scope:
        return {"error": "missing_scope"}

    phone_raw = (body.get("client_phone") or "").strip()
    phone_norm, _ = _normalize_phone(phone_raw) if phone_raw else ("", False)

    assembly_id = _short_id()
    ts = _now_iso()
    scheduled_at = (body.get("scheduled_at") or "").strip()
    status = "scheduled" if scheduled_at else "created"

    fields = {
        "manager_tg_id": tg_id,
        "client_name": client_name,
        "client_phone": phone_norm or phone_raw,
        "address": address,
        "scope_of_work": scope,
        "measurement_id": (body.get("measurement_id") or "").strip(),
        "lead_id": (body.get("lead_id") or "").strip(),
        "client_tg_id": (body.get("client_tg_id") or "").strip(),
        "scheduled_at": scheduled_at,
        "status": status,
        "manager_note": (body.get("manager_note") or "").strip(),
    }

    # Google Calendar — если дата назначена
    if scheduled_at:
        try:
            from . import gcalendar
            ev = gcalendar.create_event(
                summary=f"🔨 Сборка: {client_name}",
                description=f"{scope}\n\nКлиент: {client_name}\nТел: {phone_norm or phone_raw}\nАдрес: {address}",
                start_iso=scheduled_at,
                duration_min=240,  # 4 часа на сборку
                location=address,
            )
            if ev:
                fields["gcal_event_id"] = ev.get("id", "")
                fields["gcal_event_url"] = ev.get("html_link", "")
        except Exception as e:
            log.warning("Не удалось создать событие Calendar для сборки: %s", e)

    sheets.append_row("Assemblies", _row_for_assembly(assembly_id, ts, **fields))
    sheets.log_event("assembly_created", tg_id, {"id": assembly_id, "client": client_name})

    return {"ok": True, "id": assembly_id, "status": status}


def _handle_assembly_list(body: dict[str, Any]) -> dict[str, Any]:
    """Список сборок.
    Менеджер: видит свои (manager_tg_id == self).
    Мастер: видит назначенные ему (assigned_to_tg_id == self) + неназначенные status='created'."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if isinstance(unsafe, dict) and unsafe.get("user", {}).get("id"):
            auth = {"user": unsafe["user"]}
        else:
            return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user:
        return {"error": "user_not_found"}

    is_manager = sheets.has_role(user, "manager")
    is_master = sheets.is_master(user)
    is_client = sheets.has_role(user, "client")
    if not is_manager and not is_master and not is_client:
        return {"error": "forbidden"}

    _ensure_assemblies_sheet()
    try:
        ws = sheets.sheet("Assemblies")
        rows = ws.get_all_values()
    except Exception:
        return {"ok": True, "assemblies": []}
    if not rows or len(rows) < 2:
        return {"ok": True, "assemblies": []}

    headers = rows[0]
    out = []
    for r in rows[1:]:
        row = dict(zip(headers, r + [""] * (len(headers) - len(r))))
        if row.get("archived_at"):
            continue
        # Фильтр по роли
        visible = False
        if is_manager and str(row.get("manager_tg_id")) == str(tg_id):
            visible = True
        if is_master:
            if str(row.get("assigned_to_tg_id")) == str(tg_id):
                visible = True
            elif not row.get("assigned_to_tg_id") and row.get("status") in ("created", "scheduled"):
                visible = True
        if is_client and str(row.get("client_tg_id")) == str(tg_id):
            visible = True
        if not visible:
            continue
        out.append({
            "id": row.get("id", ""),
            "ts": row.get("ts", ""),
            "client_name": row.get("client_name", ""),
            "client_phone": row.get("client_phone", ""),
            "address": row.get("address", ""),
            "scope_of_work": row.get("scope_of_work", ""),
            "scheduled_at": row.get("scheduled_at", ""),
            "status": row.get("status", ""),
            "assigned_to_tg_id": row.get("assigned_to_tg_id", ""),
            "manager_tg_id": row.get("manager_tg_id", ""),
            "gcal_event_url": row.get("gcal_event_url", ""),
            "measurement_id": row.get("measurement_id", ""),
            "lead_id": row.get("lead_id", ""),
            "kitchen_price": row.get("kitchen_price", ""),
        })
    out.sort(key=lambda x: x.get("scheduled_at") or x.get("ts", ""), reverse=True)
    return {"ok": True, "count": len(out), "assemblies": out}


def _handle_assembly_detail(body: dict[str, Any]) -> dict[str, Any]:
    """Детальная карточка сборки."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if isinstance(unsafe, dict) and unsafe.get("user", {}).get("id"):
            auth = {"user": unsafe["user"]}
        else:
            return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user:
        return {"error": "user_not_found"}

    assembly_id = (body.get("assembly_id") or "").strip()
    if not assembly_id:
        return {"error": "missing_assembly_id"}
    _ensure_assemblies_sheet()
    row = sheets.find_row("Assemblies", "id", assembly_id)
    if not row:
        return {"error": "assembly_not_found"}

    # Право: менеджер-владелец, назначенный мастер, клиент-владелец, неназначенная сборка
    is_owner = str(row.get("manager_tg_id")) == str(tg_id) or \
               str(row.get("assigned_to_tg_id")) == str(tg_id) or \
               str(row.get("client_tg_id")) == str(tg_id)
    is_open_slot = (not row.get("assigned_to_tg_id")) and row.get("status") in ("created", "scheduled")
    if not is_owner and not is_open_slot:
        return {"error": "forbidden"}

    def _list(s: str) -> list[str]:
        return [x for x in (s or "").split(",") if x]

    return {
        "ok": True,
        "id": row.get("id", ""),
        "ts": row.get("ts", ""),
        "manager_tg_id": row.get("manager_tg_id", ""),
        "assigned_to_tg_id": row.get("assigned_to_tg_id", ""),
        "client_name": row.get("client_name", ""),
        "client_phone": row.get("client_phone", ""),
        "address": row.get("address", ""),
        "measurement_id": row.get("measurement_id", ""),
        "lead_id": row.get("lead_id", ""),
        "scope_of_work": row.get("scope_of_work", ""),
        "scheduled_at": row.get("scheduled_at", ""),
        "status": row.get("status", ""),
        "started_at": row.get("started_at", ""),
        "completed_at": row.get("completed_at", ""),
        "photos_before": _list(row.get("photos_before", "")),
        "photos_in_progress": _list(row.get("photos_in_progress", "")),
        "photos_after": _list(row.get("photos_after", "")),
        "signature_file": row.get("signature_file", ""),
        "signed_via": row.get("signed_via", ""),
        "signed_by_name": row.get("signed_by_name", ""),
        "signed_by_tg_id": row.get("signed_by_tg_id", ""),
        "signed_by_phone": row.get("signed_by_phone", ""),
        "signed_at": row.get("signed_at", ""),
        "sign_token_expires_at": row.get("sign_token_expires_at", ""),
        "gcal_event_id": row.get("gcal_event_id", ""),
        "gcal_event_url": row.get("gcal_event_url", ""),
        "manager_note": row.get("manager_note", ""),
        "kitchen_price": row.get("kitchen_price", ""),
        "client_tg_id": row.get("client_tg_id", ""),
    }


def _handle_assembly_set_kitchen_price(body: dict[str, Any]) -> dict[str, Any]:
    """Менеджер устанавливает стоимость кухни для сборки.
    body: {initData, assembly_id, kitchen_price}"""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if isinstance(unsafe, dict) and unsafe.get("user", {}).get("id"):
            auth = {"user": unsafe["user"]}
        else:
            return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "manager"):
        return {"error": "only_manager"}

    assembly_id = (body.get("assembly_id") or "").strip()
    if not assembly_id:
        return {"error": "missing_assembly_id"}

    try:
        kitchen_price = float(body.get("kitchen_price") or 0)
    except (TypeError, ValueError):
        return {"error": "bad_kitchen_price", "msg": "kitchen_price должен быть числом"}
    if kitchen_price < 0:
        return {"error": "bad_kitchen_price", "msg": "kitchen_price не может быть отрицательным"}

    _ensure_assemblies_sheet()
    row = sheets.find_row("Assemblies", "id", assembly_id)
    if not row:
        return {"error": "assembly_not_found"}

    if str(row.get("manager_tg_id")) != str(tg_id):
        return {"error": "forbidden"}

    sheets.update_cell_by_key("Assemblies", "id", assembly_id, "kitchen_price", str(kitchen_price))
    sheets.log_event("assembly_kitchen_price_set", tg_id, {
        "id": assembly_id, "kitchen_price": kitchen_price,
    })

    assembly_price = round(kitchen_price * 0.09, 2)
    return {"ok": True, "kitchen_price": kitchen_price, "assembly_price": assembly_price}


# =================================================================
# SignRequest — цифровая подпись акта сборки (ФЗ-63 ПЭП)
# =================================================================

def _handle_sign_request_create(body: dict[str, Any]) -> dict[str, Any]:
    """Менеджер/сборщик инициирует подпись акта.
    body: {initData, initDataUnsafe, assembly_id, mode: canvas|code|proxy|absent}
    Для code-режима: генерирует OTP и отправляет клиенту через бот."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if isinstance(unsafe, dict) and unsafe.get("user", {}).get("id"):
            auth = {"user": unsafe["user"]}
        else:
            return {"error": "invalid_init_data"}
    tg_id = str(auth["user"]["id"])
    user = sheets.find_user(tg_id)
    if not user:
        return {"error": "user_not_found"}
    if not (sheets.has_role(user, "manager") or sheets.has_role(user, "admin")
            or sheets.has_role(user, "assembler") or sheets.has_role(user, "measurer")):
        return {"error": "forbidden"}

    assembly_id = (body.get("assembly_id") or "").strip()
    if not assembly_id:
        return {"error": "missing_assembly_id"}
    mode = (body.get("mode") or "canvas").strip()
    if mode not in ("canvas", "code", "proxy", "absent"):
        return {"error": "invalid_mode"}

    _ensure_assemblies_sheet()
    row = sheets.find_row("Assemblies", "id", assembly_id)
    if not row:
        return {"error": "assembly_not_found"}

    is_owner = (str(row.get("manager_tg_id")) == tg_id
                or str(row.get("assigned_to_tg_id")) == tg_id)
    if not is_owner:
        return {"error": "forbidden"}

    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(hours=72)).isoformat()
    # 6-значный OTP (надёжнее строковым генератором)
    otp = str(secrets.randbelow(900000) + 100000)

    sheets.update_cell_by_key("Assemblies", "id", assembly_id, "sign_token", otp)
    sheets.update_cell_by_key("Assemblies", "id", assembly_id, "sign_token_expires_at", expires_at)

    client_tg_id = row.get("client_tg_id", "")
    client_sent = False
    if mode == "code" and client_tg_id:
        msg = (
            "🔐 <b>Код подтверждения акта сборки</b>\n\n"
            f"Адрес: {row.get('address', '—')}\n\n"
            f"Ваш код: <code>{otp}</code>\n\n"
            "Сообщите код мастеру или введите в приложении. "
            "Код действителен 72 часа."
        )
        client_sent = tg.send_message(int(client_tg_id), msg)

    sheets.log_event("sign_request_created", tg_id,
                     {"assembly_id": assembly_id, "mode": mode})
    return {
        "ok": True,
        "sign_token": otp,
        "expires_at": expires_at,
        "mode": mode,
        "client_tg_id": client_tg_id,
        "client_name": row.get("client_name", ""),
        "client_sent": client_sent,
    }


def _handle_sign_request_submit(body: dict[str, Any]) -> dict[str, Any]:
    """Фиксирует подпись. Режимы:
    canvas  — {initData, assembly_id, mode, signature_data(base64 PNG), signed_by_name, signed_by_phone?}
    code    — {assembly_id, mode, code, signed_by_name, signed_by_phone?, initData?}
    proxy   — {initData, assembly_id, mode, signed_by_name, signed_by_phone?}
    absent  — {initData, assembly_id, mode, absent_reason?}
    """
    cfg = get_config()
    mode = (body.get("mode") or "canvas").strip()
    if mode not in ("canvas", "code", "proxy", "absent"):
        return {"error": "invalid_mode"}
    assembly_id = (body.get("assembly_id") or "").strip()
    if not assembly_id:
        return {"error": "missing_assembly_id"}

    _ensure_assemblies_sheet()
    row = sheets.find_row("Assemblies", "id", assembly_id)
    if not row:
        return {"error": "assembly_not_found"}

    now_iso = _now_iso()
    signed_by_name = (body.get("signed_by_name") or "").strip()
    signed_by_phone = (body.get("signed_by_phone") or "").strip()
    signed_by_tg_id = ""
    signature_file = ""

    if mode == "code":
        code = (body.get("code") or "").strip()
        stored = (row.get("sign_token") or "").strip()
        expires_str = (row.get("sign_token_expires_at") or "").strip()
        if not stored:
            return {"error": "no_sign_token"}
        if not code:
            return {"error": "missing_code"}
        if code != stored:
            return {"error": "invalid_code"}
        if expires_str:
            try:
                # Парсим ISO без dateutil
                exp = datetime.fromisoformat(expires_str.replace("Z", "+00:00"))
                if datetime.now(timezone.utc) > exp:
                    return {"error": "code_expired"}
            except Exception:
                pass  # не блокируем если парсинг упал
        # Берём tg_id из initData если есть (клиент авторизован в боте)
        auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
        if auth and auth.get("user"):
            signed_by_tg_id = str(auth["user"]["id"])

    elif mode in ("canvas", "proxy", "absent"):
        auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
        if not auth or not auth.get("user"):
            unsafe = body.get("initDataUnsafe") or {}
            if isinstance(unsafe, dict) and unsafe.get("user", {}).get("id"):
                auth = {"user": unsafe["user"]}
            else:
                return {"error": "invalid_init_data"}
        tg_id = str(auth["user"]["id"])
        is_owner = (str(row.get("manager_tg_id")) == tg_id
                    or str(row.get("assigned_to_tg_id")) == tg_id)
        if not is_owner:
            return {"error": "forbidden"}
        signed_by_tg_id = tg_id

        if mode == "canvas":
            sig_data = (body.get("signature_data") or "").strip()
            if not sig_data:
                return {"error": "missing_signature_data"}
            # data:image/png;base64,<data> → bytes
            raw = sig_data.split(",", 1)[-1]
            try:
                sig_bytes = base64.b64decode(raw)
            except Exception:
                return {"error": "invalid_signature_data"}
            sig_dir = PHOTOS_DIR / assembly_id
            sig_dir.mkdir(parents=True, exist_ok=True)
            sig_filename = f"sign_{int(time.time())}.png"
            (sig_dir / sig_filename).write_bytes(sig_bytes)
            signature_file = sig_filename

        elif mode == "absent":
            reason = (body.get("absent_reason") or "Клиент отсутствовал").strip()
            signed_by_name = reason

    # Пишем все поля за один проход (каждый update_cell — отдельный запрос к Sheets)
    updates = {
        "signed_via": mode,
        "signed_by_name": signed_by_name,
        "signed_by_phone": signed_by_phone,
        "signed_by_tg_id": signed_by_tg_id,
        "signed_at": now_iso,
        "signature_file": signature_file,
    }
    for col, val in updates.items():
        sheets.update_cell_by_key("Assemblies", "id", assembly_id, col, val)

    sheets.log_event("assembly_signed", signed_by_tg_id or "anon",
                     {"assembly_id": assembly_id, "mode": mode, "by": signed_by_name})
    return {"ok": True, "signed_at": now_iso, "mode": mode, "signed_by_name": signed_by_name}


@app.post("/api/sign_request_create")
async def api_sign_request_create(request: Request):
    body = await _safe_json(request)
    return JSONResponse(_handle_sign_request_create(body))


@app.post("/api/sign_request_submit")
async def api_sign_request_submit(request: Request):
    body = await _safe_json(request)
    return JSONResponse(_handle_sign_request_submit(body))


def _normalize_phone(raw: str) -> tuple[str, bool]:
    """Нормализует RU-телефон в формат +7XXXXXXXXXX.
    Возвращает (нормализованный, валиден ли)."""
    if not raw:
        return "", False
    digits = "".join(c for c in raw if c.isdigit())
    # Если начинается с 8 — заменяем на 7
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    # Если 10 цифр — добавляем 7 в начало
    if len(digits) == 10:
        digits = "7" + digits
    if len(digits) != 11 or not digits.startswith("7"):
        return raw, False
    return "+" + digits, True


def _next_client_no(manager_tg_id: str) -> int:
    """Следующий порядковый номер клиента для менеджера (1, 2, 3, ...)."""
    try:
        ws = sheets.sheet("Measurements")
        rows = ws.get_all_values()
    except Exception:
        return 1
    if not rows or len(rows) < 2:
        return 1
    headers = rows[0]
    if "client_no" not in headers or "manager_tg_id" not in headers:
        return 1
    no_idx = headers.index("client_no")
    mgr_idx = headers.index("manager_tg_id")
    max_n = 0
    for r in rows[1:]:
        if mgr_idx < len(r) and str(r[mgr_idx]).strip() == str(manager_tg_id):
            try:
                n = int(str(r[no_idx]).strip()) if no_idx < len(r) and r[no_idx] else 0
                if n > max_n:
                    max_n = n
            except (ValueError, TypeError):
                pass
    return max_n + 1


def _handle_client_create(body: dict[str, Any]) -> dict[str, Any]:
    """Менеджер заводит клиента без замера/подбора.
    body: {initData, full_name, phone, address?, note?, contract_no?, contract_date?}
    Создаёт пустую заявку-карточку (status='draft') чтобы клиент появился
    в списке клиентов менеджера и был доступен в карточке."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if isinstance(unsafe, dict) and unsafe.get("user", {}).get("id"):
            auth = {"user": unsafe["user"]}
        else:
            return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "manager"):
        return {"error": "only_manager"}

    full_name = (body.get("full_name") or "").strip()
    phone_raw = (body.get("phone") or "").strip()
    address = (body.get("address") or "").strip()
    note = (body.get("note") or "").strip()
    contract_no = (body.get("contract_no") or "").strip()
    contract_date = (body.get("contract_date") or "").strip()
    gps_lat = body.get("gps_lat") or ""
    gps_lng = body.get("gps_lng") or ""

    # Валидация
    if not full_name:
        return {"error": "missing_name", "field": "full_name", "msg": "Укажите ФИО клиента"}
    if len(full_name) < 2:
        return {"error": "bad_name", "field": "full_name", "msg": "Имя слишком короткое"}

    phone, phone_ok = _normalize_phone(phone_raw)
    if not phone_ok:
        return {"error": "bad_phone", "field": "phone", "msg": "Телефон в формате +7XXXXXXXXXX (10 цифр после +7)"}

    if address and len(address) < 5:
        return {"error": "bad_address", "field": "address", "msg": "Адрес слишком короткий"}

    _ensure_measurements_sheet()
    measurement_id = _short_id()
    client_no = _next_client_no(str(tg_id))

    # Создаём «карточку клиента» как заявку со статусом draft
    sheets.append_named_row("Measurements", _row_for_measurement(
        measurement_id, _now_iso(),
        manager_tg_id=str(tg_id),
        requested_by_tg_id=str(tg_id),
        filled_by="client_card",
        status="draft",  # карточка клиента, без активного замера
        address=address,
        client_name=full_name,
        client_phone=phone,
        notes=note,
        preferred_note=note,
        client_no=str(client_no),
        contract_no=contract_no,
        contract_date=contract_date,
        gps_lat=gps_lat,
        gps_lng=gps_lng,
    ))

    # Сохраняем заметку в ClientNotes если она передана
    if note:
        try:
            _ensure_client_notes_sheet()
            key = _normalize_client_key(full_name, phone)
            sheets.append_row("ClientNotes", [str(tg_id), key, note, _now_iso()])
        except Exception:
            pass

    sheets.log_event("client_created", tg_id, {
        "id": measurement_id, "client": full_name, "phone": phone, "client_no": client_no,
    })
    # client_key — формат совместимый с _handle_clients (которое использует name.lower())
    return {
        "ok": True,
        "id": measurement_id,
        "client_name": full_name,
        "client_phone": phone,
        "client_no": client_no,
        "contract_no": contract_no,
        "client_key": full_name.lower(),
    }


def _handle_client_delete(body: dict[str, Any]) -> dict[str, Any]:
    """Soft-delete всех записей Measurements по клиенту (для текущего менеджера).
    Удаление разрешено ТОЛЬКО если у клиента нет реальной работы:
    нет лидов и все его замеры в статусе 'draft' (карточка не использована).
    body: {initData, client_key} — client_key это name.lower() как в _handle_clients."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if isinstance(unsafe, dict) and unsafe.get("user", {}).get("id"):
            auth = {"user": unsafe["user"]}
        else:
            return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "manager"):
        return {"error": "only_manager"}

    client_key = (body.get("client_key") or "").strip().lower()
    if not client_key:
        return {"error": "missing_client_key"}

    # Проверка: есть ли у клиента работа в Leads
    try:
        ws_l = sheets.sheet("Leads")
        rows_l = ws_l.get_all_values()
        if rows_l and len(rows_l) >= 2:
            headers_l = rows_l[0]
            for r in rows_l[1:]:
                row = dict(zip(headers_l, r + [""] * (len(headers_l) - len(r))))
                if str(row.get("manager_tg_id", "")) != str(tg_id):
                    continue
                if (row.get("client_name") or "").strip().lower() != client_key:
                    continue
                return {"error": "in_work", "msg": "У клиента есть подбор — удаление запрещено. Используйте редактирование."}
    except Exception:
        pass

    # Проверка: есть ли у клиента сборки
    try:
        ws_a = sheets.sheet("Assemblies")
        rows_a = ws_a.get_all_values()
        if rows_a and len(rows_a) >= 2:
            headers_a = rows_a[0]
            for r in rows_a[1:]:
                row = dict(zip(headers_a, r + [""] * (len(headers_a) - len(r))))
                if str(row.get("manager_tg_id", "")) != str(tg_id):
                    continue
                if row.get("archived_at"):
                    continue
                if (row.get("client_name") or "").strip().lower() != client_key:
                    continue
                return {"error": "in_work", "msg": "У клиента есть сборка — удаление запрещено. Используйте редактирование."}
    except Exception:
        pass

    try:
        ws = sheets.sheet("Measurements")
        rows = ws.get_all_values()
    except Exception as e:
        return {"error": f"sheets: {e}"}
    if not rows or len(rows) < 2:
        return {"ok": True, "archived": 0}

    headers = rows[0]
    if "archived_at" not in headers or "client_name" not in headers or "manager_tg_id" not in headers:
        return {"error": "schema_missing"}

    # Проверка: есть ли не-draft замеры?
    for r in rows[1:]:
        row = dict(zip(headers, r + [""] * (len(headers) - len(r))))
        if str(row.get("manager_tg_id", "")) != str(tg_id):
            continue
        if (row.get("client_name") or "").strip().lower() != client_key:
            continue
        if row.get("archived_at"):
            continue
        status = (row.get("status") or "").strip()
        if status and status != "draft":
            return {"error": "in_work", "msg": "У клиента есть замер в работе — удаление запрещено. Используйте редактирование."}

    archived_idx = headers.index("archived_at") + 1
    now = _now_iso()
    count = 0
    for i, r in enumerate(rows[1:], start=2):
        row = dict(zip(headers, r + [""] * (len(headers) - len(r))))
        if str(row.get("manager_tg_id", "")) != str(tg_id):
            continue
        if (row.get("client_name") or "").strip().lower() != client_key:
            continue
        if row.get("archived_at"):
            continue
        ws.update_cell(i, archived_idx, now)
        count += 1

    sheets.log_event("client_deleted", tg_id, {"client_key": client_key, "count": count})
    return {"ok": True, "archived": count}


def _handle_client_update(body: dict[str, Any]) -> dict[str, Any]:
    """Менеджер обновляет данные клиента (имя, телефон, адрес, договор).
    Обновляет ВСЕ строки Measurements этого менеджера для этого клиента.
    body: {initData, client_key, full_name?, phone?, address?, contract_no?, contract_date?}"""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if isinstance(unsafe, dict) and unsafe.get("user", {}).get("id"):
            auth = {"user": unsafe["user"]}
        else:
            return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "manager"):
        return {"error": "only_manager"}

    client_key = (body.get("client_key") or "").strip().lower()
    if not client_key:
        return {"error": "missing_client_key"}

    new_name = (body.get("full_name") or "").strip()
    new_phone_raw = (body.get("phone") or "").strip()
    new_address = body.get("address")
    new_contract_no = body.get("contract_no")
    new_contract_date = body.get("contract_date")
    new_gps_lat = body.get("gps_lat")
    new_gps_lng = body.get("gps_lng")

    if new_name and len(new_name) < 2:
        return {"error": "bad_name", "msg": "Имя слишком короткое"}

    new_phone = ""
    if new_phone_raw:
        norm, ok = _normalize_phone(new_phone_raw)
        if not ok:
            return {"error": "bad_phone", "msg": "Телефон в формате +7XXXXXXXXXX"}
        new_phone = norm

    if isinstance(new_address, str) and new_address.strip() and len(new_address.strip()) < 5:
        return {"error": "bad_address", "msg": "Адрес слишком короткий"}

    try:
        ws = sheets.sheet("Measurements")
        rows = ws.get_all_values()
    except Exception as e:
        return {"error": f"sheets: {e}"}
    if not rows or len(rows) < 2:
        return {"ok": True, "updated": 0}

    headers = rows[0]
    if "client_name" not in headers or "manager_tg_id" not in headers:
        return {"error": "schema_missing"}

    def col_idx(name: str) -> int | None:
        return headers.index(name) + 1 if name in headers else None

    name_col = col_idx("client_name")
    phone_col = col_idx("client_phone")
    address_col = col_idx("address")
    contract_no_col = col_idx("contract_no")
    contract_date_col = col_idx("contract_date")
    gps_lat_col = col_idx("gps_lat")
    gps_lng_col = col_idx("gps_lng")

    updated = 0
    for i, r in enumerate(rows[1:], start=2):
        row = dict(zip(headers, r + [""] * (len(headers) - len(r))))
        if str(row.get("manager_tg_id", "")) != str(tg_id):
            continue
        if (row.get("client_name") or "").strip().lower() != client_key:
            continue
        if row.get("archived_at"):
            continue
        if new_name and name_col:
            ws.update_cell(i, name_col, new_name)
        if new_phone and phone_col:
            ws.update_cell(i, phone_col, new_phone)
        if isinstance(new_address, str) and address_col:
            ws.update_cell(i, address_col, new_address.strip())
        if isinstance(new_contract_no, str) and contract_no_col:
            ws.update_cell(i, contract_no_col, new_contract_no.strip())
        if isinstance(new_contract_date, str) and contract_date_col:
            ws.update_cell(i, contract_date_col, new_contract_date.strip())
        if new_gps_lat is not None and gps_lat_col:
            ws.update_cell(i, gps_lat_col, new_gps_lat)
        if new_gps_lng is not None and gps_lng_col:
            ws.update_cell(i, gps_lng_col, new_gps_lng)
        updated += 1

    sheets.log_event("client_updated", tg_id, {"client_key": client_key, "updated": updated})
    new_key = new_name.lower() if new_name else client_key
    return {"ok": True, "updated": updated, "client_key": new_key}


def _normalize_client_key(name: str, phone: str) -> str:
    """Стабильный ключ клиента: телефон в цифрах либо имя в lower."""
    digits = "".join(c for c in (phone or "") if c.isdigit())
    if len(digits) >= 10:
        # Нормализуем +7/8 → 7XXXXXXXXXX (последние 10 цифр)
        return "p:" + digits[-10:]
    return "n:" + (name or "").strip().lower()


_CLIENT_NOTES_HEADERS = ["manager_tg_id", "client_key", "note", "updated_at"]


def _ensure_client_notes_sheet():
    try:
        sheets.ensure_sheet("ClientNotes", _CLIENT_NOTES_HEADERS)
    except Exception as e:
        log.warning("Не удалось убедиться что ClientNotes есть: %s", e)


def _handle_client_note(body: dict[str, Any]) -> dict[str, Any]:
    """Чтение/запись примечаний менеджера по клиенту (append-only история).
    body: {initData, client_name, client_phone, note?}

    Если note передано — добавляем новую запись (append).
    Возвращает {ok, notes: [{note, updated_at}, ...], note, updated_at} (notes = все записи, новые сверху)."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if not (isinstance(unsafe, dict) and unsafe.get("user", {}).get("id")):
            return {"error": "invalid_init_data"}
        auth = {"user": unsafe["user"]}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "manager"):
        return {"error": "only_manager"}

    client_name = (body.get("client_name") or "").strip()
    client_phone = (body.get("client_phone") or "").strip()
    if not client_name and not client_phone:
        return {"error": "missing_client_id"}
    key = _normalize_client_key(client_name, client_phone)

    _ensure_client_notes_sheet()

    # Если note передано — пишем новую запись (append-only, история не перезаписывается)
    if "note" in body and body.get("note") is not None:
        new_note = str(body.get("note") or "").strip()[:4000]
        if not new_note:
            return {"error": "empty_note"}
        now_iso = _now_iso()
        sheets.append_row("ClientNotes", [str(tg_id), key, new_note, now_iso])
        sheets.log_event("client_note_added", tg_id, {"key": key, "len": len(new_note)})

    # Читаем все заметки этого менеджера по этому клиенту
    try:
        ws = sheets.sheet("ClientNotes")
        rows = ws.get_all_values()
    except Exception as e:
        log.warning("ClientNotes read failed: %s", e)
        rows = []

    notes: list[dict[str, str]] = []
    if rows and len(rows) >= 2:
        headers = rows[0]
        try:
            idx_mgr  = headers.index("manager_tg_id")
            idx_key  = headers.index("client_key")
            idx_note = headers.index("note")
            idx_upd  = headers.index("updated_at")
        except ValueError:
            idx_mgr = idx_key = idx_note = idx_upd = -1
        if idx_mgr >= 0 and idx_key >= 0:
            for r in rows[1:]:
                if (r[idx_mgr] if idx_mgr < len(r) else "") == str(tg_id) \
                        and (r[idx_key] if idx_key < len(r) else "") == key:
                    note_text = r[idx_note] if idx_note < len(r) else ""
                    upd = r[idx_upd] if idx_upd < len(r) else ""
                    if note_text:
                        notes.append({"note": note_text, "updated_at": upd})

    # Новые сверху
    notes.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
    latest = notes[0] if notes else {}
    return {
        "ok": True,
        "notes": notes,
        "note": latest.get("note", ""),
        "updated_at": latest.get("updated_at", ""),
        "client_key": key,
    }


def _handle_geocode(body: dict[str, Any]) -> dict[str, Any]:
    """Прямое геокодирование: текст адреса → lat/lon.
    Использует Yandex (если есть YANDEX_GEOCODER_API_KEY в env) с fallback на OSM.
    body: {initData, address, city?}"""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if not (isinstance(unsafe, dict) and unsafe.get("user", {}).get("id")):
            return {"error": "invalid_init_data"}

    address = (body.get("address") or "").strip()
    if not address:
        return {"error": "missing_address"}
    city = (body.get("city") or "Санкт-Петербург").strip()
    result = geocoder.geocode(address, city=city)
    if not result:
        return {"ok": False, "error": "not_found", "address": address}
    return {
        "ok": True,
        "address": address,
        "result": {
            "lat": result.get("lat"),
            "lng": result.get("lon"),  # фронт использует lng
            "formatted": result.get("formatted"),
            "precision": result.get("precision"),
            "kind": result.get("kind"),
            "source": result.get("source"),
        },
        "yandex_maps_url": geocoder.build_yandex_maps_url(
            result["lat"], result["lon"], text=result.get("formatted") or address,
        ),
    }


def _handle_measurement_next_no(body: dict[str, Any]) -> dict[str, Any]:
    """Возвращает следующий свободный номер замера (max существующих + 1).
    Если в Sheets ничего нет — стартуем с 1. Менеджер может скорректировать вручную
    (например первый раз поставить 158, если до этого замеры были вне системы)."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if not (isinstance(unsafe, dict) and unsafe.get("user", {}).get("id")):
            return {"error": "invalid_init_data"}

    _ensure_measurements_sheet()
    try:
        ws = sheets.sheet("Measurements")
        rows = ws.get_all_values()
    except Exception:
        return {"ok": True, "next_no": 1}
    if not rows or len(rows) < 2:
        return {"ok": True, "next_no": 1}
    headers = rows[0]
    if "zamer_no" not in headers:
        return {"ok": True, "next_no": 1}
    idx = headers.index("zamer_no")
    max_n = 0
    for r in rows[1:]:
        if idx >= len(r):
            continue
        try:
            n = int(str(r[idx]).strip())
            if n > max_n:
                max_n = n
        except (ValueError, TypeError):
            pass
    return {"ok": True, "next_no": max_n + 1}


def _format_date_human(iso: str) -> str:
    """ISO datetime → '15.05.2026 14:00' для уведомлений."""
    if not iso:
        return "—"
    try:
        d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return d.strftime("%d.%m.%Y %H:%M")
    except Exception:
        return iso


def _format_preferred_human(p_type: str, p_date: str, p_tod: str, p_note: str) -> str:
    """Приблизительная дата от менеджера в человекочитаемом виде."""
    tod_map = {"morning": "утром", "day": "днём", "evening": "вечером"}
    if p_type == "specific":
        date_part = p_date
        if p_date:
            try:
                from datetime import datetime as _dt
                date_part = _dt.strptime(p_date, "%Y-%m-%d").strftime("%d.%m.%Y")
            except Exception:
                pass
        parts = []
        if date_part:
            parts.append(date_part)
        if p_tod in tod_map:
            parts.append(tod_map[p_tod])
        s = " ".join(parts) if parts else "конкретная дата"
    elif p_type == "this_week":
        s = "эта неделя"
    elif p_type == "next_week":
        s = "следующая неделя"
    else:
        s = "согласовать с клиентом"
    if p_note:
        s += f" · {p_note}"
    return s


def _handle_measurement_detail(body: dict[str, Any]) -> dict[str, Any]:
    """Возвращает один замер целиком — для детальной страницы и печати."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user:
        return {"error": "user_not_found"}

    measurement_id = body.get("measurement_id") or body.get("id")
    if not measurement_id:
        return {"error": "missing_measurement_id"}

    row = sheets.find_row("Measurements", "id", measurement_id)
    if not row:
        return {"error": "measurement_not_found"}

    # Доступ: владелец-менеджер, любой мастер (замерщик или сборщик), клиент-владелец
    is_owner_manager = sheets.has_role(user, "manager") and str(row.get("manager_tg_id", "")) == str(tg_id)
    is_master = sheets.is_master(user)  # measurer или assembler — оба видят фото замера
    is_client = str(row.get("client_tg_id", "")) == str(tg_id)
    if not (is_owner_manager or is_master or is_client):
        return {"error": "forbidden"}

    def _safe_json(s: str) -> Any:
        try:
            return json.loads(s) if s else {}
        except (ValueError, TypeError):
            return {}

    photo_files = [p for p in (row.get("photos") or "").split(",") if p]

    return {
        "ok": True,
        "id": row.get("id"),
        "created_at": row.get("ts") or row.get("created_at"),
        "client_tg_id": row.get("client_tg_id", ""),
        "manager_tg_id": row.get("manager_tg_id", ""),
        "filled_by": row.get("filled_by", ""),
        "layout": row.get("layout", ""),
        "area_m2": row.get("area_m2", ""),
        "ceiling_mm": row.get("ceiling_mm", ""),
        "walls": _safe_json(row.get("walls", "")),
        "openings": _safe_json(row.get("openings", "")),
        "infra": _safe_json(row.get("infra", "")),
        "niches": _safe_json(row.get("niches", "")),
        "photos": photo_files,
        "notes": row.get("notes", ""),
        "status": row.get("status", ""),
        # Поля Commit B (workflow)
        "assigned_to_tg_id": row.get("assigned_to_tg_id", ""),
        "requested_by_tg_id": row.get("requested_by_tg_id", ""),
        "scheduled_at": row.get("scheduled_at", ""),
        "address": row.get("address", ""),
        "client_name": row.get("client_name", ""),
        "client_phone": row.get("client_phone", ""),
        # Поля Commit C (структура замера)
        "zamer_no": row.get("zamer_no", ""),
        "zamer_date": row.get("zamer_date", ""),
        "floor_base": row.get("floor_base", ""),
        "photos_meta": _safe_json(row.get("photos_meta", "")),
        # Приблизительная дата от менеджера (Commit C2)
        "preferred_type": row.get("preferred_type", ""),
        "preferred_date": row.get("preferred_date", ""),
        "preferred_time_of_day": row.get("preferred_time_of_day", ""),
        "preferred_note": row.get("preferred_note", ""),
        # Логистика — заполняет замерщик (Commit C3)
        "entrance":       row.get("entrance", ""),
        "floor":          row.get("floor", ""),
        "gps_lat":        row.get("gps_lat", ""),
        "gps_lng":        row.get("gps_lng", ""),
        "parking_type":   row.get("parking_type", ""),
        "parking_note":   row.get("parking_note", ""),
        "delivery_notes": row.get("delivery_notes", ""),
        # Google Calendar
        "gcal_event_id":  row.get("gcal_event_id", ""),
        "gcal_event_url": row.get("gcal_event_url", ""),
        # Чертёж и решение про подбор
        "design_files":   [f for f in (row.get("design_files") or "").split(",") if f],
        "podbor_decision":    row.get("podbor_decision", ""),
        "podbor_decision_at": row.get("podbor_decision_at", ""),
        "podbor_lead_id":     row.get("podbor_lead_id", ""),
        # Номера
        "client_no":      row.get("client_no", ""),
        "contract_no":    row.get("contract_no", ""),
        "contract_date":  row.get("contract_date", ""),
    }


def _handle_measurements_list(body: dict[str, Any]) -> dict[str, Any]:
    """Список замеров менеджера, опционально отфильтрованный по client_tg_id / client_name."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if isinstance(unsafe, dict) and unsafe.get("user", {}).get("id"):
            auth = {"user": unsafe["user"]}
        else:
            return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "manager"):
        return {"error": "only_manager"}

    client_tg_id = body.get("client_tg_id") or ""
    client_name = (body.get("client_name") or "").strip().lower()

    try:
        ws = sheets.sheet("Measurements")
        rows = ws.get_all_values()
    except Exception as e:
        log.warning("Failed to read Measurements: %s", e)
        return {"ok": True, "measurements": []}

    if not rows or len(rows) < 2:
        return {"ok": True, "measurements": []}

    headers = rows[0]
    out = []
    for r in rows[1:]:
        row = dict(zip(headers, r + [""] * (len(headers) - len(r))))
        if str(row.get("manager_tg_id", "")) != str(tg_id):
            continue
        # Скрываем soft-deleted
        if row.get("archived_at"):
            continue
        # Опциональные фильтры по клиенту
        if client_tg_id and str(row.get("client_tg_id", "")) != str(client_tg_id):
            continue
        if client_name and (row.get("client_name") or "").strip().lower() != client_name:
            continue
        photo_files = [p for p in (row.get("photos") or "").split(",") if p]
        out.append({
            "id": row.get("id", ""),
            "created_at": row.get("ts") or row.get("created_at", ""),
            "client_tg_id": row.get("client_tg_id", ""),
            "manager_tg_id": row.get("manager_tg_id", ""),
            "filled_by": row.get("filled_by", ""),
            "layout": row.get("layout", ""),
            "area_m2": row.get("area_m2", ""),
            "ceiling_mm": row.get("ceiling_mm", ""),
            "notes": row.get("notes", ""),
            "status": row.get("status", ""),
            "photos": photo_files,
            "photo_count": len(photo_files),
            # Ключевые поля для рендера карточки клиента и таймлайна
            "client_name": row.get("client_name", ""),
            "client_phone": row.get("client_phone", ""),
            "address": row.get("address", ""),
            "scheduled_at": row.get("scheduled_at", ""),
            "client_no": row.get("client_no", ""),
            "contract_no": row.get("contract_no", ""),
            "contract_date": row.get("contract_date", ""),
            "assigned_to_tg_id": row.get("assigned_to_tg_id", ""),
        })

    # Сортируем по дате desc
    out.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"ok": True, "count": len(out), "measurements": out}


_CONTRACT_SYSTEM = """\
Ты — помощник клиента мебельной фабрики ЗОВ (Россия). \
Клиент получил договор на покупку и монтаж кухни и хочет понять его содержание.

Твоя задача — проанализировать текст и дать ответ строго в формате JSON без Markdown-оберток. \
Структура ответа:
{
  "summary": "2-3 предложения — о чём договор",
  "payment": {
    "total": "итоговая сумма если есть",
    "schedule": "схема оплаты (предоплата %, доплата когда)",
    "prepayment_pct": число_или_null
  },
  "deadlines": [
    {"label": "Изготовление", "value": "дата или срок", "note": "подробности"}
  ],
  "risks": [
    {"level": "high|medium|low", "title": "заголовок", "description": "что именно"}
  ],
  "recommendations": ["что уточнить у менеджера или на что обратить внимание"],
  "missing_clauses": ["важные пункты которых нет в тексте"]
}

Риски level:
- high — условие явно невыгодно клиенту или может привести к потере денег
- medium — спорное, зависит от ситуации
- low — мелочь, но лучше знать

Если есть конкретный вопрос (поле question) — добавь поле "question_answer": "ответ на вопрос".
Отвечай на русском. Будь конкретным, избегай юридического жаргона.
"""


def _handle_contract_review(body: dict[str, Any]) -> dict[str, Any]:
    """Клиент вставляет текст договора — AI анализирует его простым языком.
    body: { initData, text: str, question?: str }
    """
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth:
        unsafe = body.get("initDataUnsafe") or {}
        if not (isinstance(unsafe, dict) and unsafe.get("user", {}).get("id")):
            return {"error": "invalid_init_data"}

    text = str(body.get("text") or "").strip()
    question = str(body.get("question") or "").strip()

    if not text:
        return {"error": "text_required"}
    if len(text) > 16_000:
        text = text[:16_000]

    user_prompt = f"Текст договора:\n\n{text}"
    if question:
        user_prompt += f"\n\nВопрос клиента: {question}"

    import asyncio
    result = ai.call_ai(
        user_prompt,
        system_prompt=_CONTRACT_SYSTEM,
        temperature=0.2,
        max_tokens=3000,
    )

    if result.get("error"):
        return {"error": result.get("text", "AI error")}

    analysis = result.get("json") or {}
    return {
        "ok": True,
        "analysis": analysis,
        "raw_text": result.get("text", ""),
        "tokens": result.get("tokens", 0),
        "model": result.get("model", ""),
    }


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


def _xlsx_auth_manager(body: dict[str, Any]) -> tuple[Any, dict[str, Any] | None]:
    """Проверяет initData и возвращает (tg_id, None) для менеджера или (None, error_dict)."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if isinstance(unsafe, dict) and unsafe.get("user", {}).get("id"):
            auth = {"user": unsafe["user"]}
        else:
            return None, {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "manager"):
        return None, {"error": "only_manager"}
    return tg_id, None  # успешно: вернуть None-ошибку, чтобы caller мог сделать if err:


def _parse_xlsx_groups(file_bytes: bytes, source_label: str) -> list[dict[str, Any]]:
    """Общий парсер для ОТГРУЗКИ.xlsx и «Поступление заказов на склад СПб.xlsx».

    Оба файла содержат листы вида «ЗОВ ДД.ММ.ГГ» с одинаковыми столбцами:
    №, Товар (Заказ/Дозаказ), договор №, Срок, Кол мест, Фурн-ра СПБ,
    Панели/техника СПБ, (empty), Продавец, Сборщик, Примечание, Дата отгрузки, Кто забрал.

    «Поступление» дополнительно имеет:
    - 2 строки-шапки перед заголовком (Накладная от…, Поставщик:…)
    - разделители «Кухни» / «Дозаказы» между блоками данных
    Функция находит строку заголовков динамически (первая строка с «Товар»).
    """
    import io
    try:
        import openpyxl
    except ImportError:
        raise RuntimeError("openpyxl_not_installed")

    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    groups: list[dict[str, Any]] = []

    # Метки секций, которые нужно пропускать как строки-данные
    _SECTION_LABELS = {"кухни", "дозаказы", "кухня"}

    for sheet_name in wb.sheetnames:
        if not sheet_name.strip().upper().startswith("ЗОВ "):
            continue
        date_part = sheet_name.strip()[4:].strip()
        try:
            if len(date_part) == 8:
                factory_date = datetime.strptime(date_part, "%d.%m.%y").date()
            elif len(date_part) == 10:
                factory_date = datetime.strptime(date_part, "%d.%m.%Y").date()
            else:
                continue
        except ValueError:
            continue

        ws = wb[sheet_name]
        all_rows = list(ws.iter_rows(values_only=True))
        if len(all_rows) < 2:
            continue

        # Динамически находим строку заголовков — первая строка, содержащая «Товар»
        header_idx = None
        for i, row in enumerate(all_rows):
            cells = [str(c).strip().lower() if c is not None else "" for c in row]
            if "товар" in cells:
                header_idx = i
                break
        if header_idx is None:
            continue  # нет строки с заголовком

        raw_headers = all_rows[header_idx]
        headers = [str(h).strip() if h is not None else "" for h in raw_headers]

        def _clean(v: Any) -> str:
            s = str(v or "").strip()
            return "" if s.lower() in ("none", "") else s

        items: list[dict[str, Any]] = []
        for row in all_rows[header_idx + 1:]:
            # Пропускаем полностью пустые строки
            non_empty = [v for v in row if v is not None and str(v).strip()]
            if not non_empty:
                continue

            # Строим словарь
            rd: dict[str, Any] = {}
            for i, val in enumerate(row):
                key = headers[i] if i < len(headers) else f"_col{i}"
                rd[key] = val

            tovar_raw = str(rd.get("Товар") or "").strip()
            if not tovar_raw or tovar_raw.lower() in ("none", "товар"):
                continue
            # Пропускаем разделители-секции («Кухни», «Дозаказы»)
            if tovar_raw.lower() in _SECTION_LABELS:
                continue
            # Пропускаем шаблонные пустые строки — Заказ/Дозаказ без прочих данных
            if tovar_raw in ("Заказ", "Дозаказ") and len(non_empty) <= 2:
                continue

            # Договор № — колонка с заголовком «договор», или 3-я колонка (C)
            contract = ""
            for h in headers:
                if "договор" in h.lower() or "дог" in h.lower():
                    contract = _clean(rd.get(h))
                    break
            if not contract and len(headers) > 2:
                contract = _clean(rd.get(headers[2]))

            items.append({
                "num":           _clean(rd.get("№")),
                "tovar":         tovar_raw,
                "contract":      contract,
                "deadline":      _parse_xlsx_date(rd.get("Срок")),
                "places":        _clean(rd.get("Кол мест") or rd.get("Кол. мест") or rd.get("Кол.мест")),
                "furn_spb":      _clean(rd.get("Фурн-ра СПБ") or rd.get("фурн-ра СПБ") or rd.get("Фурн СПБ")),
                "panels_spb":    _clean(rd.get("Панели/техника СПБ") or rd.get("панели и техника СПБ в заказе") or rd.get("Панели СПБ")),
                "seller":        _clean(rd.get("Продавец")),
                "assembler":     _clean(rd.get("Сборщик")),
                "note":          _clean(rd.get("Примечание")),
                "delivery_date": _parse_xlsx_date(rd.get("Дата отгрузки")),
                "picked_up_by":  _clean(rd.get("Кто забрал")),
            })

        if items:
            groups.append({
                "factory_date":     factory_date.strftime("%d.%m.%Y"),
                "factory_date_iso": factory_date.isoformat(),
                "sheet_name":       sheet_name.strip(),
                "source":           source_label,
                "count":            len(items),
                "count_zakazov":    sum(1 for i in items if "Доз" not in i["tovar"]),
                "count_dozakazov":  sum(1 for i in items if "Доз" in i["tovar"]),
                "items":            items,
            })

    groups.sort(key=lambda x: x["factory_date_iso"])
    return groups


def _handle_shipments(body: dict[str, Any]) -> dict[str, Any]:
    """ОТГРУЗКИ.xlsx — отгрузки с завода. Только для менеджера."""
    tg_id, err = _xlsx_auth_manager(body)
    if err:
        return err

    cfg = get_config()
    file_id = cfg.shipments_file_id
    if not file_id:
        return {"ok": True, "shipments": [], "note": "file_not_configured"}
    try:
        file_bytes = drive.download_file_bytes(file_id)
    except Exception as e:
        log.exception("shipments: не удалось скачать drive=%s", file_id)
        return {"error": f"drive_error: {str(e)}"}
    try:
        groups = _parse_xlsx_groups(file_bytes, "shipments")
    except Exception as e:
        log.exception("shipments: ошибка парсинга xlsx")
        return {"error": f"parse_error: {str(e)}"}
    return {"ok": True, "shipments": groups}


def _handle_arrivals(body: dict[str, Any]) -> dict[str, Any]:
    """«Поступление заказов на склад СПб.xlsx» — приход на склад. Только для менеджера."""
    tg_id, err = _xlsx_auth_manager(body)
    if err:
        return err

    cfg = get_config()
    file_id = cfg.arrivals_file_id
    if not file_id:
        return {"ok": True, "shipments": [], "note": "file_not_configured"}
    try:
        file_bytes = drive.download_file_bytes(file_id)
    except Exception as e:
        log.exception("arrivals: не удалось скачать drive=%s", file_id)
        return {"error": f"drive_error: {str(e)}"}
    try:
        groups = _parse_xlsx_groups(file_bytes, "arrivals")
    except Exception as e:
        log.exception("arrivals: ошибка парсинга xlsx")
        return {"error": f"parse_error: {str(e)}"}
    return {"ok": True, "shipments": groups}


def _parse_xlsx_date(val: Any) -> str:
    """Парсит дату из ячейки Excel — datetime, date или строка."""
    if val is None:
        return ""
    from datetime import date as date_t
    if isinstance(val, datetime):
        return val.strftime("%d.%m.%Y")
    if isinstance(val, date_t):
        return val.strftime("%d.%m.%Y")
    s = str(val).strip()
    if not s or s.lower() in ("none", ""):
        return ""
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d.%m.%y"):
        try:
            return datetime.strptime(s, fmt).strftime("%d.%m.%Y")
        except ValueError:
            pass
    return s  # вернём как есть если не распознали


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
