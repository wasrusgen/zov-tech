"""Конфиг бэкенда — читается из переменных окружения."""
from __future__ import annotations
import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Config:
    bot_token: str
    admin_tg_id: int
    sheet_id: str
    google_credentials_path: str

    gigachat_auth_key: str
    gigachat_model: str
    gigachat_scope: str

    active_period_days: int
    grace_period_days: int

    proxy6_token: str  # пусто = без прокси (прямой HTTP)


def _required(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise RuntimeError(f"Missing required env var: {name}")
    return val


@lru_cache(maxsize=1)
def get_config() -> Config:
    return Config(
        bot_token=_required("BOT_TOKEN"),
        admin_tg_id=int(os.getenv("ADMIN_TG_ID", "0")),
        sheet_id=_required("SHEET_ID"),
        google_credentials_path=os.getenv("GOOGLE_CREDENTIALS_PATH", "/app/credentials.json"),
        gigachat_auth_key=_required("GIGACHAT_AUTH_KEY"),
        gigachat_model=os.getenv("GIGACHAT_MODEL", "GigaChat-Pro"),
        gigachat_scope=os.getenv("GIGACHAT_SCOPE", "GIGACHAT_API_PERS"),
        active_period_days=int(os.getenv("ACTIVE_PERIOD_DAYS", "90")),
        grace_period_days=int(os.getenv("GRACE_PERIOD_DAYS", "14")),
        proxy6_token=os.getenv("PROXY6_TOKEN", ""),
    )
