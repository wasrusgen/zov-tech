"""Telegram WebApp initData verification (HMAC-SHA-256)."""
from __future__ import annotations
import hmac
import hashlib
import json
import time
from typing import Any
from urllib.parse import parse_qsl


def verify_init_data(init_data: str, bot_token: str, max_age_sec: int = 86400) -> dict[str, Any] | None:
    """
    Проверяет подпись initData от Telegram WebApp.
    Возвращает распарсенные данные с ключом 'user' (dict) или None при невалидной/просроченной подписи.

    Спецификация: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    """
    if not init_data:
        return None
    parsed = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = parsed.pop("hash", None)
    if not received_hash:
        return None

    # data_check_string: ключ=значение, отсортированы алфавитно, разделитель \n
    data_check_string = "\n".join(f"{k}={parsed[k]}" for k in sorted(parsed))

    # secret_key = HMAC-SHA-256(key="WebAppData", data=BOT_TOKEN)
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_hash, received_hash):
        return None

    # Свежесть подписи (24 часа по умолчанию)
    auth_date = int(parsed.get("auth_date", "0"))
    if time.time() - auth_date > max_age_sec:
        return None

    user = None
    if "user" in parsed:
        try:
            user = json.loads(parsed["user"])
        except json.JSONDecodeError:
            user = None

    return {
        "user": user,
        "auth_date": auth_date,
        "start_param": parsed.get("start_param"),
        "chat_instance": parsed.get("chat_instance"),
    }
