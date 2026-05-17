import asyncio
import logging
from datetime import datetime, timezone, timedelta

import httpx
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import MenuButtonWebApp, WebAppInfo

from config import load_config, Config
from handlers import start

log = logging.getLogger("zov.bot")

MSK = timezone(timedelta(hours=3))


def _years_word(n: int) -> str:
    """Правильное склонение: год / года / лет."""
    if n % 100 in (11, 12, 13, 14):
        return "лет"
    if n % 10 == 1:
        return "год"
    if n % 10 in (2, 3, 4):
        return "года"
    return "лет"


async def _send_anniversary_reminders(bot: Bot, config: Config) -> None:
    """Вызывает /api/daily_reminders и рассылает уведомления менеджерам."""
    if not config.internal_secret:
        log.warning("INTERNAL_SECRET не задан — рассылка годовщин пропущена")
        return

    url = f"{config.backend_url}/api/daily_reminders"
    headers = {"Authorization": f"Bearer {config.internal_secret}"}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        log.error("Ошибка запроса к /api/daily_reminders: %s", e)
        return

    reminders = data.get("reminders", [])
    log.info("Годовщины договоров: %d записей на %s", len(reminders), data.get("date", "?"))

    for r in reminders:
        manager_tg_id = r.get("manager_tg_id", "")
        client_name = r.get("client_name", "Клиент")
        years: int = r.get("years", 1)
        contract_date_raw = r.get("contract_date", "")

        # Форматируем дату для отображения
        date_str = contract_date_raw
        for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
            try:
                date_str = datetime.strptime(contract_date_raw[:10], fmt).strftime("%d.%m.%Y")
                break
            except ValueError:
                continue

        word = _years_word(years)
        text = (
            f"📋 <b>Годовщина договора!</b>\n\n"
            f"Сегодня ровно <b>{years} {word}</b> как вы подписали договор "
            f"с <b>{client_name}</b>.\n"
            f"📅 Дата договора: {date_str}\n\n"
            f"Отличный повод напомнить о себе и предложить новые услуги 💼"
        )

        try:
            await bot.send_message(chat_id=int(manager_tg_id), text=text)
            log.info("Годовщина отправлена менеджеру %s (клиент: %s, лет: %d)",
                     manager_tg_id, client_name, years)
        except Exception as e:
            log.warning("Не удалось отправить уведомление менеджеру %s: %s", manager_tg_id, e)


async def _anniversary_scheduler(bot: Bot, config: Config) -> None:
    """Фоновая задача: каждый день в 09:00 МСК рассылает годовщины договоров."""
    while True:
        now = datetime.now(MSK)
        next_run = now.replace(hour=9, minute=0, second=0, microsecond=0)
        if now >= next_run:
            next_run += timedelta(days=1)
        delay = (next_run - now).total_seconds()
        log.info(
            "Планировщик годовщин: следующий запуск через %.0f сек (%s МСК)",
            delay, next_run.strftime("%d.%m %H:%M"),
        )
        await asyncio.sleep(delay)

        await _send_anniversary_reminders(bot, config)

        # Короткая пауза чтобы не сработало дважды при граничном времени
        await asyncio.sleep(60)


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
    # role=manager — пропускает экран выбора роли, сразу кабинет менеджера.
    try:
        sep = "&" if "?" in config.miniapp_url else "?"
        menu_url = f"{config.miniapp_url}{sep}role=manager"
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(
                text="CRM",
                web_app=WebAppInfo(url=menu_url),
            ),
        )
        logging.info("Установлена меню-кнопка MiniApp: %s", menu_url)
    except Exception as e:
        logging.warning("Не удалось установить меню-кнопку: %s", e)

    logging.info("Запуск в режиме polling")
    await bot.delete_webhook(drop_pending_updates=True)

    # Запускаем фоновый планировщик годовщин
    asyncio.create_task(_anniversary_scheduler(bot, config))
    logging.info("Планировщик годовщин запущен (09:00 МСК ежедневно)")

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
