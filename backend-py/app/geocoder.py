"""Hybrid Geocoder: Yandex (если есть API-ключ) → fallback OSM Nominatim.

Порт из secretary/lib/geocoder.js — та же логика нормализации адреса
и стратегия fallback.
"""
from __future__ import annotations
import os
import re
import time
import logging
import urllib.parse
import httpx

log = logging.getLogger("zov.geocoder")

OSM_HOST = "https://nominatim.openstreetmap.org"
YANDEX_HOST = "https://geocode-maps.yandex.ru"
OSM_RATE_DELAY_SEC = 1.1  # ~1 req/sec по политике Nominatim

_cache: dict[str, dict | None] = {}
_last_osm_at: float = 0.0
_yandex_disabled: bool = False


def normalize_address(s: str) -> str:
    """Готовим адрес для геокодера. Срезаем квартиру/этаж/подъезд/корпус,
    раскрываем сокращения улиц. Совпадает с logic из secretary/lib/geocoder.js.
    """
    if not s:
        return ""
    out = str(s)

    # Замена сокращений улиц на полные слова (лучше для OSM)
    # \b плохо работает с кириллицей в Python — используем lookaround
    L = r"[А-Яа-яЁёA-Za-z]"
    NL = rf"(?<!{L})"
    NLA = rf"(?!{L})"
    abbrev = [
        (rf"{NL}пр-?к?т{NLA}\.?", "проспект"),
        (rf"{NL}пр{NLA}\.?", "проспект"),
        (rf"{NL}ул{NLA}\.?", "улица"),
        (rf"{NL}пер{NLA}\.?", "переулок"),
        (rf"{NL}наб{NLA}\.?", "набережная"),
        (rf"{NL}пл{NLA}\.?", "площадь"),
        (rf"{NL}ш{NLA}\.?", "шоссе"),
        (rf"{NL}б-?р{NLA}\.?", "бульвар"),
        (rf"{NL}алл{NLA}\.?", "аллея"),
    ]
    for pat, sub in abbrev:
        out = re.sub(pat, sub, out, flags=re.IGNORECASE | re.UNICODE)

    # Срезаем номер квартиры/офиса/помещения, парадную, подъезд, этаж
    cuts = [
        rf"{NL}(кв|квартира|оф|офис|пом|помещение)\.?\s*\d+\w*",
        rf"{NL}\d+-?я?\s*парадная",
        rf"{NL}парадная\s*\d+",
        rf"{NL}(подъезд|этаж|эт)\.?\s*\d+",
    ]
    for pat in cuts:
        out = re.sub(pat, "", out, flags=re.IGNORECASE | re.UNICODE)

    # "д.9" / "дом 9" → "9"
    out = re.sub(rf"{NL}(дом|д)\.?\s*(\d+){NLA}", r" \2", out, flags=re.IGNORECASE | re.UNICODE)
    # "стр.1" → "с1"
    out = re.sub(rf"{NL}(стр|строение)\.?\s*(\d+)", r"с\2", out, flags=re.IGNORECASE | re.UNICODE)
    # "корп.3" / "к. 3" → "к3" (только перед числом)
    out = re.sub(rf"{NL}(корпус|корп|к)\.?\s+(\d+)", r"к\2", out, flags=re.IGNORECASE | re.UNICODE)

    # Лишняя пунктуация и сжатие
    out = re.sub(r"[,;]+", ",", out)
    out = re.sub(r"\s*,\s*", ", ", out)
    out = re.sub(r"\s+", " ", out)
    out = out.replace("–", "-").replace("—", "-")
    out = re.sub(r"\s*-\s*\d+\s*$", "", out)  # "- 459" в конце = № квартиры
    out = out.strip().strip(",").strip()
    return out


def _yandex_lookup(query: str, api_key: str) -> dict | None:
    global _yandex_disabled
    path = f"/v1/?apikey={urllib.parse.quote(api_key)}&geocode={urllib.parse.quote(query)}&format=json&results=1&lang=ru_RU"
    try:
        with httpx.Client(timeout=15.0) as cli:
            r = cli.get(YANDEX_HOST + path)
    except Exception as e:
        log.warning("Yandex geocoder error: %s", e)
        return None
    if r.status_code == 403:
        log.warning("Yandex 403 — отключаю на эту сессию")
        _yandex_disabled = True
        return None
    if r.status_code >= 400:
        log.warning("Yandex %d", r.status_code)
        return None
    try:
        data = r.json()
    except Exception:
        return None
    features = data.get("response", {}).get("GeoObjectCollection", {}).get("featureMember", [])
    if not features:
        return None
    obj = features[0].get("GeoObject", {})
    pos = (obj.get("Point") or {}).get("pos", "")
    try:
        lon_s, lat_s = pos.split(" ")
        lat = float(lat_s)
        lon = float(lon_s)
    except (ValueError, AttributeError):
        return None
    meta = (obj.get("metaDataProperty") or {}).get("GeocoderMetaData", {})
    return {
        "lat": lat,
        "lon": lon,
        "formatted": meta.get("text") or obj.get("description") or query,
        "precision": meta.get("precision", ""),
        "kind": meta.get("kind", ""),
        "source": "yandex",
    }


def _osm_lookup(query: str, orig: str) -> dict | None:
    global _last_osm_at
    wait = max(0.0, _last_osm_at + OSM_RATE_DELAY_SEC - time.time())
    if wait > 0:
        time.sleep(wait)
    _last_osm_at = time.time()

    path = f"/search?q={urllib.parse.quote(query)}&format=json&limit=1&accept-language=ru"
    headers = {"User-Agent": "zov-tech/1.0 (vasrusgen@gmail.com)"}
    try:
        with httpx.Client(timeout=15.0, headers=headers) as cli:
            r = cli.get(OSM_HOST + path)
    except Exception as e:
        log.warning("OSM error: %s", e)
        return None
    if r.status_code >= 400:
        log.warning("OSM %d", r.status_code)
        return None
    try:
        data = r.json()
    except Exception:
        return None
    if not data:
        return None
    it = data[0]
    try:
        lat = float(it.get("lat"))
        lon = float(it.get("lon"))
    except (TypeError, ValueError):
        return None
    return {
        "lat": lat,
        "lon": lon,
        "formatted": it.get("display_name") or orig or query,
        "precision": it.get("type", ""),
        "kind": it.get("addresstype") or it.get("class", ""),
        "source": "osm",
    }


def geocode(address_text: str, city: str = "Санкт-Петербург") -> dict | None:
    """Прямое геокодирование: текст адреса → {lat, lon, formatted, source, ...}"""
    if not address_text:
        return None
    cleaned = normalize_address(address_text)
    q = f"{city}, {cleaned}" if city else cleaned
    if q in _cache:
        return _cache[q]

    api_key = os.environ.get("YANDEX_GEOCODER_API_KEY", "").strip()
    if api_key and not _yandex_disabled:
        r = _yandex_lookup(q, api_key)
        if r:
            _cache[q] = r
            return r

    r = _osm_lookup(q, address_text)
    _cache[q] = r
    return r


def build_yandex_maps_url(lat: float, lon: float, *, zoom: int = 17, text: str = "") -> str:
    """Deeplink в Я.Карты — открывается в приложении на телефоне."""
    params = [f"pt={lon},{lat},pm2rdm", f"z={zoom}", f"ll={lon},{lat}"]
    if text:
        params.append(f"text={urllib.parse.quote(text)}")
    return "https://yandex.ru/maps/?" + "&".join(params)
