"""Модуль «Подбор техники — цикл согласования».

Цикл:
  1. Клиент заполняет brief (анкету пожеланий)  → status=brief
  2. Менеджер видит brief, создаёт/дополняет подборку → status=draft
  3. Менеджер отправляет клиенту                → status=sent
  4. Клиент голосует (✅/❌) + оставляет комментарий → status=reviewed
  5. Менеджер фиксирует итог                    → status=done

Google Sheets: лист «Proposals».
"""
from __future__ import annotations

import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from . import sheets
from .auth import verify_init_data
from .config import get_config

log = logging.getLogger("zov.proposals")

# ---------------------------------------------------------------------------
# Sheet setup
# ---------------------------------------------------------------------------

PROPOSALS_HEADERS = [
    "id", "client_key", "client_tg_id", "manager_tg_id",
    "status",           # brief | draft | sent | reviewed | done | archived
    "brief_json",       # JSON объект с анкетой клиента
    "positions_json",   # JSON массив категорий с вариантами
    "client_comment",   # общий текстовый комментарий клиента
    "manager_comment",  # финальная заметка менеджера
    "created_at", "sent_at", "reviewed_at", "archived_at",
]

ACTIVE_STATUSES = {"brief", "draft", "sent", "reviewed"}


def ensure_sheet() -> None:
    sheets.ensure_sheet("Proposals", PROPOSALS_HEADERS)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _short_id() -> str:
    return uuid.uuid4().hex[:13]


def _parse_json(raw: str, default: Any) -> Any:
    try:
        return json.loads(raw) if raw and raw.strip() else default
    except Exception:
        return default


def _row_to_dict(headers: list[str], row: list) -> dict[str, Any]:
    d = dict(zip(headers, row + [""] * (len(headers) - len(row))))
    d["brief_json"] = _parse_json(d.get("brief_json", ""), {})
    d["positions_json"] = _parse_json(d.get("positions_json", ""), [])
    return d


def _get_all(ws) -> tuple[list[str], list[dict]]:
    """Возвращает (headers, list_of_dicts), пропуская пустые строки."""
    rows = ws.get_all_values()
    if not rows or len(rows) < 1:
        return [], []
    headers = rows[0]
    return headers, [_row_to_dict(headers, r) for r in rows[1:] if any(r)]


def _find_row_num(ws, proposal_id: str) -> int | None:
    """Номер строки в листе (1-based, с учётом заголовка) или None."""
    rows = ws.get_all_values()
    if not rows:
        return None
    try:
        id_col = rows[0].index("id")
    except ValueError:
        return None
    for i, row in enumerate(rows[1:], start=2):
        if len(row) > id_col and row[id_col] == proposal_id:
            return i
    return None


def _update_field(ws, row_num: int, headers: list[str], field: str, value: Any) -> None:
    try:
        col = headers.index(field) + 1
        ws.update_cell(row_num, col, value)
    except Exception as e:
        log.warning("_update_field %s: %s", field, e)


def _update_fields(ws, row_num: int, headers: list[str], updates: dict[str, Any]) -> None:
    for field, value in updates.items():
        _update_field(ws, row_num, headers, field, value)


def _tg_notify(chat_id: str, text: str) -> None:
    """Отправляет сообщение через Telegram Bot API (sync, fire-and-forget)."""
    cfg = get_config()
    if not cfg.bot_token or not chat_id:
        return
    try:
        url = f"https://api.telegram.org/bot{cfg.bot_token}/sendMessage"
        httpx.post(url, json={
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
        }, timeout=8)
    except Exception as e:
        log.warning("tg_notify to %s failed: %s", chat_id, e)


def _auth(body: dict) -> tuple[str | None, dict | None]:
    """Парсит initData → (tg_id_str, None) или (None, error_dict)."""
    cfg = get_config()
    auth = verify_init_data(body.get("initData") or "", cfg.bot_token)
    if not auth or not auth.get("user"):
        unsafe = body.get("initDataUnsafe") or {}
        if isinstance(unsafe, dict) and unsafe.get("user", {}).get("id"):
            auth = {"user": unsafe["user"]}
        else:
            return None, {"error": "invalid_init_data"}
    return str(auth["user"]["id"]), None


