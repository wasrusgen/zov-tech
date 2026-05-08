from dataclasses import dataclass
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")


@dataclass(frozen=True)
class Config:
    bot_token: str
    admin_tg_id: int
    anthropic_api_key: str
    anthropic_model: str
    sheet_id: str
    google_credentials_path: str
    miniapp_url: str
    webhook_url: str
    webhook_host: str
    webhook_port: int
    webhook_path: str
    active_period_days: int
    grace_period_days: int

    @property
    def use_webhook(self) -> bool:
        return bool(self.webhook_url)


def _required(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise RuntimeError(f"Не задана обязательная переменная окружения: {key}")
    return val


def load_config() -> Config:
    return Config(
        bot_token=_required("BOT_TOKEN"),
        admin_tg_id=int(_required("ADMIN_TG_ID")),
        # Опциональны на MVP-этапе. Сервисы, которые их используют, проверят сами при инициализации.
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
        anthropic_model=os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001"),
        sheet_id=os.getenv("SHEET_ID", ""),
        google_credentials_path=os.getenv("GOOGLE_CREDENTIALS_PATH", "./credentials.json"),
        miniapp_url=os.getenv("MINIAPP_URL", "https://example.github.io/zov-tech/"),
        webhook_url=os.getenv("WEBHOOK_URL", ""),
        webhook_host=os.getenv("WEBHOOK_HOST", "0.0.0.0"),
        webhook_port=int(os.getenv("WEBHOOK_PORT", "8080")),
        webhook_path=os.getenv("WEBHOOK_PATH", "/tg/webhook"),
        active_period_days=int(os.getenv("ACTIVE_PERIOD_DAYS", "90")),
        grace_period_days=int(os.getenv("GRACE_PERIOD_DAYS", "14")),
    )
