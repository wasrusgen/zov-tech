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


def _bust_cache(url: str) -> str:
    """Append unique timestamp to MiniApp URL so Telegram WebView can't cache between sessions."""
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}t={int(time.time())}"


def _with_query(url: str, **params: str) -> str:
    """Append query params (e.g. role=manager, go=podbor) preserving existing ones."""
    sep = "&" if "?" in url else "?"
    pairs = "&".join(f"{k}={v}" for k, v in params.items() if v)
    return f"{url}{sep}{pairs}" if pairs else url


def role_choice_kb(miniapp_url: str) -> InlineKeyboardMarkup:
    """Two WebApp buttons — one tap opens the cabinet directly, no intermediate step."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="👤 Менеджер",
                    web_app=WebAppInfo(url=_bust_cache(_with_query(miniapp_url, role="manager"))),
                ),
                InlineKeyboardButton(
                    text="🏠 Клиент",
                    web_app=WebAppInfo(url=_bust_cache(_with_query(miniapp_url, role="client"))),
                ),
            ]
        ]
    )


def manager_reply_kb(miniapp_url: str) -> ReplyKeyboardMarkup:
    """Persistent bottom keyboard — fast access to key MiniApp screens + info text actions.
    Reply-keyboard `web_app` buttons открывают MiniApp с указанным URL/query."""
    def wapp(go: str) -> WebAppInfo:
        return WebAppInfo(url=_bust_cache(_with_query(miniapp_url, role="manager", go=go)))

    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text="🤖 Подбор техники", web_app=wapp("podbor")),
                KeyboardButton(text="📐 Новый замер", web_app=wapp("measure")),
            ],
            [
                KeyboardButton(text="👥 Мои клиенты", web_app=wapp("clients")),
                KeyboardButton(
                    text="🏠 Кабинет",
                    web_app=WebAppInfo(url=_bust_cache(_with_query(miniapp_url, role="manager"))),
                ),
            ],
            [
                KeyboardButton(text="ℹ️ Что умеет бот?"),
                KeyboardButton(text="📞 Связь с куратором"),
            ],
            [
                KeyboardButton(text="📋 Чек-лист встречи"),
            ],
        ],
        resize_keyboard=True,
        is_persistent=True,
        input_field_placeholder="Выберите действие…",
    )


# ---------- /start ----------

@router.message(CommandStart())
async def cmd_start(message: Message, config: Config) -> None:
    # Сразу даём постоянную клавиатуру + inline-выбор роли. Менеджер будет
    # видеть нижнюю клавиатуру после первого тапа на роль.
    await message.answer(
        "👋 Здравствуйте, я бот-помощник от Руслана ВАСИЛЬЕВА.\n\n"
        "Кто вы?",
        reply_markup=role_choice_kb(config.miniapp_url),
    )
    # Постоянная клавиатура снизу — для быстрого доступа из любого экрана чата
    await message.answer(
        "📲 Внизу появилась панель быстрого доступа — открывайте кабинет или нужный экран одним тапом.",
        reply_markup=manager_reply_kb(config.miniapp_url),
    )


# ---------- /menu (вернуть клавиатуру если она была скрыта) ----------

@router.message(Command("menu"))
async def cmd_menu(message: Message, config: Config) -> None:
    await message.answer(
        "📲 Панель быстрого доступа:",
        reply_markup=manager_reply_kb(config.miniapp_url),
    )


# ---------- /hide (убрать клавиатуру) ----------

@router.message(Command("hide"))
async def cmd_hide(message: Message) -> None:
    await message.answer("Клавиатура скрыта. Вернуть — /menu", reply_markup=ReplyKeyboardRemove())


# ---------- Текстовые кнопки нижней клавиатуры ----------

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
async def kb_contact(message: Message) -> None:
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