def _brief_summary(brief: dict) -> str:
    """Краткое текстовое описание анкеты для уведомления."""
    lines = []
    hob_labels = {"induction": "Индукция", "gas": "Газ", "electric": "Эл-во", "none": "—"}
    if brief.get("hob"):
        lines.append(f"Варочная: {hob_labels.get(brief['hob'], brief['hob'])}")
    if brief.get("oven"):
        lines.append("Духовка: нужна")
    dw = brief.get("dishwasher")
    if dw and dw != "none":
        lines.append(f"Посудомойка: {dw} см")
    hood_labels = {"builtin": "Встройка", "dome": "Купол", "none": "—"}
    if brief.get("hood") and brief["hood"] != "none":
        lines.append(f"Вытяжка: {hood_labels.get(brief['hood'], brief['hood'])}")
    if brief.get("budget"):
        lines.append(f"Бюджет: {int(brief['budget']):,} ₽".replace(",", " "))
    if brief.get("notes"):
        lines.append(f"Пожелания: {brief['notes'][:120]}")
    return "\n".join(lines) if lines else "Анкета заполнена"


# ---------------------------------------------------------------------------
# API handlers
# ---------------------------------------------------------------------------

def handle_brief(body: dict) -> dict:
    """Клиент сохраняет анкету пожеланий. Создаёт или обновляет Proposal со status=brief.
    Уведомляет менеджера."""
    tg_id, err = _auth(body)
    if err:
        return err
    cfg = get_config()

    brief: dict = {
        "hob":        body.get("hob", ""),
        "oven":       body.get("oven", ""),
        "dishwasher": body.get("dishwasher", ""),
        "hood":       body.get("hood", ""),
        "fridge":     body.get("fridge", ""),
        "microwave":  body.get("microwave", ""),
        "budget":     body.get("budget", ""),
        "notes":      str(body.get("notes", "") or "").strip(),
    }
    client_name = str(body.get("client_name", "") or "").strip()
    client_key = client_name.lower() if client_name else f"tg_{tg_id}"

    # Менеджер из карточки клиента
    manager_tg_id = str(cfg.admin_tg_id) if cfg.admin_tg_id else ""
    cl_row = sheets.find_row("Clients", "client_key", client_key)
    if cl_row:
        manager_tg_id = str(cl_row.get("manager_tg_id", "") or manager_tg_id)
    if not manager_tg_id:
        # Fallback — попробуем найти по tg_id
        cl_row2 = sheets.find_row("Clients", "client_tg_id", tg_id)
        if cl_row2:
            manager_tg_id = str(cl_row2.get("manager_tg_id", "") or manager_tg_id)
            client_key = cl_row2.get("client_key", client_key)

    ensure_sheet()
    ws = sheets.sheet("Proposals")
    headers, all_dicts = _get_all(ws)

    # Ищем существующий активный proposal этого клиента
    existing = next(
        (d for d in all_dicts
         if (str(d.get("client_tg_id")) == tg_id or d.get("client_key") == client_key)
         and d.get("status") in ACTIVE_STATUSES
         and not d.get("archived_at")),
        None,
    )

    if existing:
        proposal_id = existing["id"]
        row_num = _find_row_num(ws, proposal_id)
        if row_num:
            _update_fields(ws, row_num, headers, {
                "brief_json": json.dumps(brief, ensure_ascii=False),
                "status": "brief",
                "client_tg_id": tg_id,
            })
    else:
        proposal_id = _short_id()
        row = [
            proposal_id, client_key, tg_id, manager_tg_id,
            "brief",
            json.dumps(brief, ensure_ascii=False),
            "[]", "", "",
            _now(), "", "", "",
        ]
        sheets.append_row("Proposals", row)

    # Уведомление менеджеру
    if manager_tg_id:
        name_tag = f"<b>{client_name}</b>" if client_name else f"клиент (tg {tg_id})"
        _tg_notify(manager_tg_id,
            f"📋 {name_tag} заполнил анкету на подбор техники:\n\n"
            f"{_brief_summary(brief)}\n\n"
            f"Откройте карточку клиента, чтобы начать подбор.")

    return {"ok": True, "proposal_id": proposal_id}


