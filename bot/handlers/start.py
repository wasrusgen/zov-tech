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
    """Append unique timestamp to MiniApp URL so Telegram WebView can't cache between sessions."""
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}t={int(time.time())}"


def _with_query(url: str, **params: str) -> str:
    """Append query params (e.g. role=manager, go=podbor) preserving existing ones."""
    sep = "&" if "?" in url else "?"
    pairs = "&".join(f"{k}={v}" for k, v in params.items() if v)
    return f"{url}{sep}{pairs}" if pairs else url


def _wapp(miniapp_url: str, role: str, go: str = "") -> WebAppInfo:
    """Build a WebAppInfo with role + optional ?go=<screen>."""
    return WebAppInfo(url=_bust_cache(_with_query(miniapp_url, role=role, go=go)))


# ============================================================
# Reply keyboards (3 уровня)
# ============================================================

# Уровень 1 — выбор роли (плоские текстовые кнопки внизу)
def role_choice_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text="👤 Я менеджер"),
                KeyboardButton(text="🏠 Я клиент"),
            ],
        ],
        resize_keyboard=True,
        is_persistent=True,
        input_field_placeholder="Выберите кто вы…",
    )


# Уровень 2a — меню менеджера (WebApp + текст)
def manager_kb(miniapp_url: str) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text="🤖 Подбор техники", web_app=_wapp(miniapp_url, "manager", "podbor")),
                KeyboardButton(text="📐 Новый замер",   web_app=_wapp(miniapp_url, "manager", "measure")),
            ],
            [
                KeyboardButton(text="👥 Мои клиенты",   web_app=_wapp(miniapp_url, "manager", "clients")),
                KeyboardButton(text="🏠 Кабинет",        web_app=_wapp(miniapp_url, "manager")),
            ],
            [
                KeyboardButton(text="ℹ️ Что умеет бот?"),
                KeyboardButton(text="📞 Связь с куратором"),
            ],
            [
                KeyboardButton(text="📋 Чек-лист встречи"),
                KeyboardButton(text="⬅️ Сменить роль"),
            ],
        ],
        resize_keyboard=True,
        is_persistent=True,
        input_field_placeholder="Выберите действие…",
    )


# Уровень 2b — меню клиента (WebApp + текст)
def client_kb(miniapp_url: str) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text="🏠 Мой кабинет",    web_app=_wapp(miniapp_url, "client")),
                KeyboardButton(text="📐 Мой замер",      web_app=_wapp(miniapp_url, "client", "measure")),
            ],
            [
                KeyboardButton(text="📞 Связь с менеджером"),
                KeyboardButton(text="ℹ️ О сервисе"),
            ],
            [
                KeyboardButton(text="⬅️ Сменить роль"),
            ],
        ],
        resize_keyboard=True,
        is_persistent=True,
        input_field_placeholder="Выберите действие…",
    )


# ============================================================
# Commands
# ============================================================

@router.message(CommandStart())
async def cmd_start(message: Message, config: Config) -> None:
    await message.answer(
        "👋 Здравствуйте, я бот-помощник от Руслана ВАСИЛЬЕВА.\n\n"
        "Выберите, кто вы — внизу появилась панель.",
        reply_markup=role_choice_kb(),
    )


@router.message(Command("menu"))
async def cmd_menu(message: Message) -> None:
    """Возвращает к выбору роли."""
    await message.answer("Выберите роль:", reply_markup=role_choice_kb())


@router.message(Command("hide"))
async def cmd_hide(message: Message) -> None:
    await message.answer("Клавиатура скрыта. Вернуть — /menu", reply_markup=ReplyKeyboardRemove())


# ============================================================
# Уровень 1 → 2: выбор роли
# ============================================================

@router.message(F.text == "👤 Я менеджер")
async def role_manager(message: Message, config: Config) -> None:
    await message.answer(
        "<b>Меню менеджера</b>\n\n"
        "Выбирайте действие — большинство кнопок открывают кабинет на нужном экране одним тапом.",
        reply_markup=manager_kb(config.miniapp_url),
    )


@router.message(F.text == "🏠 Я клиент")
async def role_client(message: Message, config: Config) -> None:
    await message.answer(
        "<b>Меню клиента</b>\n\n"
        "Здесь видны ваш замер и личный кабинет от менеджера ЗОВ.",
        reply_markup=client_kb(config.miniapp_url),
    )


