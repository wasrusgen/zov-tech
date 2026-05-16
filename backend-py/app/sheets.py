"""Тонкая обёртка над Google Sheets через gspread + service account."""
from __future__ import annotations
import threading
from datetime import datetime, timedelta, timezone
from typing import Any
import gspread
from google.oauth2.service_account import Credentials

from .config import get_config

_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
_lock = threading.Lock()
_client: gspread.Client | None = None
_book: gspread.Spreadsheet | None = None


def _client_book() -> tuple[gspread.Client, gspread.Spreadsheet]:
    global _client, _book
    with _lock:
        # Если предыдущая попытка частично инициализировалась (auth прошёл, open_by_key упал) —
        # _client есть, _book нет. Нужно повторить open_by_key.
        if _client is None or _book is None:
            try:
                cfg = get_config()
                if _client is None:
                    creds = Credentials.from_service_account_file(cfg.google_credentials_path, scopes=_SCOPES)
                    _client = gspread.authorize(creds)
                _book = _client.open_by_key(cfg.sheet_id)
            except Exception:
                _client = None
                _book = None
                raise
        return _client, _book  # type: ignore


def sheet(name: str) -> gspread.Worksheet:
    _, book = _client_book()
    return book.worksheet(name)


def ensure_sheet(name: str, headers: list[str]) -> gspread.Worksheet:
    """Создаёт лист с заголовками если он не существует. Иначе возвращает существующий."""
    _, book = _client_book()
    try:
        ws = book.worksheet(name)
        try:
            first = ws.row_values(1)
        except Exception:
            first = []
        if not first:
            ws.update("A1", [headers])
        return ws
    except gspread.exceptions.WorksheetNotFound:
        ws = book.add_worksheet(title=name, rows=2000, cols=max(20, len(headers)))
        ws.append_row(headers, value_input_option="USER_ENTERED")
        return ws


def append_row(name: str, row: list[Any]) -> None:
    sheet(name).append_row(row, value_input_option="USER_ENTERED")


def append_named_row(name: str, data: dict[str, Any]) -> None:
    """Записывает строку по ИМЕНАМ колонок из реального заголовка листа.
    Безопасно при любом порядке колонок — значения выставляются по имени,
    а не по позиции, так что нет расхождения с _measurement_columns()."""
    ws = sheet(name)
    headers = ws.row_values(1)
    if not headers:
        raise ValueError(f"Sheet {name!r} has no header row")
    row = [str(data.get(h, "") if data.get(h, "") is not None else "") for h in headers]
    ws.append_row(row, value_input_option="RAW")


def find_row(sheet_name: str, key_col: str, key_val: Any) -> dict[str, Any] | None:
    """Линейный поиск по колонке-ключу. Возвращает строку как dict или None."""
    s = sheet(sheet_name)
    rows = s.get_all_values()
    if not rows:
        return None
    headers = rows[0]
    if key_col not in headers:
        return None
    idx = headers.index(key_col)
    for r in rows[1:]:
        if len(r) > idx and str(r[idx]).strip() == str(key_val).strip():
            return dict(zip(headers, r + [""] * (len(headers) - len(r))))
    return None


def update_cell_by_key(sheet_name: str, key_col: str, key_val: Any, target_col: str, new_val: Any) -> bool:
    s = sheet(sheet_name)
    rows = s.get_all_values()
    if not rows:
        return False
    headers = rows[0]
    if key_col not in headers or target_col not in headers:
        return False
    key_idx = headers.index(key_col)
    target_idx = headers.index(target_col)
    for i, r in enumerate(rows[1:], start=2):
        if len(r) > key_idx and str(r[key_idx]).strip() == str(key_val).strip():
            s.update_cell(i, target_idx + 1, new_val)
            return True
    return False


def get_setting(key: str) -> str | None:
    row = find_row("Settings", "key", key)
    return (row or {}).get("value")


# === Доменные хелперы ===

