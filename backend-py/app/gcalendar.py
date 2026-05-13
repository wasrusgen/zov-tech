"""Google Calendar — создание событий замера через service account.

Требования для работы:
1. В Google Cloud проекте включён Calendar API
2. Service account email добавлен в редакторы целевого календаря
   (Google Calendar → Settings of calendar → Share with specific people)
3. GOOGLE_CALENDAR_ID в env (можно «primary» если SA имеет свой календарь,
   или ID другого календаря в формате 'abc123@group.calendar.google.com')

При ошибке (API не включён / нет прав / нет ID) функции возвращают None
и логируют warning — backend продолжает работать без календаря.
"""
from __future__ import annotations
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

log = logging.getLogger("zov.gcalendar")

_SCOPES = ["https://www.googleapis.com/auth/calendar"]
_DEFAULT_TIMEZONE = "Europe/Moscow"
_DEFAULT_DURATION_MIN = 60

_service = None


def _get_service():
    """Lazy-init Google Calendar service. Возвращает None при ошибке."""
    global _service
    if _service is not None:
        return _service
    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
    except ImportError as e:
        log.warning("google-api-python-client не установлен: %s", e)
        return None

    creds_path = os.environ.get("GOOGLE_CREDENTIALS_PATH", "/app/credentials.json")
    if not os.path.exists(creds_path):
        log.warning("credentials.json не найден: %s", creds_path)
        return None
    try:
        creds = Credentials.from_service_account_file(creds_path, scopes=_SCOPES)
        _service = build("calendar", "v3", credentials=creds, cache_discovery=False)
        log.info("Google Calendar service инициализирован")
        return _service
    except Exception as e:
        log.warning("Не удалось инициализировать Calendar service: %s", e)
        return None


def create_event(
    *,
    summary: str,
    description: str = "",
    start_iso: str,
    duration_min: int = _DEFAULT_DURATION_MIN,
    location: str = "",
    timezone_name: str = _DEFAULT_TIMEZONE,
    calendar_id: str | None = None,
) -> dict[str, Any] | None:
    """Создаёт событие в Google Calendar.
    Возвращает {'id', 'html_link'} или None при ошибке.

    start_iso: ISO 8601 datetime (с TZ или без — будет интерпретирован как timezone_name)
    """
    service = _get_service()
    if service is None:
        return None

    cal_id = calendar_id or os.environ.get("GOOGLE_CALENDAR_ID", "").strip()
    if not cal_id:
        log.warning("GOOGLE_CALENDAR_ID не задан — событие не создано")
        return None

    # Парсим start
    try:
        start_dt = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    except Exception as e:
        log.warning("Bad start_iso=%r: %s", start_iso, e)
        return None
    end_dt = start_dt + timedelta(minutes=duration_min)

    body = {
        "summary": summary,
        "description": description or "",
        "location": location or "",
        "start": {"dateTime": start_dt.isoformat(), "timeZone": timezone_name},
        "end":   {"dateTime": end_dt.isoformat(),   "timeZone": timezone_name},
        # Напоминания за 1 час
        "reminders": {
            "useDefault": False,
            "overrides": [{"method": "popup", "minutes": 60}],
        },
    }
    try:
        ev = service.events().insert(calendarId=cal_id, body=body).execute()
        log.info("Создано событие GCal: %s", ev.get("htmlLink"))
        return {"id": ev.get("id"), "html_link": ev.get("htmlLink")}
    except Exception as e:
        log.warning("Не удалось создать событие GCal: %s", e)
        return None


def update_event(
    *,
    event_id: str,
    summary: str | None = None,
    description: str | None = None,
    start_iso: str | None = None,
    duration_min: int = _DEFAULT_DURATION_MIN,
    location: str | None = None,
    timezone_name: str = _DEFAULT_TIMEZONE,
    calendar_id: str | None = None,
) -> dict[str, Any] | None:
    """Обновляет существующее событие. Только переданные поля меняются."""
    service = _get_service()
    if service is None:
        return None
    cal_id = calendar_id or os.environ.get("GOOGLE_CALENDAR_ID", "").strip()
    if not cal_id or not event_id:
        return None

    try:
        ev = service.events().get(calendarId=cal_id, eventId=event_id).execute()
    except Exception as e:
        log.warning("Событие не найдено для обновления: %s", e)
        # Создадим новое если задан start_iso
        if start_iso:
            return create_event(
                summary=summary or "Замер",
                description=description or "",
                start_iso=start_iso,
                duration_min=duration_min,
                location=location or "",
                timezone_name=timezone_name,
                calendar_id=cal_id,
            )
        return None

    if summary is not None: ev["summary"] = summary
    if description is not None: ev["description"] = description
    if location is not None: ev["location"] = location
    if start_iso is not None:
        try:
            start_dt = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
            end_dt = start_dt + timedelta(minutes=duration_min)
            ev["start"] = {"dateTime": start_dt.isoformat(), "timeZone": timezone_name}
            ev["end"]   = {"dateTime": end_dt.isoformat(),   "timeZone": timezone_name}
        except Exception as e:
            log.warning("Bad start_iso: %s", e)

    try:
        updated = service.events().update(calendarId=cal_id, eventId=event_id, body=ev).execute()
        log.info("Обновлено событие GCal: %s", updated.get("htmlLink"))
        return {"id": updated.get("id"), "html_link": updated.get("htmlLink")}
    except Exception as e:
        log.warning("Не удалось обновить событие GCal: %s", e)
        return None


def delete_event(event_id: str, calendar_id: str | None = None) -> bool:
    service = _get_service()
    if service is None:
        return False
    cal_id = calendar_id or os.environ.get("GOOGLE_CALENDAR_ID", "").strip()
    if not cal_id or not event_id:
        return False
    try:
        service.events().delete(calendarId=cal_id, eventId=event_id).execute()
        return True
    except Exception as e:
        log.warning("Не удалось удалить событие: %s", e)
        return False
