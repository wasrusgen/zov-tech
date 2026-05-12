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
# Reply keyboard — выбор роли. Три кнопки, все WebApp.
# ============================================================

def role_choice_kb(miniapp_url: str) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text="👤 Я менеджер", web_app=_wapp(miniapp_url, "manager")),
                KeyboardButton(text="🏠 Я клиент",   web_app=_wapp(miniapp_url, "client")),
            ],
            [
                KeyboardButton(text="🔧 Я сотрудник", web_app=_wapp(miniapp_url, "staff")),
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
        "Выберите, кто вы — кабинет откроется одним тапом.\n\n"
        "<i>«Сотрудник» — для замерщиков и сборщиков ЗОВ. Если вы менеджер или клиент — выбирайте свою роль.</i>",
        reply_markup=role_choice_kb(config.miniapp_url),
    )


@router.message(Command("menu"))
async def cmd_menu(message: Message, config: Config) -> None:
    await message.answer("Выберите роль:", reply_markup=role_choice_kb(config.miniapp_url))


@router.message(Command("hide"))
async def cmd_hide(message: Message) -> None:
    await message.answer("Клавиатура скрыта. Вернуть — /menu", reply_markup=ReplyKeyboardRemove())


# ============================================================
# /whoami — сотрудник присылает свой ID куратору, чтобы тот выдал роль
# ============================================================

@router.message(Command("whoami"))
async def cmd_whoami(message: Message) -> None:
    user = message.from_user
    if not user:
        return
    await message.answer(
        f"<b>Ваш Telegram ID:</b> <code>{user.id}</code>\n"
        f"Username: @{user.username or '—'}\n"
        f"Имя: {user.first_name or ''} {user.last_name or ''}".strip()
        + "\n\n"
        "<i>Перешлите это сообщение куратору @wasrusgen чтобы вам выдали роль замерщика/сборщика.</i>"
    )
