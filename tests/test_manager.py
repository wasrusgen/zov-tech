"""
Тест кабинета менеджера — полная проверка всех API-модулей
с реальной Telegram-аутентификацией.

Запуск:  python -X utf8 tests/test_manager.py
"""

import hmac
import hashlib
import json
import time
import sys
import urllib.request
import urllib.parse
import urllib.error
from typing import Any

# ─── Конфигурация ───────────────────────────────────────────────────────────
BOT_TOKEN   = "8281503057:AAEXmOepY8quH8E3RqOjFbgn7owV1ngnbGA"
ADMIN_TG_ID = 5937498515
ADMIN_USERNAME = "wasrusgen"
ADMIN_NAME  = "Руслан"
BASE_URL    = "https://api.wasrusgen1.pro"

# ─── Генерация валидного initData ───────────────────────────────────────────

def make_init_data(tg_id: int, username: str, first_name: str) -> str:
    user_obj = json.dumps({
        "id": tg_id,
        "first_name": first_name,
        "username": username,
        "language_code": "ru",
        "allows_write_to_pm": True,
    }, separators=(",", ":"))

    fields = {
        "auth_date": str(int(time.time())),
        "user": user_obj,
    }

    data_check_string = "\n".join(f"{k}={fields[k]}" for k in sorted(fields))
    secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    sig = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    params = {**fields, "hash": sig}
    return urllib.parse.urlencode(params)


INIT_DATA = make_init_data(ADMIN_TG_ID, ADMIN_USERNAME, ADMIN_NAME)

# ─── HTTP-хелперы ───────────────────────────────────────────────────────────