@router.message(F.text == "⬅️ Сменить роль")
async def back_to_role(message: Message) -> None:
    await message.answer("Выберите роль:", reply_markup=role_choice_kb())


# ============================================================
# Текстовые кнопки меню менеджера
# ============================================================

@router.message(F.text == "ℹ️ Что умеет бот?")
async def kb_about(message: Message) -> None:
    await message.answer(
        "<b>ZOV Tech Picker — что умеет бот:</b>\n\n"
        "🤖 <b>Подбор техники</b> — AI собирает 3-7 моделей под клиента, "
        "со сравнением цен на 4 маркетплейсах, плюсами/минусами и ссылками\n\n"
        "📐 <b>Замеры кухни</b> — мастер из 6 шагов: форма, размеры, окна/двери, фото, "
        "сохраняется в карточку клиента\n\n"
        "👥 <b>Клиенты</b> — история подборов и замеров по каждому клиенту, "
        "с возможностью переоткрыть отчёт или скачать PDF\n\n"
        "🏠 <b>Кабинет</b> — главный экран менеджера с задачами на сегодня\n\n"
        "<i>Подсказка: внизу постоянная панель — открывает нужный экран одним тапом.</i>"
    )


@router.message(F.text == "📞 Связь с куратором")
async def kb_contact_curator(message: Message) -> None:
    await message.answer(
        "<b>Куратор сети:</b>\n\n"
        "👤 Руслан Васильев\n"
        "Telegram: @wasrusgen\n"
        "Канал партнёрской сети: @wasrusgen1\n\n"
        "Пишите по любым вопросам — от подключения к боту до сложных подборов техники."
    )


@router.message(F.text == "📋 Чек-лист встречи")
async def kb_checklist(message: Message) -> None:
    await message.answer(
        "<b>📋 Чек-лист встречи с клиентом</b>\n\n"
        "<b>До встречи:</b>\n"
        "• Получить контакт и согласовать время\n"
        "• Уточнить — новая кухня или замена техники\n"
        "• Понять бюджет (премиум / средний / эконом)\n\n"
        "<b>На встрече:</b>\n"
        "1. Замер кухни (📐 Новый замер в боте)\n"
        "   — стены, потолок, площадь\n"
        "   — окна, двери, вытяжка, газ/электро\n"
        "   — 5-10 фото со всех углов\n\n"
        "2. Образ жизни клиента (что готовит, как часто)\n"
        "3. Категории техники нужны (холодильник / варочная / духовка / посудомойка / вытяжка / СВЧ / кофемашина)\n"
        "4. Запустить 🤖 Подбор техники — получить 3-7 моделей за 30 сек\n\n"
        "<b>После встречи:</b>\n"
        "• Скачать PDF подбора → отправить клиенту\n"
        "• Поставить замер и подбор в карточку клиента\n"
        "• Следующий шаг: дизайн-проект кухни ЗОВ"
    )


# ============================================================
# Текстовые кнопки меню клиента
# ============================================================

@router.message(F.text == "📞 Связь с менеджером")
async def kb_contact_manager(message: Message) -> None:
    await message.answer(
        "<b>Ваш менеджер ЗОВ:</b>\n\n"
        "Связаться с менеджером можно через ваш кабинет — там указаны контакты "
        "сотрудника, который ведёт ваш проект.\n\n"
        "Если кабинет ещё не открывался — попросите менеджера прислать "
        "приглашение или напишите куратору сети @wasrusgen."
    )


@router.message(F.text == "ℹ️ О сервисе")
async def kb_about_service(message: Message) -> None:
    await message.answer(
        "<b>О сервисе ЗОВ</b>\n\n"
        "ЗОВ — фабрика кухонной мебели премиум-сегмента из Беларуси.\n\n"
        "Этот бот помогает менеджерам ЗОВ:\n"
        "• сделать замер вашей кухни\n"
        "• подобрать встраиваемую технику под ваш бюджет и образ жизни\n"
        "• сохранить всё в одном кабинете для совместной работы\n\n"
        "🌐 zov.by · 📍 СПб / Москва · 💬 @wasrusgen1"
    )