def handle_create(body: dict) -> dict:
    """Менеджер вручную создаёт Proposal для клиента (status=draft)."""
    tg_id, err = _auth(body)
    if err:
        return err
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "manager"):
        return {"error": "only_manager"}

    client_key = str(body.get("client_key", "") or "").strip().lower()
    if not client_key:
        return {"error": "client_key required"}

    client_tg_id = str(body.get("client_tg_id", "") or "")

    ensure_sheet()
    ws = sheets.sheet("Proposals")
    headers, all_dicts = _get_all(ws)

    # Проверяем, нет ли уже активного
    existing = next(
        (d for d in all_dicts
         if d.get("client_key") == client_key
         and d.get("status") in ACTIVE_STATUSES
         and not d.get("archived_at")),
        None,
    )
    if existing:
        return {"ok": True, "proposal_id": existing["id"], "existing": True}

    proposal_id = _short_id()
    row = [
        proposal_id, client_key, client_tg_id, tg_id,
        "draft", "{}", "[]", "", "",
        _now(), "", "", "",
    ]
    sheets.append_row("Proposals", row)
    return {"ok": True, "proposal_id": proposal_id}


def handle_upsert_variant(body: dict) -> dict:
    """Менеджер добавляет или обновляет вариант в категории.
    body: {proposal_id, category, category_label, variant: {id?, model, url, price,
           image_url?, manager_comment?}}
    """
    tg_id, err = _auth(body)
    if err:
        return err
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "manager"):
        return {"error": "only_manager"}

    proposal_id = body.get("proposal_id", "")
    category    = body.get("category", "").strip()
    cat_label   = body.get("category_label", category)
    variant_in  = body.get("variant", {}) or {}
    if not proposal_id or not category:
        return {"error": "proposal_id and category required"}

    ensure_sheet()
    ws = sheets.sheet("Proposals")
    headers, _ = _get_all(ws)
    row_num = _find_row_num(ws, proposal_id)
    if not row_num:
        return {"error": "proposal_not_found"}

    rows = ws.get_all_values()
    rd = _row_to_dict(headers, rows[row_num - 1])

    # Статус должен позволять редактирование
    if rd.get("status") not in ("brief", "draft", "reviewed"):
        return {"error": "cannot_edit_in_this_status", "status": rd.get("status")}

    positions: list[dict] = rd.get("positions_json") or []

    # Найти или создать категорию
    cat = next((p for p in positions if p.get("category") == category), None)
    if cat is None:
        cat = {"category": category, "label": cat_label, "variants": [], "client_comment": ""}
        positions.append(cat)
    else:
        cat["label"] = cat_label  # обновляем label если изменился

    variant_id = str(variant_in.get("id") or _short_id())
    variant = {
        "id":              variant_id,
        "model":           str(variant_in.get("model", "") or "").strip(),
        "url":             str(variant_in.get("url", "") or "").strip(),
        "price":           variant_in.get("price", ""),
        "image_url":       str(variant_in.get("image_url", "") or "").strip(),
        "source":          str(variant_in.get("source", "") or "").strip(),
        "manager_comment": str(variant_in.get("manager_comment", "") or "").strip(),
        "client_vote":     None,
    }

    # Обновляем если уже есть, иначе добавляем
    existing_v = next((v for v in cat["variants"] if v.get("id") == variant_id), None)
    if existing_v:
        existing_v.update({k: v for k, v in variant.items() if k != "client_vote"})
    else:
        cat["variants"].append(variant)

    _update_fields(ws, row_num, headers, {
        "positions_json": json.dumps(positions, ensure_ascii=False),
        "status": "draft",
    })
    return {"ok": True, "variant_id": variant_id}


