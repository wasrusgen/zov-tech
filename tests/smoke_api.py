"""
Smoke-тесты API на боевом сервере.
Тестирует только публичные/анонимные эндпоинты (без initData).
Запуск: python tests/smoke_api.py [--url https://api.wasrusgen1.pro]
"""

import sys
import json
import urllib.request
import urllib.error
import argparse
import time

BASE_URL = "https://api.wasrusgen1.pro"

RESULTS = []


def check(name: str, ok: bool, detail: str = ""):
    icon = "✅" if ok else "❌"
    msg = f"  {icon}  {name}"
    if detail:
        msg += f"  ({detail})"
    RESULTS.append((ok, msg))
    print(msg)


def get(path: str, timeout=10):
    url = f"{BASE_URL}{path}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "zov-smoke/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read().decode()
            return r.status, body
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:
        return None, str(e)


def post(path: str, payload: dict, timeout=10):
    url = f"{BASE_URL}{path}"
    data = json.dumps(payload).encode()
    try:
        req = urllib.request.Request(
            url, data=data,
            headers={"Content-Type": "application/json", "User-Agent": "zov-smoke/1.0"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read().decode()
            return r.status, body
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:
        return None, str(e)


# ─── Тесты ──────────────────────────────────────────────────────────────────

def test_healthz():
    status, body = get("/healthz")
    check("GET /healthz → 200", status == 200, f"status={status}")


def test_root():
    status, body = get("/")
    check("GET / → 200", status == 200, f"status={status}")


def test_me_no_auth():
    """Без initData должен вернуть ошибку аутентификации, но не 500."""
    status, body = post("/api/me", {"initData": "", "role": "manager"})
    try:
        data = json.loads(body)
        has_error_field = "error" in data
    except Exception:
        has_error_field = False
    check(
        "POST /api/me без initData → ошибка аутентификации (не 500)",
        status in (200, 400, 403) and has_error_field,
        f"status={status} error={data.get('error', '?') if has_error_field else body[:60]}",
    )


def test_clients_no_auth():
    status, body = post("/api/clients", {"initData": ""})
    try:
        data = json.loads(body)
        ok = "error" in data and status != 500
    except Exception:
        ok = False
    check("POST /api/clients без initData → auth-ошибка (не 500)", ok, f"status={status}")


def test_assembly_list_no_auth():
    status, body = post("/api/assembly_list", {"initData": ""})
    try:
        data = json.loads(body)
        ok = "error" in data and status != 500
    except Exception:
        ok = False
    check("POST /api/assembly_list без initData → auth-ошибка (не 500)", ok, f"status={status}")


def test_measurement_request_no_auth():
    status, body = post("/api/measurement_request", {
        "initData": "",
        "client_name": "Тест",
        "client_phone": "79001234567",
    })
    try:
        data = json.loads(body)
        ok = "error" in data and status != 500
    except Exception:
        ok = False
    check("POST /api/measurement_request без initData → auth-ошибка (не 500)", ok, f"status={status}")


def test_assembly_create_no_auth():
    status, body = post("/api/assembly_create", {
        "initData": "",
        "client_name": "Тест",
        "address": "Тест",
        "scope_of_work": "Тест",
    })
    try:
        data = json.loads(body)
        ok = "error" in data and status != 500
    except Exception:
        ok = False
    check("POST /api/assembly_create без initData → auth-ошибка (не 500)", ok, f"status={status}")


def test_proposal_list_no_auth():
    status, body = post("/api/proposal_list", {"initData": ""})
    try:
        data = json.loads(body)
        ok = "error" in data and status != 500
    except Exception:
        ok = False
    check("POST /api/proposal_list без initData → auth-ошибка (не 500)", ok, f"status={status}")


def test_staff_list_no_auth():
    status, body = post("/api/staff_list", {"initData": "", "role": "measurer"})
    try:
        data = json.loads(body)
        # staff_list может вернуть пустой список без аутентификации — это ок
        ok = status != 500
    except Exception:
        ok = False
    check("POST /api/staff_list → не 500", ok, f"status={status}")


def test_photo_missing():
    status, body = get("/api/photo/nonexistent_id/nonexistent.jpg")
    check(
        "GET /api/photo/несуществующий → 404 (не 500)",
        status == 404,
        f"status={status}",
    )


def test_github_pages():
    """Проверяем что MiniApp доступен на GitHub Pages."""
    import urllib.request
    url = "https://wasrusgen.github.io/zov-tech/index.html"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "zov-smoke/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            body = r.read().decode()
            has_app = 'id="app"' in body
            check(
                "GitHub Pages MiniApp доступен",
                r.status == 200 and has_app,
                f"status={r.status} has_app={has_app}",
            )
    except Exception as e:
        check("GitHub Pages MiniApp доступен", False, str(e))


def test_miniapp_css_version():
    """CSS в index.html имеет версию (не закешируется по-старому)."""
    import urllib.request
    import re
    url = "https://wasrusgen.github.io/zov-tech/index.html"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "zov-smoke/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            body = r.read().decode()
            has_version = bool(re.search(r'styles\.css\?v=\d{8}[a-z]', body))
            check(
                "index.html: styles.css имеет версию вида ?v=YYYYMMDDx",
                has_version,
                f"found={has_version}",
            )
    except Exception as e:
        check("index.html: проверка версии", False, str(e))


# ─── Main ───────────────────────────────────────────────────────────────────

def main():
    global BASE_URL
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=BASE_URL, help="Base URL бэкенда")
    args = parser.parse_args()
    BASE_URL = args.url.rstrip("/")

    print(f"🔥 Smoke-тесты → {BASE_URL}\n")
    t0 = time.time()

    test_healthz()
    test_root()
    test_me_no_auth()
    test_clients_no_auth()
    test_assembly_list_no_auth()
    test_measurement_request_no_auth()
    test_assembly_create_no_auth()
    test_proposal_list_no_auth()
    test_staff_list_no_auth()
    test_photo_missing()
    test_github_pages()
    test_miniapp_css_version()

    elapsed = time.time() - t0
    passed = sum(1 for ok, _ in RESULTS if ok)
    failed = len(RESULTS) - passed

    print(f"\n{'─'*50}")
    print(f"  Итого: {passed} пройдено / {failed} упало  ({elapsed:.1f}s)")

    if failed:
        print(f"\n🚫 Замечания к устранению:")
        for ok, msg in RESULTS:
            if not ok:
                print(msg)
        print()
        sys.exit(1)
    else:
        print("\n✅ Все тесты прошли.\n")
        sys.exit(0)


if __name__ == "__main__":
    main()
