"""ЗОВ Backend — FastAPI app. Полный порт Apps Script Code.gs."""
from __future__ import annotations
import base64
import json
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from .config import get_config
from .auth import verify_init_data
from . import sheets, ai, telegram as tg, proxy_pool, catalog
from . import parsers
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
        "measurement_request":  _handle_measurement_request,
        "measurement_inbox":    _handle_measurement_inbox,
        "measurement_schedule": _handle_measurement_schedule,
        "measurement_next_no":  _handle_measurement_next_no,
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
    media = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(ext, "application/octet-stream")
    return FileResponse(str(p), media_type=media)


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
    ]


def _ensure_measurements_sheet() -> None:
    """Один раз догоняет схему Measurements — добавляет недостающие колонки."""
    try:
        ws = sheets.sheet("Measurements")
        existing = ws.row_values(1)
    except Exception:
        sheets.ensure_sheet("Measurements", _measurement_columns())
        return
    want = _measurement_columns()
    missing = [c for c in want if c not in existing]
    if missing:
        new_headers = existing + missing
        ws.update("A1", [new_headers])
        log.info("Measurements: дополнили колонки: %s", missing)


def _row_for_measurement(measurement_id: str, ts: str, **fields) -> list[str]:
    """Собирает строку в нужном порядке колонок (для append_row)."""
    cols = _measurement_columns()
    base = {
        "id": measurement_id, "ts": ts,
        "client_tg_id": "", "manager_tg_id": "", "filled_by": "",
        "layout": "", "area_m2": "", "ceiling_mm": "",
        "walls": "{}", "openings": "{}", "infra": "{}", "niches": "{}",
        "photos": "", "notes": "", "status": "submitted",
        "assigned_to_tg_id": "", "requested_by_tg_id": "", "scheduled_at": "",
        "address": "", "client_name": "", "client_phone": "",
        "zamer_no": "", "zamer_date": "", "floor_base": "", "photos_meta": "",
        "preferred_type": "", "preferred_date": "", "preferred_time_of_day": "", "preferred_note": "",
    }
    base.update(fields)
    return [str(base.get(c, "")) for c in cols]


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
        sheets.append_row("Measurements", _row_for_measurement(
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
                f"Фото: {len(saved_photos)} шт · площадь {m.get('area_m2') or '—'} м²\n\n"
                f"Откройте кабинет — можно запускать подбор техники."
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


def _handle_clients(body: dict[str, Any]) -> dict[str, Any]:
    """Возвращает список клиентов менеджера со сводкой по подборам."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user or user.get("role") != "manager":
        return {"error": "only_manager"}

    try:
        ws = sheets.sheet("Leads")
        rows = ws.get_all_values()
    except Exception as e:
        log.warning("Failed to read Leads: %s", e)
        return {"ok": True, "clients": []}

    if not rows or len(rows) < 2:
        return {"ok": True, "clients": []}

    headers = rows[0]
    by_client: dict[str, dict[str, Any]] = {}

    for r in rows[1:]:
        row = dict(zip(headers, r + [""] * (len(headers) - len(r))))
        if str(row.get("manager_tg_id", "")) != str(tg_id):
            continue
        client_name = (row.get("client_name") or "").strip()
        client_tg_id = (row.get("client_tg_id") or "").strip()
        # Ключ для группировки: tg_id если есть, иначе имя
        key = client_tg_id or client_name.lower()
        if not key:
            continue
        if key not in by_client:
            by_client[key] = {
                "client_name": client_name,
                "client_tg_id": client_tg_id or None,
                "client_phone": "",
                "leads_count": 0,
                "last_lead_at": "",
                "last_lead_id": "",
                "leads": [],
            }
        c = by_client[key]
        c["leads_count"] += 1
        lead_id = row.get("id", "")
        created_at = row.get("created_at", "")
        status = row.get("status", "")
        c["leads"].append({
            "id": lead_id,
            "created_at": created_at,
            "status": status,
        })
        # Обновляем «последний»
        if created_at > c["last_lead_at"]:
            c["last_lead_at"] = created_at
            c["last_lead_id"] = lead_id
            # Достаём телефон из checklist JSON
            checklist_str = row.get("checklist", "")
            if checklist_str:
                try:
                    cl = json.loads(checklist_str)
                    if cl.get("client_phone"):
                        c["client_phone"] = cl["client_phone"]
                except (ValueError, TypeError):
                    pass

    # Сортируем по дате последнего подбора (новые сверху)
    clients = sorted(by_client.values(), key=lambda x: x["last_lead_at"], reverse=True)
    # Внутри каждого клиента — leads тоже по дате desc
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
    body: {initData, client_name, client_phone, address, assigned_to_tg_id?, notes?}"""
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
    sheets.append_row("Measurements", _row_for_measurement(
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
        timing_line = _format_preferred_human(
            preferred_type, preferred_date, preferred_time_of_day, preferred_note
        )
        tg.send_message(
            int(assigned_to),
            f"📐 <b>Новая заявка на замер</b>\n\n"
            f"Клиент: <b>{client_name}</b>\n"
            f"Телефон: <code>{client_phone}</code>\n"
            f"Адрес: {address or '—'}\n"
            f"Когда: {timing_line}\n"
            f"От менеджера: {user.get('full_name') or tg_id}\n\n"
            f"{notes if notes else ''}\n"
            f"Откройте кабинет — согласуйте точную дату с клиентом."
        )

    sheets.log_event("measurement_requested", tg_id, {
        "id": measurement_id, "assigned_to": assigned_to, "client": client_name,
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

    # Уведомляем менеджера
    notify_to = row.get("requested_by_tg_id") or row.get("manager_tg_id")
    if notify_to and str(notify_to) != str(tg_id):
        try:
            tg.send_message(
                int(notify_to),
                f"📅 <b>Замер назначен</b>\n\n"
                f"Клиент: <b>{row.get('client_name') or '—'}</b>\n"
                f"Дата: {_format_date_human(scheduled_at)}\n"
                f"Замерщик: {user.get('full_name') or tg_id}\n"
                f"Адрес: {row.get('address') or '—'}"
            )
        except Exception:
            pass

    sheets.log_event("measurement_scheduled", tg_id, {
        "id": measurement_id, "scheduled_at": scheduled_at,
    })
    return {"ok": True, "id": measurement_id, "status": "scheduled", "scheduled_at": scheduled_at}


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

    # Только владелец-менеджер или клиент-владелец видит замер
    if user.get("role") == "manager":
        if str(row.get("manager_tg_id", "")) != str(tg_id):
            return {"error": "forbidden"}
    else:
        if str(row.get("client_tg_id", "")) != str(tg_id):
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
    }


def _handle_measurements_list(body: dict[str, Any]) -> dict[str, Any]:
    """Список замеров менеджера, опционально отфильтрованный по client_tg_id / client_name."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        return {"error": "invalid_init_data"}
    tg_id = auth["user"]["id"]
    user = sheets.find_user(tg_id)
    if not user or user.get("role") != "manager":
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
        # Опциональные фильтры по клиенту
        if client_tg_id and str(row.get("client_tg_id", "")) != str(client_tg_id):
            continue
        # Из notes / других JSON-полей вытащим client_name если был передан в measurement
        # (он не сохраняется в отдельной колонке — только в JSON-обвязке)
        # Для MVP — фильтр по имени делаем после парсинга JSON-полей
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
        })

    # Сортируем по дате desc
    out.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"ok": True, "count": len(out), "measurements": out}


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
