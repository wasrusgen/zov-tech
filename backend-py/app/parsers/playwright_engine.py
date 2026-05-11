"""Singleton Playwright + Chromium для парсинга JS-сайтов.

Использование:
    from .playwright_engine import fetch_page
    html = fetch_page("https://market.yandex.ru/search?text=Bosch+KGN39")

Зачем синглтон: запуск Chromium ~2-3 сек. Держим один экземпляр, открываем
изолированный контекст (cookies/storage) на каждый запрос.
"""
from __future__ import annotations
import logging
import threading
from typing import Optional

log = logging.getLogger("zov.parser.playwright")

_lock = threading.Lock()
_playwright = None
_browser = None


def _get_browser():
    """Возвращает singleton Chromium browser. Инициализирует при первом обращении."""
    global _playwright, _browser
    with _lock:
        if _browser is not None and _browser.is_connected():
            return _browser
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as e:
            log.error("Playwright not installed: %s", e)
            return None

        try:
            _playwright = sync_playwright().start()
            _browser = _playwright.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",  # snug на маленькой памяти
                    "--disable-gpu",
                ],
            )
            log.info("Playwright Chromium started")
            return _browser
        except Exception as e:
            log.error("Failed to start Playwright: %s", e)
            _playwright = None
            _browser = None
            return None


def fetch_page(url: str, wait_selector: Optional[str] = None,
               wait_ms: int = 3000, timeout_ms: int = 25000,
               user_agent: Optional[str] = None, use_proxy: bool = True) -> Optional[str]:
    """Открывает страницу через headless Chromium, ждёт пока JS отрендерит,
    возвращает текущий HTML.

    Args:
        url: целевой URL
        wait_selector: если задан — ждём пока этот CSS-селектор появится
        wait_ms: фиксированная задержка после загрузки (для JS-hydration)
        timeout_ms: общий таймаут навигации
        user_agent: переопределить UA
        use_proxy: использовать residential proxy из proxy_pool (default True)
    """
    browser = _get_browser()
    if not browser:
        return None

    # Достаём случайный прокси из пула — для каждого запроса свой IP
    proxy_cfg = None
    if use_proxy:
        from .. import proxy_pool
        proxy_url = proxy_pool.get_random_proxy()
        if proxy_url:
            proxy_cfg = _parse_proxy_url_for_playwright(proxy_url)

    ctx_kwargs = {
        "user_agent": user_agent or
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "viewport": {"width": 1280, "height": 800},
        "locale": "ru-RU",
        "extra_http_headers": {
            "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
        },
    }
    if proxy_cfg:
        ctx_kwargs["proxy"] = proxy_cfg

    ctx = None
    page = None
    try:
        ctx = browser.new_context(**ctx_kwargs)
        page = ctx.new_page()

        # Блокируем тяжёлые ресурсы — экономим время/память
        def _route(route):
            rt = route.request.resource_type
            if rt in ("image", "font", "media", "stylesheet"):
                return route.abort()
            return route.continue_()
        page.route("**/*", _route)

        page.goto(url, timeout=timeout_ms, wait_until="domcontentloaded")

        if wait_selector:
            try:
                page.wait_for_selector(wait_selector, timeout=wait_ms + 5000)
            except Exception:
                log.debug("wait_selector %s not found, continuing", wait_selector)
        else:
            page.wait_for_timeout(wait_ms)

        html = page.content()
        return html
    except Exception as e:
        log.warning("fetch_page failed for %s: %s", url, e)
        return None
    finally:
        if page:
            try: page.close()
            except: pass
        if ctx:
            try: ctx.close()
            except: pass


def _parse_proxy_url_for_playwright(url: str) -> dict | None:
    """Конвертирует http://user:pass@host:port в формат для playwright.proxy."""
    import re
    m = re.match(r"^(https?|socks5)://(?:([^:]+):([^@]+)@)?([^:/]+):(\d+)/?$", url)
    if not m:
        return None
    scheme, user, pwd, host, port = m.groups()
    server = f"{scheme}://{host}:{port}"
    cfg = {"server": server}
    if user: cfg["username"] = user
    if pwd:  cfg["password"] = pwd
    return cfg


def shutdown():
    """Закрывает браузер при остановке приложения."""
    global _playwright, _browser
    with _lock:
        if _browser:
            try: _browser.close()
            except: pass
            _browser = None
        if _playwright:
            try: _playwright.stop()
            except: pass
            _playwright = None
