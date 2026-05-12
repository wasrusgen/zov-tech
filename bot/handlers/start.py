import time

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    KeyboardButton,
    Message,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
    WebAppInfo,
)

from config import Config

router = Router(name="start")


# ============================================================
# URL helpers
# ============================================================

def _bust_cache(url: str) -> str:
    """Append unique timestamp so Telegram WebView не кеширует между сессиями."""
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}t={int(time.time())}"


def _with_query(url: str, **params: str) -> str:
    sep = "&" if "?" in url else "?"
    pairs = "&".join(f"{k}={v}" for k, v in params.items() if v)
    return f"{url}{sep}{pairs}" if pairs else url


def _wapp(miniapp_url: str, role: str) -> WebAppInfo:
    return WebAppInfo(url=_bust_cache(_with_query(miniapp_url, role=role)))


# ============================================================
# Reply keyboard — выбор роли. Оба кнопки сразу открывают MiniApp.
# ============================================================

def role_choice_kb(miniapp_url: str) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text="👤 Я менеджер", web_app=_wapp(miniapp_url, "manager")),
                KeyboardButton(text="🏠 Я клиент",   web_app=_wapp(miniapp_url, "client")),
            ],
        ],
        resize_keyboard=True,
        is_persistent=True,
        input_field_placeholder="Выберите кто вы…",
    )


# ============================================================
# Commands
# ============================================================

@router.message(CommandStart())
async def cmd_start(message: Message, config: Config) -> None:
    await message.answer(
        "👋 Здравствуйте, я бот-помощник от Руслана ВАСИЛЬЕВА.\n\n"
        "Выберите, кто вы — кабинет откроется одним тапом.",
        reply_markup=role_choice_kb(config.miniapp_url),
    )


@router.message(Command("menu"))
async def cmd_menu(message: Message, config: Config) -> None:
    await message.answer("Выберите роль:", reply_markup=role_choice_kb(config.miniapp_url))


@router.message(Command("hide"))
async def cmd_hide(message: Message) -> None:
    await message.answer("Клавиатура скрыта. Вернуть — /menu", reply_markup=ReplyKeyboardRemove())