def post(path: str, payload: dict, timeout=15) -> tuple[int, Any]:
    url = f"{BASE_URL}{path}"
    data = json.dumps(payload).encode()
    try:
        req = urllib.request.Request(
            url, data=data,
            headers={"Content-Type": "application/json", "User-Agent": "zov-manager-test/1.0"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}
    except Exception as e:
        return None, {"_net_error": str(e)}


# ─── Отчёт ──────────────────────────────────────────────────────────────────

RESULTS: list[tuple[bool, str, str]] = []   # (ok, test_name, detail)


def ok(name: str, detail: str = ""):
    RESULTS.append((True, name, detail))
    icon = "✅"
    print(f"  {icon}  {name}" + (f"  — {detail}" if detail else ""))


def fail(name: str, detail: str = ""):
    RESULTS.append((False, name, detail))
    icon = "❌"
    print(f"  {icon}  {name}" + (f"  — {detail}" if detail else ""))


def section(title: str):
    print(f"\n{'─'*55}")
    print(f"  {title}")
    print(f"{'─'*55}")


# ─── Тесты ──────────────────────────────────────────────────────────────────

def test_auth():
    section("🔐 Аутентификация")
    status, data = post("/api/me", {
        "initData": INIT_DATA,
        "role": "manager",
    })
    if status != 200 or "error" in data:
        fail("POST /api/me — вход менеджера", f"status={status} error={data.get('error','?')}")
        return False
    role = data.get("role", "?")
    name = data.get("name", "?")
    ok("POST /api/me — вход менеджера", f"role={role} name={name}")
    if role not in ("manager", "admin"):
        fail("Роль должна быть manager или admin", f"получили: {role}")
        return False
    ok("Роль подтверждена", role)
    return True


def test_clients():
    section("👥 Модуль Клиенты")

    # Список клиентов
    status, data = post("/api/clients", {"initData": INIT_DATA})
    if status != 200 or "error" in data:
        fail("POST /api/clients — список", f"status={status} {data.get('error','')}")
    else:
        clients = data.get("clients", [])
        ok("POST /api/clients — список", f"{len(clients)} клиентов")

        # Проверяем структуру первого клиента
        if clients:
            c = clients[0]
            required_fields = ["client_name", "client_phone"]
            missing = [f for f in required_fields if f not in c]
            if missing:
                fail("Структура клиента — обязательные поля", f"отсутствуют: {missing}")
            else:
                ok("Структура клиента — обязательные поля", "client_name, client_phone ✓")


def test_measurements():
    section("📐 Модуль Замеры")

    # Входящие заявки
    status, data = post("/api/measurement_inbox", {"initData": INIT_DATA})
    if status != 200 or "error" in data:
        fail("POST /api/measurement_inbox", f"status={status} {data.get('error','')}")
    else:
        items = data.get("requests", data.get("items", []))
        ok("POST /api/measurement_inbox", f"{len(items)} заявок")

    # Список замеров
    status, data = post("/api/measurements", {"initData": INIT_DATA})
    if status != 200 or "error" in data:
        fail("POST /api/measurements — список", f"status={status} {data.get('error','')}")
    else:
        items = data.get("measurements", [])
        ok("POST /api/measurements — список", f"{len(items)} замеров")
        if items:
            m = items[0]
            ok("Первый замер — ID", m.get("id", "?")[:8] + "…")

    # Следующий номер
    status, data = post("/api/measurement_next_no", {"initData": INIT_DATA})
    if status != 200 or "error" in data:
        fail("POST /api/measurement_next_no", f"status={status} {data.get('error','')}")
    else:
        ok("POST /api/measurement_next_no", f"следующий №{data.get('next_no','?')}")


def test_assembly():
    section("🔧 Модуль Сборки")

    status, data = post("/api/assembly_list", {"initData": INIT_DATA})
    if status != 200 or "error" in data:
        fail("POST /api/assembly_list", f"status={status} {data.get('error','')}")
    else:
        items = data.get("assemblies", [])
        ok("POST /api/assembly_list", f"{len(items)} сборок")
        if items:
            a = items[0]
            has_status = "status" in a
            has_address = "address" in a
            if has_status and has_address:
                ok("Структура сборки", f"status={a['status']} address={a['address'][:20]}…")
            else:
                fail("Структура сборки — поля status/address", f"has_status={has_status} has_address={has_address}")


def test_proposals():
    section("📋 Модуль Предложения")

    status, data = post("/api/proposal_list", {"initData": INIT_DATA})
    if status != 200 or "error" in data:
        fail("POST /api/proposal_list", f"status={status} {data.get('error','')}")
    else:
        items = data.get("proposals", data.get("items", []))
        ok("POST /api/proposal_list", f"{len(items)} предложений")


def test_manager_pending():
    section("📬 Менеджер — входящие задачи")

    status, data = post("/api/manager_pending", {"initData": INIT_DATA})
    if status != 200 or "error" in data:
        fail("POST /api/manager_pending", f"status={status} {data.get('error','')}")
    else:
        count = len(data.get("items", data.get("pending", [])))
        ok("POST /api/manager_pending", f"{count} задач в очереди")


def test_staff_list():
    section("👷 Сотрудники")

    for role in ["measurer", "assembler"]:
        status, data = post("/api/staff_list", {"initData": INIT_DATA, "role": role})
        if status != 200 or "error" in data:
            fail(f"POST /api/staff_list role={role}", f"status={status} {data.get('error','')}")
        else:
            staff = data.get("staff", [])
            ok(f"POST /api/staff_list role={role}", f"{len(staff)} сотрудников")


def test_shipments_arrivals():
    section("📦 Отгрузки и поступления")

    for endpoint in ["/api/shipments", "/api/arrivals"]:
        status, data = post(endpoint, {"initData": INIT_DATA})
        if status != 200 or "error" in data:
            fail(f"POST {endpoint}", f"status={status} {data.get('error','')}")
        else:
            key = "shipments" if "shipments" in endpoint else "arrivals"
            items = data.get(key, data.get("items", data.get("rows", [])))
            ok(f"POST {endpoint}", f"{len(items)} записей")


def test_no_500_on_bad_input():
    section("🛡️ Устойчивость — невалидные данные не дают 500")

    bad_cases = [
        ("/api/measurement_detail",   {"initData": INIT_DATA, "measurement_id": "nonexistent-000"}),
        ("/api/assembly_detail",      {"initData": INIT_DATA, "assembly_id": "nonexistent-000"}),
        ("/api/client_create",        {"initData": INIT_DATA, "client_name": "", "client_phone": ""}),
        ("/api/assembly_create",      {"initData": INIT_DATA, "client_name": "", "address": "", "scope_of_work": ""}),
    ]
    for path, payload in bad_cases:
        status, data = post(path, payload)
        if status == 500:
            fail(f"POST {path} с плохими данными → 500!", f"ответ: {str(data)[:80]}")
        else:
            ok(f"POST {path} с плохими данными → не 500", f"status={status} error={data.get('error','?')[:40]}")


# ─── Main ───────────────────────────────────────────────────────────────────

def main():
    print(f"\n{'='*55}")
    print(f"  ТЕСТ КАБИНЕТА МЕНЕДЖЕРА — @wasrusgen1bot")
    print(f"  Пользователь: @{ADMIN_USERNAME} (id={ADMIN_TG_ID})")
    print(f"  Сервер: {BASE_URL}")
    print(f"{'='*55}")

    t0 = time.time()

    auth_ok = test_auth()
    if not auth_ok:
        print("\n🚫 Аутентификация провалена — дальнейшие тесты невозможны.\n")
        sys.exit(1)

    test_clients()
    test_measurements()
    test_assembly()
    test_proposals()
    test_manager_pending()
    test_staff_list()
    test_shipments_arrivals()
    test_no_500_on_bad_input()

    elapsed = time.time() - t0
    passed = sum(1 for ok_, _, _ in RESULTS if ok_)
    failed = len(RESULTS) - passed

    print(f"\n{'='*55}")
    print(f"  ИТОГО: {passed} ✅  /  {failed} ❌  ({elapsed:.1f}s)")
    print(f"{'='*55}\n")

    if failed:
        print("📋 ЗАМЕЧАНИЯ К УСТРАНЕНИЮ:\n")
        for ok_, name, detail in RESULTS:
            if not ok_:
                print(f"  ❌  {name}")
                if detail:
                    print(f"      → {detail}")
        print()
        sys.exit(1)
    else:
        print("✅ Кабинет менеджера работает штатно.\n")
        sys.exit(0)


if __name__ == "__main__":
    main()