def handle_remove_variant(body: dict) -> dict:
    """Менеджер удаляет вариант или целую категорию."""
    tg_id, err = _auth(body)
    if err:
        return err
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "manager"):
        return {"error": "only_manager"}

    proposal_id = body.get("proposal_id", "")
    category    = body.get("category", "").strip()
    variant_id  = body.get("variant_id", "").strip()  # пусто = удалить всю категорию

    ensure_sheet()
    ws = sheets.sheet("Proposals")
    headers, _ = _get_all(ws)
    row_num = _find_row_num(ws, proposal_id)
    if not row_num:
        return {"error": "proposal_not_found"}

    rows = ws.get_all_values()
    rd = _row_to_dict(headers, rows[row_num - 1])
    positions: list[dict] = rd.get("positions_json") or []

    if variant_id:
        cat = next((p for p in positions if p.get("category") == category), None)
        if cat:
            cat["variants"] = [v for v in cat["variants"] if v.get("id") != variant_id]
            if not cat["variants"]:
                positions = [p for p in positions if p.get("category") != category]
    else:
        positions = [p for p in positions if p.get("category") != category]

    _update_field(ws, row_num, headers, "positions_json",
                  json.dumps(positions, ensure_ascii=False))
    return {"ok": True}


def handle_send(body: dict) -> dict:
    """Менеджер отправляет подборку клиенту. status → sent.
    Уведомляет клиента в бот."""
    tg_id, err = _auth(body)
    if err:
        return err
    user = sheets.find_user(tg_id)
    if not user or not sheets.has_role(user, "manager"):
        return {"error": "only_manager"}

    proposal_id = body.get("proposal_id", "")
    ensure_sheet()
    ws = sheets.sheet("Proposals")
    headers, _ = _get_all(ws)
    row_num = _find_row_num(ws, proposal_id)
    if not row_num:
        return {"error": "proposal_not_found"}

    rows = ws.get_all_values()
    rd = _row_to_dict(headers, rows[row_num - 1])
    positions: list[dict] = rd.get("positions_json") or []
    if not positions or not any(p.get("variants") for p in positions):
        return {"error": "no_variants_yet"}

    _update_fields(ws, row_num, headers, {"status": "sent", "sent_at": _now()})

    client_tg_id = rd.get("client_tg_id", "")
    manager_name = str(user.get("full_name", "") or "Менеджер")
    n_pos = len(positions)
    _tg_notify(client_tg_id,
        f"🛍 <b>{manager_name}</b> подобрал технику для вашей кухни!\n\n"
        f"В подборке {n_pos} {'категория' if n_pos == 1 else 'категории' if 2 <= n_pos <= 4 else 'категорий'}. "
        f"Откройте приложение, чтобы посмотреть варианты и выбрать подходящие.")

    return {"ok": True}


def handle_list(body: dict) -> dict:
    """Список proposals.
    Менеджер: все по своим клиентам.
    Клиент: только свои (по tg_id).
    """
    tg_id, err = _auth(body)
    if err:
        return err
    user = sheets.find_user(tg_id)
    is_manager = bool(user and sheets.has_role(user, "manager"))

    ensure_sheet()
    ws = sheets.sheet("Proposals")
    headers, all_dicts = _get_all(ws)

    out = []
    for d in all_dicts:
        if d.get("archived_at"):
            continue
        if is_manager:
            if str(d.get("manager_tg_id")) != tg_id:
                continue
        else:
            if str(d.get("client_tg_id")) != tg_id:
                continue
        # Краткая сводка без полного positions_json
        positions = d.get("positions_json") or []
        out.append({
            "id":           d.get("id"),
            "client_key":   d.get("client_key"),
            "client_tg_id": d.get("client_tg_id"),
            "status":       d.get("status"),
            "created_at":   d.get("created_at"),
            "sent_at":      d.get("sent_at"),
            "reviewed_at":  d.get("reviewed_at"),
            "brief":        d.get("brief_json") or {},
            "n_categories": len(positions),
            "n_variants":   sum(len(p.get("variants", [])) for p in positions),
        })

    out.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"ok": True, "proposals": out, "is_manager": is_manager}


