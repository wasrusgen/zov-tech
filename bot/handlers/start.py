import time

from aiogram import Router
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    ReplyKeyboardRemove,
    WebAppInfo,
)

from config import Config

router = Router(name="start")


# ============================================================
# URL helpers
# ============================================================

def _bust_cache(url: str) -> str:
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}t={int(time.time())}"


def _with_query(url: str, **params: str) -> str:
    sep = "&" if "?" in url else "?"
    pairs = "&".join(f"{k}={v}" for k, v in params.items() if v)
    return f"{url}{sep}{pairs}" if pairs else url


def _wapp(miniapp_url: str, role: str) -> WebAppInfo:
    return WebAppInfo(url=_bust_cache(_with_query(miniapp_url, role=role)))


# ============================================================
# Inline keyboard — единственный способ открыть MiniApp.
# Reply-кнопки с web_app не передают initData ни на Desktop side-panel,
# ни на мобильных. Inline-buttons открывают MiniApp в modal-режиме,
# где initData валидно передаётся на обеих платформах.
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
# Commands
# ============================================================

@router.message(CommandStart())
async def cmd_start(message: Message, config: Config) -> None:
    await message.answer(
        "👋 Здравствуйте, Добрый человек 🙂\n\n"
        "Я CRM <b>@wasrusgen1</b>!\n\n"
        "Вы кто?",
        reply_markup=role_choice_inline(config.miniapp_url),
    )


@router.message(Command("menu"))
async def cmd_menu(message: Message, config: Config) -> None:
    await message.answer(
        "Выберите роль:",
        reply_markup=role_choice_inline(config.miniapp_url),
    )


@router.message(Command("hide"))
async def cmd_hide(message: Message) -> None:
    await message.answer(
        "Нижняя клавиатура убрана. Для выбора роли — /menu",
        reply_markup=ReplyKeyboardRemove(),
    )


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
