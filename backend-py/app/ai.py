"""GigaChat client — OAuth + chat completions."""
from __future__ import annotations
import json
import re
import threading
import time
import uuid
from typing import Any
import httpx

from .config import get_config

_AUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
_CHAT_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"

_lock = threading.Lock()
_token: str | None = None
_token_expires_at: float = 0.0


def _get_token() -> str:
    global _token, _token_expires_at
    with _lock:
        # 5-минутный запас перед истечением
        if _token and time.time() < _token_expires_at - 300:
            return _token

        cfg = get_config()
        rq_uid = str(uuid.uuid4())
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                _AUTH_URL,
                headers={
                    "Authorization": f"Basic {cfg.gigachat_auth_key}",
                    "RqUID": rq_uid,
                    "Accept": "application/json",
                },
                data={"scope": cfg.gigachat_scope},
            )
        resp.raise_for_status()
        data = resp.json()
        _token = data.get("access_token") or data.get("tok")
        if not _token:
            raise RuntimeError(f"No access_token in GigaChat response: {data}")
        # expires_at в миллисекундах unix
        expires_at_ms = data.get("expires_at") or data.get("exp") or 0
        _token_expires_at = (expires_at_ms / 1000) if expires_at_ms else (time.time() + 1500)
        return _token


SYSTEM_PROMPT_PICKER = (
    "Ты — эксперт-консультант по подбору кухонной техники для фабрики мебели «ЗОВ».\n"
    "Помогаешь менеджерам салонов согласовать с клиентом комплект техники.\n\n"
    "Принципы подбора:\n"
    "1. Уважай ценовой коридор. У каждой категории `price_ranges.{cat}.from..to` — попадай в него (±5%).\n"
    "2. Уважай предпочтения по брендам: сначала preferred (★), потом acceptable (✓).\n"
    "3. Учитывай инфраструктуру: газ исключает индукцию; нет вентиляции = только рециркуляция (угольный фильтр).\n"
    "4. Учитывай приоритеты выбора (`priorities`): «цена/качество» → балансные модели; «отзывы» → проверенные хиты; «дизайн» → подбирай эстетику; «технологичность» → топовые фичи.\n"
    "5. Если клиент явно отметил features в `per_cat.{cat}.features` — обязательно ставь модели с этими фичами.\n"
    "6. ВАЖНО: каждую тех. фичу в highlights ОБЯЗАТЕЛЬНО объясняй простым языком в скобках.\n\n"
    "Примеры пояснений:\n"
    "  «NoFrost (не нужно размораживать вручную)»\n"
    "  «PowerBoost (форсаж — кипятит за минуту)»\n"
    "  «FlexZone (объединяет зоны под большую сковороду)»\n"
    "  «4D HotAir (конвекция с 4 сторон — равномерное запекание)»\n"
    "  «Термощуп (готовит до точной температуры)»\n"
    "  «AquaStop (защита от протечек)»\n"
    "  «Инвертор (тише и экономия ~30% электричества)»\n\n"
    "Формат ответа — валидный JSON без markdown:\n"
    "{\n"
    '  "summary": "1-2 предложения общего вывода",\n'
    '  "items": [{\n'
    '    "category": "fridge",\n'
    '    "brand": "Bosch",\n'
    '    "model": "Serie 4 60см",\n'
    '    "price_rub": 79990,\n'
    '    "highlights": ["NoFrost (не нужно размораживать)", "Инвертор (тише и экономия ~30%)"],\n'
    '    "caveats": "Глубина 660мм — на 60мм больше стандартной ниши",\n'
    '    "match_score": 0.92,\n'
    '    "tier_signal": "middle"\n'
    "  }],\n"
    '  "total_price_rub": 350000,\n'
    '  "budget_status": "в_рамках|превышение|значительно_ниже",\n'
    '  "client_temperature": "premium|middle|budget|mixed",\n'
    '  "warnings": [],\n'
    '  "next_steps": []\n'
    "}\n\n"
    "Не выдумывай несуществующие артикулы — указывай линейку (Bosch Serie 4 60см)."
)


def call_ai(user_prompt: str, system_prompt: str | None = None,
            temperature: float = 0.3, max_tokens: int = 4000) -> dict[str, Any]:
    """Вызов GigaChat. Возвращает {json, text, tokens, model, error?}."""
    cfg = get_config()
    try:
        token = _get_token()
    except Exception as e:
        return {"json": None, "text": f"AI auth: {e}", "tokens": 0, "model": cfg.gigachat_model, "error": True}

    payload = {
        "model": cfg.gigachat_model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system_prompt or SYSTEM_PROMPT_PICKER},
            {"role": "user", "content": user_prompt},
        ],
    }

    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(
                _CHAT_URL,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                content=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            )
    except Exception as e:
        return {"json": None, "text": f"AI network: {e}", "tokens": 0, "model": cfg.gigachat_model, "error": True}

    if resp.status_code >= 400:
        try:
            j = resp.json()
            err_msg = j.get("message") or (j.get("error") or {}).get("message") or resp.text[:300]
        except Exception:
            err_msg = resp.text[:300]
        return {"json": None, "text": f"AI HTTP {resp.status_code}: {err_msg}",
                "tokens": 0, "model": cfg.gigachat_model, "error": True}

    data = resp.json()
    choice = (data.get("choices") or [{}])[0]
    response_text = (choice.get("message") or {}).get("content", "")
    tokens = (data.get("usage") or {}).get("total_tokens", 0)
    actual_model = data.get("model", cfg.gigachat_model)

    json_obj = None
    if response_text:
        try:
            json_obj = json.loads(response_text)
        except json.JSONDecodeError:
            stripped = re.sub(r"^```(?:json)?\s*", "", response_text.strip())
            stripped = re.sub(r"\s*```\s*$", "", stripped)
            try:
                json_obj = json.loads(stripped)
            except json.JSONDecodeError:
                pass

    return {"json": json_obj, "text": response_text, "tokens": tokens, "model": actual_model}
