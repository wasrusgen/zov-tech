"""Заводим тестовых клиентов с замерами в разных статусах
для проверки кабинета менеджера. Запускать раз — потом руками
почистить строки в Google Sheets если не нужно.
"""
from datetime import datetime, timedelta, timezone
from app import sheets
from app.main import _short_id, _row_for_measurement, _ensure_measurements_sheet


MGR_TG_ID = 5937498515  # Руслан (он же замерщик)


def iso(dt):
    return dt.astimezone(timezone.utc).isoformat()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def main():
    _ensure_measurements_sheet()

    now = datetime.now().astimezone()
    today_15 = now.replace(hour=15, minute=0, second=0, microsecond=0)
    yesterday_11 = (now - timedelta(days=1)).replace(hour=11, minute=0, second=0, microsecond=0)
    tomorrow_11 = (now + timedelta(days=1)).replace(hour=11, minute=0, second=0, microsecond=0)

    cases = [
        # 1. Сегодня в 15:00 — HERO на главной
        {
            "client_name": "Иванова Анна Сергеевна",
            "client_phone": "+7 921 555-12-34",
            "address": "СПб, Просвещения 87, кв. 12",
            "status": "scheduled",
            "scheduled_at": iso(today_15),
            "preferred_note": "после звонка обязательно",
            "zamer_no": "9001",
        },
        # 2. Просрочка — вчера 11:00, не выполнено
        {
            "client_name": "Петров Игорь Васильевич",
            "client_phone": "+7 905 111-22-33",
            "address": "СПб, Невский пр 100, кв. 5",
            "status": "scheduled",
            "scheduled_at": iso(yesterday_11),
            "preferred_note": "",
            "zamer_no": "9002",
        },
        # 3. Заявка без даты — нужно созвониться
        {
            "client_name": "Сидорова Елена Михайловна",
            "client_phone": "+7 812 444-55-66",
            "address": "СПб, Литейный пр 50, кв. 28",
            "status": "requested",
            "scheduled_at": "",
            "preferred_note": "эта неделя, удобно вечером",
            "zamer_no": "9003",
        },
        # 4. Завтра — план на завтра
        {
            "client_name": "Кузнецов Александр Петрович",
            "client_phone": "+7 911 777-88-99",
            "address": "СПб, Просвещения 30, кв. 41",
            "status": "scheduled",
            "scheduled_at": iso(tomorrow_11),
            "preferred_note": "узкий проезд от шоссе, лучше с утра",
            "zamer_no": "9004",
        },
    ]

    created = []
    for c in cases:
        mid = _short_id()
        sheets.append_named_row("Measurements", _row_for_measurement(
            mid, now_iso(),
            manager_tg_id=str(MGR_TG_ID),
            assigned_to_tg_id=str(MGR_TG_ID),  # назначен на себя
            requested_by_tg_id=str(MGR_TG_ID),
            filled_by="request",
            status=c["status"],
            scheduled_at=c["scheduled_at"],
            address=c["address"],
            client_name=c["client_name"],
            client_phone=c["client_phone"],
            preferred_note=c["preferred_note"],
            preferred_type="tbd",
            zamer_no=c["zamer_no"],
            notes="[TEST] seed data — можно удалить из Sheets",
        ))
        created.append(f"{mid[:8]} · {c['status']:9} · {c['client_name']}")

    print("Создано:")
    for c in created:
        print("  ✓", c)


if __name__ == "__main__":
    main()
