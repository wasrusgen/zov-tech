from aiogram import Router, F
from aiogram.filters import CommandStart
from aiogram.types import (
    Message,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
    CallbackQuery,
)

from config import Config

router = Router(name="start")


def role_choice_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="👤 Менеджер", callback_data="role:manager"),
                InlineKeyboardButton(text="🏠 Клиент", callback_data="role:client"),
            ]
        ]
    )


def open_app_kb(miniapp_url: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🚀 Открыть кабинет",
                    web_app=WebAppInfo(url=miniapp_url),
                )
            ]
        ]
    )


@router.message(CommandStart())
async def cmd_start(message: Message, config: Config) -> None:
    # TODO: проверить, есть ли пользователь в БД (Google Sheet → users).
    # Если есть → сразу показывать "Открыть кабинет".
    # Если нет → спрашивать роль.
    await message.answer(
        "👋 Здравствуйте, я бот-помощник от Руслана ВАСИЛЬЕВА.\n\n"
        "Кто вы?",
        reply_markup=role_choice_kb(),
    )


@router.callback_query(F.data.startswith("role:"))
async def on_role_chosen(callback: CallbackQuery, config: Config) -> None:
    role = callback.data.split(":", 1)[1]
    # TODO: сохранить роль в БД (Google Sheet → users)

    text = {
        "manager": "Отлично, открываю кабинет менеджера 👇",
        "client": "Спасибо! Открываю ваш кабинет 👇",
    }.get(role, "Открываю кабинет 👇")

    await callback.message.edit_text(text, reply_markup=open_app_kb(config.miniapp_url))
    await callback.answer()
