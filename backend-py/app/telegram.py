"""Тонкая обёртка над Telegram Bot API для отправки уведомлений из backend."""
from __future__ import annotations
import httpx

from .config import get_config


def send_message(chat_id: int | str, text: str, **kwargs) -> bool:
    """Отправляет сообщение пользователю/чату. Возвращает True при успехе."""
    cfg = get_config()
    if not cfg.bot_token or not chat_id:
        return False
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    payload.update(kwargs)
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                f"https://api.telegram.org/bot{cfg.bot_token}/sendMessage",
                json=payload,
            )
        return 200 <= resp.status_code < 300
    except Exception:
        return False