def find_user(tg_id: int) -> dict[str, Any] | None:
    if not tg_id:
        return None
    row = find_row("Users", "tg_id", tg_id)
    if not row:
        return None
    full_name = (f"{row.get('first_name', '')} {row.get('last_name', '')}".strip()
                 or row.get("tg_username", ""))
    roles = parse_roles(row.get("role", ""))
    return {**row, "full_name": full_name, "roles": roles}


# ---- Multi-role helpers ----

VALID_ROLES = {"manager", "client", "measurer", "assembler"}


def parse_roles(role_str: str) -> list[str]:
    """Парсит CSV-роли: 'manager,measurer' → ['manager', 'measurer'].
    Старые однострочные значения тоже работают: 'manager' → ['manager']."""
    if not role_str:
        return []
    parts = [p.strip() for p in str(role_str).split(",") if p.strip()]
    return [p for p in parts if p in VALID_ROLES]


def has_role(user: dict[str, Any] | None, role: str) -> bool:
    if not user:
        return False
    return role in parse_roles(user.get("role", ""))


def is_master(user: dict[str, Any] | None) -> bool:
    """«Мастер» — единая роль для замерщика+сборщика.
    True если у пользователя есть либо measurer, либо assembler."""
    if not user:
        return False
    roles = parse_roles(user.get("role", ""))
    return "measurer" in roles or "assembler" in roles


def primary_role(user: dict[str, Any] | None) -> str:
    """Первая (главная) роль для legacy-кода: manager > measurer > assembler > client."""
    if not user:
        return ""
    roles = parse_roles(user.get("role", ""))
    for r in ("manager", "measurer", "assembler", "client"):
        if r in roles:
            return r
    return roles[0] if roles else ""


def grant_role(tg_id: int, role: str) -> bool:
    """Добавляет роль пользователю (если её ещё нет). Возвращает True если что-то изменилось.
    Замерщик и сборщик объединены в одну роль «мастер» — при выдаче одной автоматически выдаётся вторая."""
    if role not in VALID_ROLES:
        return False
    user = find_user(tg_id)
    if not user:
        return False
    current = parse_roles(user.get("role", ""))
    changed = False
    if role not in current:
        current.append(role)
        changed = True
    # Парный «мастер»: measurer ↔ assembler — выдаём вместе
    paired = {"measurer": "assembler", "assembler": "measurer"}.get(role)
    if paired and paired not in current:
        current.append(paired)
        changed = True
    if not changed:
        return False
    return update_cell_by_key("Users", "tg_id", tg_id, "role", ",".join(current))


def revoke_role(tg_id: int, role: str) -> bool:
    user = find_user(tg_id)
    if not user:
        return False
    current = parse_roles(user.get("role", ""))
    if role not in current:
        return False
    current.remove(role)
    new_val = ",".join(current) if current else "client"  # fallback роль
    return update_cell_by_key("Users", "tg_id", tg_id, "role", new_val)


def list_users_with_role(role: str) -> list[dict[str, Any]]:
    """Все пользователи, у которых есть указанная роль (для dropdown «выбрать замерщика»)."""
    s = sheet("Users")
    rows = s.get_all_values()
    if not rows:
        return []
    headers = rows[0]
    out: list[dict[str, Any]] = []
    for r in rows[1:]:
        row = dict(zip(headers, r + [""] * (len(headers) - len(r))))
        if role in parse_roles(row.get("role", "")):
            full_name = (f"{row.get('first_name', '')} {row.get('last_name', '')}".strip()
                         or row.get("tg_username", ""))
            out.append({
                "tg_id": row.get("tg_id"),
                "full_name": full_name,
                "tg_username": row.get("tg_username", ""),
                "roles": parse_roles(row.get("role", "")),
            })
    return out


