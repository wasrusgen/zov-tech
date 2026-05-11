"""Proxy6.net pool — динамическая загрузка купленных прокси, ротация.

Конфиг:
  PROXY6_TOKEN — API-ключ Proxy6 (https://proxy6.net/user/developers)
  Если пусто — прокси не используется (прямые HTTP-запросы).

Использование:
  from . import proxy_pool
  with proxy_pool.proxied_client(timeout=15) as client:
      r = client.get(url, headers=headers)
"""
from __future__ import annotations
import logging
import random
import threading
import time
from typing import Optional
import httpx

from .config import get_config

log = logging.getLogger("zov.proxy")

_API_URL = "https://proxy6.net/api"
_POOL_TTL_SEC = 600  # обновляем пул каждые 10 минут

_lock = threading.Lock()
_pool: list[str] = []  # ["http://user:pass@host:port", ...]
_pool_loaded_at: float = 0.0


def _load_pool(force: bool = False) -> list[str]:
    """Загружает активные прокси из Proxy6 API. Кэшируется на _POOL_TTL_SEC."""
    global _pool, _pool_loaded_at
    with _lock:
        now = time.time()
        if not force and _pool and now - _pool_loaded_at < _POOL_TTL_SEC:
            return _pool

        token = get_config().proxy6_token
        if not token:
            return _pool  # без токена — пустой пул, парсеры пойдут напрямую

        try:
            with httpx.Client(timeout=10.0) as client:
                r = client.get(f"{_API_URL}/{token}/getproxy", params={"state": "active"})
            data = r.json()
        except Exception as e:
            log.warning("Proxy6 API request failed: %s", e)
            return _pool

        if data.get("status") != "yes":
            log.warning("Proxy6 returned status=%s, error=%s",
                        data.get("status"), data.get("error"))
            return _pool

        proxies: list[str] = []
        for _, p in (data.get("list") or {}).items():
            if str(p.get("active")) != "1":
                continue
            proto = (p.get("type") or "http").lower()
            # Proxy6 возвращает 'socks' для SOCKS5
            if proto == "socks":
                proto = "socks5"
            host = p.get("host") or p.get("ip")
            port = p.get("port")
            user = p.get("user")
            pwd = p.get("pass")
            if not (host and port and user and pwd):
                continue
            proxies.append(f"{proto}://{user}:{pwd}@{host}:{port}")

        _pool = proxies
        _pool_loaded_at = now
        log.info("Proxy6 pool loaded: %d active proxies", len(_pool))
        return _pool


def get_random_proxy() -> Optional[str]:
    """Возвращает случайный прокси из пула, или None если пул пуст."""
    pool = _load_pool()
    if not pool:
        return None
    return random.choice(pool)


def proxied_client(timeout: float = 15.0, **client_kwargs) -> httpx.Client:
    """httpx.Client с рандомным прокси из пула (или прямой если пул пуст)."""
    proxy = get_random_proxy()
    if proxy:
        return httpx.Client(proxy=proxy, timeout=timeout, **client_kwargs)
    return httpx.Client(timeout=timeout, **client_kwargs)


def pool_status() -> dict:
    """Для диагностики — текущее состояние пула."""
    pool = _load_pool()
    return {
        "count": len(pool),
        "loaded_age_sec": int(time.time() - _pool_loaded_at) if _pool_loaded_at else None,
        "token_configured": bool(get_config().proxy6_token),
    }
