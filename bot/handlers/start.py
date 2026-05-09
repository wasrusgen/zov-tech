import time

from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.types import (
    Message,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
)

from config import Config

router = Router(name="start")


def _bust_cache(url: str) -> str:
    """Append unique timestamp to MiniApp URL so Telegram WebView can't cache between sessions."""
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}t={int(time.time())}"


def role_choice_kb(miniapp_url: str) -> InlineKeyboardMarkup:
    """Two WebApp buttons — one tap opens the cabinet directly, no intermediate step."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="👤 Менеджер",
                    web_app=WebAppInfo(url=_bust_cache(f"{miniapp_url}?role=manager")),
                ),
                InlineKeyboardButton(
                    text="🏠 Клиент",
                    web_app=WebAppInfo(url=_bust_cache(f"{miniapp_url}?role=client")),
                ),
            ]
        ]
    )


@router.message(CommandStart())
async def cmd_start(message: Message, config: Config) -> None:
    await message.answer(
        "👋 Здравствуйте, я бот-помощник от Руслана ВАСИЛЬЕВА.\n\n"
        "Кто вы?",
        reply_markup=role_choice_kb(config.miniapp_url),
    )