def get_or_create_user(tg_user: dict[str, Any], start_param: str | None,
                       explicit_role: str | None = None) -> dict[str, Any]:
    cfg = get_config()
    tg_id = tg_user["id"]
    admin_id = cfg.admin_tg_id

    existing = find_user(tg_id)
    now_str = _now_str()

    if existing:
        update_cell_by_key("Users", "tg_id", tg_id, "last_seen_at", now_str)
        # Админ всегда имеет роль manager (могут быть и другие)
        if tg_id == admin_id and not has_role(existing, "manager"):
            grant_role(tg_id, "manager")
            ensure_admin_manager(tg_user)
            fresh = find_user(tg_id) or {}
            existing["role"] = fresh.get("role", existing.get("role", ""))
            existing["roles"] = fresh.get("roles", [])
        # explicit_role из query (?role=manager|client|staff) — не перетираем уже выданные роли,
        # только добавляем если человек впервые открыл эту секцию
        elif explicit_role and explicit_role in VALID_ROLES and not has_role(existing, explicit_role):
            # client/manager — стандартные роли любой может получить через выбор в боте
            if explicit_role in ("manager", "client"):
                grant_role(tg_id, explicit_role)
                fresh = find_user(tg_id) or {}
                existing["role"] = fresh.get("role", existing.get("role", ""))
                existing["roles"] = fresh.get("roles", [])
        return existing

    # Новый пользователь
    role = "client"
    invite_code = ""
    if tg_id == admin_id:
        role = "manager"
    elif explicit_role in ("manager", "client"):
        role = explicit_role
    elif start_param and start_param.startswith("client_inv_"):
        role = "client"
        invite_code = start_param

    append_row("Users", [
        tg_id,
        tg_user.get("username", ""),
        tg_user.get("first_name", ""),
        tg_user.get("last_name", ""),
        role,  # хранится как CSV; для новых = одна роль
        now_str,
        now_str,
        invite_code,
    ])
    if tg_id == admin_id:
        ensure_admin_manager(tg_user)
    return find_user(tg_id) or {}


def ensure_admin_manager(tg_user: dict[str, Any]) -> None:
    tg_id = tg_user["id"]
    if find_row("Managers", "tg_id", tg_id):
        return
    full_name = (f"{tg_user.get('first_name', '')} {tg_user.get('last_name', '')}".strip()
                 or tg_user.get("username", "") or str(tg_id))
    append_row("Managers", [
        tg_id, full_name, "vasrusgen@gmail.com", "",
        "ЗОВ — куратор сети", "Санкт-Петербург",
        True, "active", "", "", 0, 0, 0, "MGR_ADMIN",
    ])


def get_manager_profile(tg_id: int) -> dict[str, Any] | None:
    cfg = get_config()
    row = find_row("Managers", "tg_id", tg_id)
    if not row:
        return None
    is_zov = str(row.get("is_zov_employee", "")).lower() in ("true", "1", "да", "yes")

    last_order = _parse_date(row.get("last_order_date"))
    active_period = int(get_setting("ACTIVE_PERIOD_DAYS") or cfg.active_period_days)
    grace_period = int(get_setting("GRACE_PERIOD_DAYS") or cfg.grace_period_days)

    active_until = None
    status = "lapsed"
    if is_zov:
        status = "active"
    elif last_order:
        active_until = last_order + timedelta(days=active_period)
        grace_until = active_until + timedelta(days=grace_period)
        now = datetime.now(timezone.utc).astimezone()
        if last_order.tzinfo is None:
            now = now.replace(tzinfo=None)
        if now <= active_until:
            status = "active"
        elif now <= grace_until:
            status = "grace"
        else:
            status = "lapsed"

    return {
        **row,
        "is_zov_employee": is_zov,
        "active_until": active_until,
        "status": status,
    }


def get_client_profile(tg_id: int) -> dict[str, Any] | None:
    return find_row("Clients", "tg_id", tg_id)


def log_event(event: str, tg_id: int | None, payload: dict[str, Any] | None = None) -> None:
    import json
    try:
        append_row("Logs", [
            _now_str(), event, tg_id or "",
            json.dumps(payload, ensure_ascii=False) if payload else "",
        ])
    except Exception:
        pass


def _now_str() -> str:
    """ISO-формат для записи в Sheet (gspread не принимает datetime)."""
    return datetime.now(timezone.utc).astimezone().isoformat()


def _parse_date(v: Any) -> datetime | None:
    if not v:
        return None
    if isinstance(v, datetime):
        return v
    s = str(v).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%Y-%m-%dT%H:%M:%S", "%d.%m.%Y %H:%M:%S"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None
