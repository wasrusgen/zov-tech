"""Загрузка файлов из Google Drive через service account.

Использует google-api-python-client (уже в requirements.txt).
Scope drive.readonly — только чтение файлов, к которым у сервисного аккаунта есть доступ.
"""
from __future__ import annotations

import io
import threading
import time
from typing import Any

from googleapiclient.discovery import build  # type: ignore
from googleapiclient.http import MediaIoBaseDownload  # type: ignore
from google.oauth2.service_account import Credentials  # type: ignore

from .config import get_config

_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
]

_lock = threading.Lock()
_service: Any = None

# Простой in-memory кэш: {file_id: (bytes, timestamp)}
_cache: dict[str, tuple[bytes, float]] = {}
_CACHE_TTL = 300  # 5 минут


def _get_service() -> Any:
    global _service
    with _lock:
        if _service is None:
            cfg = get_config()
            creds = Credentials.from_service_account_file(
                cfg.google_credentials_path, scopes=_SCOPES
            )
            _service = build("drive", "v3", credentials=creds, cache_discovery=False)
        return _service


def download_file_bytes(file_id: str) -> bytes:
    """Скачивает файл из Google Drive по его ID и возвращает байты.

    Кэширует результат на 5 минут, чтобы не качать xlsx на каждый запрос дашборда.
    """
    now = time.monotonic()
    cached = _cache.get(file_id)
    if cached and (now - cached[1]) < _CACHE_TTL:
        return cached[0]

    service = _get_service()
    request = service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()

    data = fh.getvalue()
    _cache[file_id] = (data, now)
    return data
