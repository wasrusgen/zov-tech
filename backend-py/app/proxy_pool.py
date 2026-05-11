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


def _normalize_proxy_entry(p: str) -> str | None:
    """Принимает строку в любом из форматов:
       - http://user:pass@host:port
       - socks5://user:pass@host:port
       - host:port:user:pass (формат Proxys.io)
       - host:port
       и возвращает unified URL.
    """
    p = p.strip()
    if not p:
        return None
    if "://" in p:
        return p
    # host:port:user:pass или host:port
    parts = p.split(":")
    if len(parts) == 4:
        host, port, user, pwd = parts
        return f"http://{user}:{pwd}@{host}:{port}"
    if len(parts) == 2:
        return f"http://{parts[0]}:{parts[1]}"
    return None


def _parse_static_list(raw: str) -> list[str]:
    """Парсит PROXY_STATIC_LIST — строка с прокси через запятую/перевод строки."""
    if not raw:
        return []
    parts = raw.replace("\n", ",").split(",")
    return [u for u in (_normalize_proxy_entry(p) for p in parts) if u]


def _load_from_file(path: str) -> list[str]:
    """Загружает прокси из файла. Каждая строка — один прокси в любом формате."""
    if not path:
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except (OSError, IOError) as e:
        log.warning("Failed to read PROXY_LIST_FILE=%s: %s", path, e)
        return []
    return [u for u in (_normalize_proxy_entry(line) for line in lines) if u]


def _load_pool(force: bool = False) -> list[str]:
    """Загружает прокси: сначала статический список из ENV, потом дополняет из Proxy6 API.
    Кэшируется на _POOL_TTL_SEC."""
    global _pool, _pool_loaded_at
    with _lock:
        now = time.time()
        if not force and _pool and now - _pool_loaded_at < _POOL_TTL_SEC:
            return _pool

        cfg = get_config()
        proxies: list[str] = []

        # 1a) Из файла (для больших списков типа Proxys.io 999 IP)
        file_proxies = _load_from_file(cfg.proxy_list_file)
        if file_proxies:
            proxies.extend(file_proxies)
            log.info("Proxy file %s: %d entries", cfg.proxy_list_file, len(file_proxies))

        # 1b) Статический список из ENV (для одиночных IP без файла)
        static = _parse_static_list(cfg.proxy_static_list)
        if static:
            # Дедуп
            new_items = [s for s in static if s not in proxies]
            proxies.extend(new_items)
            log.info("Static proxy list: +%d entries (total %d)", len(new_items), len(proxies))

        # 2) Динамический пул из Proxy6 API (если есть токен)
        if cfg.proxy6_token:
            try:
                with httpx.Client(timeout=10.0) as client:
                    r = client.get(f"{_API_URL}/{cfg.proxy6_token}/getproxy",
                                   params={"state": "active"})
                data = r.json()
                if data.get("status") == "yes":
                    for _, p in (data.get("list") or {}).items():
                        if str(p.get("active")) != "1":
                            continue
                        proto = (p.get("type") or "http").lower()
                        if proto == "socks":
                            proto = "socks5"
                        host = p.get("host") or p.get("ip")
                        port = p.get("port")
                        user = p.get("user")
                        pwd = p.get("pass")
                        if not (host and port and user and pwd):
                            continue
                        url = f"{proto}://{user}:{pwd}@{host}:{port}"
                        if url not in proxies:
                            proxies.append(url)
                    log.info("Proxy6 API: total pool now %d proxies", len(proxies))
                else:
                    log.warning("Proxy6 API returned status=%s error=%s",
                                data.get("status"), data.get("error"))
            except Exception as e:
                log.warning("Proxy6 API request failed: %s", e)

        _pool = proxies
        _pool_loaded_at = now
        if not _pool:
            log.info("Proxy pool is empty — parsers will use direct HTTP")
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
    cfg = get_config()
    # Маскируем пароли в URL для diagnostic
    masked = []
    for p in pool:
        try:
            import re as _re
            masked.append(_re.sub(r"://([^:]+):([^@]+)@", r"://\1:***@", p))
        except Exception:
            masked.append("***")
    return {
        "count": len(pool),
        "loaded_age_sec": int(time.time() - _pool_loaded_at) if _pool_loaded_at else None,
        "token_configured": bool(cfg.proxy6_token),
        "static_list_size": len(_parse_static_list(cfg.proxy_static_list)),
        "file_path": cfg.proxy_list_file,
        "file_loaded": len(_load_from_file(cfg.proxy_list_file)) if cfg.proxy_list_file else 0,
        "sample": masked[:3],  # первые 3 для проверки формата
    }
