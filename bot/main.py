import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import MenuButtonWebApp, WebAppInfo

from config import load_config
from handlers import start


async def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    config = load_config()
    bot = Bot(
        token=config.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()

    dp["config"] = config
    dp.include_router(start.router)

    if config.use_webhook:
        raise NotImplementedError("Webhook mode будет добавлен после MVP")

    # Универсальная меню-кнопка — открывает MiniApp одним тапом.
    # Внутри MiniApp пользователь выбирает роль (менеджер/клиент/сотрудник).
    try:
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(
                text="ЗОВ",
                web_app=WebAppInfo(url=config.miniapp_url),
            ),
        )
        logging.info("Установлена меню-кнопка MiniApp: %s", config.miniapp_url)
    except Exception as e:
        logging.warning("Не удалось установить меню-кнопку: %s", e)

    logging.info("Запуск в режиме polling")
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
