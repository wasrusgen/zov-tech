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
from . import sheets, ai, telegram as tg

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
        return JSONResponse(fn(body))
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
    return _handle_podbor(body)


@app.get("/api/test_ai")
async def api_test_ai():
    return _handle_test_ai()


@app.get("/api/test_telegram")
async def api_test_telegram():
    return _handle_test_telegram()


@app.get("/api/seed_admin")
async def api_seed_admin():
    return _handle_seed_admin()


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

    user_prompt = (
        f"Подбери технику для следующего клиента:\n\n"
        f"{json.dumps({'client': {'name': client_name}, 'checklist': checklist}, ensure_ascii=False, indent=2)}"
    )
    ai_result = ai.call_ai(user_prompt)

    # Update lead row with AI response
    sheets.update_cell_by_key("Leads", "id", lead_id, "ai_response",
                              json.dumps(ai_result.get("json") or ai_result.get("text", ""), ensure_ascii=False))
    sheets.update_cell_by_key("Leads", "id", lead_id, "ai_model", ai_result.get("model", ""))
    sheets.update_cell_by_key("Leads", "id", lead_id, "ai_tokens_used", ai_result.get("tokens", 0))
    sheets.update_cell_by_key("Leads", "id", lead_id, "sent_to_tg", True)

    summary_text = _format_podbor_for_telegram(ai_result, client_name)
    tg.send_message(tg_id, summary_text)

    sheets.log_event("podbor_completed", tg_id, {"id": lead_id, "tokens": ai_result.get("tokens", 0)})
    return {"ok": True, "id": lead_id, "summary": summary_text}


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

def _format_podbor_for_telegram(ai_result: dict[str, Any], client_name: str) -> str:
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

    for item in (j.get("items") or []):
        lines.append(f"<b>{item.get('brand', '')} {item.get('model', '')}</b>")
        if item.get("price_rub"):
            lines.append(f"💰 {_format_price(item['price_rub'])} ₽")
        if item.get("highlights"):
            lines.append("✓ " + ", ".join(item["highlights"]))
        if item.get("caveats"):
            lines.append(f"⚠️ {item['caveats']}")
        lines.append("")

    if j.get("total_price_rub"):
        lines.append(f"<b>ИТОГО: {_format_price(j['total_price_rub'])} ₽</b> · {j.get('budget_status', '')}")
    if j.get("warnings"):
        lines.append("\n⚠️ " + "; ".join(j["warnings"]))
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
