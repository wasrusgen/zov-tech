import time

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
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
# Inline keyboard — выбор роли прямо в сообщении /start.
# На Telegram Desktop side-panel reply-keyboard НЕ передаёт initData.
# Inline-кнопки открываются в МОДАЛЬНОМ режиме где initData валидно.
# ============================================================

def role_choice_inline(miniapp_url: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="👤 Я менеджер", web_app=_wapp(miniapp_url, "manager")),
                InlineKeyboardButton(text="🏠 Я клиент",   web_app=_wapp(miniapp_url, "client")),
            ],
            [
                InlineKeyboardButton(text="🔧 Я сотрудник", web_app=_wapp(miniapp_url, "staff")),
            ],
        ]
    )


# ============================================================
# Reply keyboard — постоянная панель снизу (для мобильных).
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
    # Сначала отправляем reply-keyboard (постоянная панель снизу для мобильных)
    await message.answer(
        "👋 Здравствуйте, я бот-помощник от Руслана ВАСИЛЬЕВА.",
        reply_markup=role_choice_kb(config.miniapp_url),
    )
    # Затем inline-keyboard внутри отдельного сообщения — кнопки тут открывают MiniApp
    # в МОДАЛЬНОМ режиме (важно для Telegram Desktop)
    await message.answer(
        "Выберите, кто вы — кабинет откроется одним тапом.\n\n"
        "<i>«Сотрудник» — для замерщиков и сборщиков ЗОВ.</i>",
        reply_markup=role_choice_inline(config.miniapp_url),
    )


@router.message(Command("menu"))
async def cmd_menu(message: Message, config: Config) -> None:
    await message.answer(
        "Выберите роль:",
        reply_markup=role_choice_inline(config.miniapp_url),
    )
    await message.answer(
        "Или используйте панель снизу.",
        reply_markup=role_choice_kb(config.miniapp_url),
    )


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