def handle_detail(body: dict) -> dict:
    """Полная карточка proposal — доступна и менеджеру, и клиенту."""
    tg_id, err = _auth(body)
    if err:
        return err
    proposal_id = body.get("proposal_id", "")

    ensure_sheet()
    ws = sheets.sheet("Proposals")
    headers, all_dicts = _get_all(ws)
    d = next((x for x in all_dicts if x.get("id") == proposal_id), None)
    if not d:
        return {"error": "not_found"}

    user = sheets.find_user(tg_id)
    is_manager = bool(user and sheets.has_role(user, "manager"))
    # Клиент видит только своё
    if not is_manager and str(d.get("client_tg_id")) != tg_id:
        return {"error": "forbidden"}

    return {
        "ok": True,
        "proposal": {
            "id":              d.get("id"),
            "client_key":      d.get("client_key"),
            "client_tg_id":    d.get("client_tg_id"),
            "manager_tg_id":   d.get("manager_tg_id"),
            "status":          d.get("status"),
            "brief":           d.get("brief_json") or {},
            "positions":       d.get("positions_json") or [],
            "client_comment":  d.get("client_comment", ""),
            "manager_comment": d.get("manager_comment", ""),
            "created_at":      d.get("created_at"),
            "sent_at":         d.get("sent_at"),
            "reviewed_at":     d.get("reviewed_at"),
        },
        "is_manager": is_manager,
    }


def handle_vote(body: dict) -> dict:
    """Клиент голосует за вариант (✅ yes / ❌ no / null — снять голос).
    body: {proposal_id, category, variant_id, vote: 'yes'|'no'|null}
    """
    tg_id, err = _auth(body)
    if err:
        return err

    proposal_id = body.get("proposal_id", "")
    category    = body.get("category", "").strip()
    variant_id  = body.get("variant_id", "").strip()
    vote        = body.get("vote")  # 'yes' | 'no' | None

    if vote not in ("yes", "no", None):
        return {"error": "vote must be yes | no | null"}

    ensure_sheet()
    ws = sheets.sheet("Proposals")
    headers, _ = _get_all(ws)
    row_num = _find_row_num(ws, proposal_id)
    if not row_num:
        return {"error": "proposal_not_found"}

    rows = ws.get_all_values()
    rd = _row_to_dict(headers, rows[row_num - 1])

    # Клиент голосует только в своём
    if str(rd.get("client_tg_id")) != tg_id:
        return {"error": "forbidden"}
    if rd.get("status") not in ("sent", "reviewed"):
        return {"error": "voting_not_open"}

    positions: list[dict] = rd.get("positions_json") or []
    cat = next((p for p in positions if p.get("category") == category), None)
    if not cat:
        return {"error": "category_not_found"}
    variant = next((v for v in cat.get("variants", []) if v.get("id") == variant_id), None)
    if not variant:
        return {"error": "variant_not_found"}

    variant["client_vote"] = vote
    _update_field(ws, row_num, headers, "positions_json",
                  json.dumps(positions, ensure_ascii=False))
    return {"ok": True}


def handle_client_submit(body: dict) -> dict:
    """Клиент отправляет итоговый комментарий → status=reviewed.
    Уведомляет менеджера."""
    tg_id, err = _auth(body)
    if err:
        return err

    proposal_id = body.get("proposal_id", "")
    comment     = str(body.get("comment", "") or "").strip()

    ensure_sheet()
    ws = sheets.sheet("Proposals")
    headers, _ = _get_all(ws)
    row_num = _find_row_num(ws, proposal_id)
    if not row_num:
        return {"error": "proposal_not_found"}

    rows = ws.get_all_values()
    rd = _row_to_dict(headers, rows[row_num - 1])

    if str(rd.get("client_tg_id")) != tg_id:
        return {"error": "forbidden"}

    _update_fields(ws, row_num, headers, {
        "status":         "reviewed",
        "client_comment": comment,
        "reviewed_at":    _now(),
    })

    # Сводка голосов
    positions: list[dict] = rd.get("positions_json") or []
    vote_lines = []
    for cat in positions:
        for v in cat.get("variants", []):
            vote = v.get("client_vote")
            if vote == "yes":
                vote_lines.append(f"✅ {cat.get('label', cat.get('category'))}: {v.get('model', '—')}")
            elif vote == "no":
                vote_lines.append(f"❌ {cat.get('label', cat.get('category'))}: {v.get('model', '—')}")
    vote_text = "\n".join(vote_lines) if vote_lines else "Голосов нет"

    manager_tg_id = rd.get("manager_tg_id", "")
    client_key    = rd.get("client_key", "клиент")
    _tg_notify(manager_tg_id,
        f"📬 <b>{client_key.title()}</b> ответил на подборку техники:\n\n"
        f"{vote_text}"
        + (f"\n\n💬 Комментарий: {comment}" if comment else ""))

    return {"ok": True}
