"""GigaChat client — OAuth + chat completions."""
from __future__ import annotations
import json
import re
import threading
import time
import uuid
from typing import Any
import httpx

from .config import get_config

_AUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
_CHAT_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"

_lock = threading.Lock()
_token: str | None = None
_token_expires_at: float = 0.0


def _get_token() -> str:
    global _token, _token_expires_at
    with _lock:
        # 5-минутный запас перед истечением
        if _token and time.time() < _token_expires_at - 300:
            return _token

        cfg = get_config()
        rq_uid = str(uuid.uuid4())
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                _AUTH_URL,
                headers={
                    "Authorization": f"Basic {cfg.gigachat_auth_key}",
                    "RqUID": rq_uid,
                    "Accept": "application/json",
                },
                data={"scope": cfg.gigachat_scope},
            )
        resp.raise_for_status()
        data = resp.json()
        _token = data.get("access_token") or data.get("tok")
        if not _token:
            raise RuntimeError(f"No access_token in GigaChat response: {data}")
        # expires_at в миллисекундах unix
        expires_at_ms = data.get("expires_at") or data.get("exp") or 0
        _token_expires_at = (expires_at_ms / 1000) if expires_at_ms else (time.time() + 1500)
        return _token


SYSTEM_PROMPT_PICKER = (
    "Ты — эксперт-консультант по подбору кухонной техники для фабрики мебели «ЗОВ».\n"
    "Помогаешь менеджерам салонов согласовать с клиентом комплект техники.\n\n"
    "═══ ВХОДНЫЕ ДАННЫЕ ═══\n"
    "В `checklist` получаешь:\n"
    "  • `categories[]` — какие категории подбираем (fridge, hob, oven, dw, hood, microwave, coffee, washer)\n"
    "  • `per_cat[cat].answers{}` — иерархические ответы wizard'а по каждой категории\n"
    "      (install, chamber, size, features[], heat_source, subtype[], burners и т.д.)\n"
    "  • `per_cat[cat].notes` — заметки менеджера по категории\n"
    "  • `brand_strategy` — 'ai' (AI решит) | 'single' (одна марка) | 'different' (разные марки)\n"
    "  • `single_brand` — если brand_strategy='single', выбранная марка (или 'ai_pick')\n"
    "  • `brands{}` — если brand_strategy='different', по категориям: { fridge: { Bosch: 'preferred'|'acceptable'|'avoid' } }\n"
    "  • `budget_preset` — 'luxe' (от 1.5М₽) | 'premium' (700к-1.5М) | 'middle' (350-700к) | 'budget' (до 350к) | 'exact'\n"
    "  • `price_ranges{}` — если budget_preset='exact', точные коридоры от-до по категориям\n"
    "  • `pick_strategies[]` — стратегии (multi): 'reviews', 'balance', 'premium_brand', 'cheap', 'tech', 'style'\n"
    "  • `infra` — { stove: 'induction'|'gas'|'el_220'|'any', vent: 'yes'|'no'|'unknown' }\n\n"
    "═══ ПРИНЦИПЫ ПОДБОРА ═══\n"
    "1. **Бренд-стратегия**:\n"
    "   - 'single' → ВСЯ техника от одной марки (или близких из её линейки), укажи модель из этой марки\n"
    "   - 'different' → preferred (★) приоритет, acceptable (✓) запасной вариант, avoid (✗) ИСКЛЮЧИ\n"
    "   - 'ai' → подбирай оптимальный микс под бюджет/стратегию\n"
    "2. **Бюджет**:\n"
    "   - 'exact' → попадай в price_ranges[cat].from..to (±5%)\n"
    "   - 'luxe' / 'premium' / 'middle' / 'budget' → сам распредели бюджет по категориям:\n"
    "       холодильник ~25%, варочная ~12%, духовка ~15%, ПММ ~10%, вытяжка ~8%, СВЧ ~5%, кофемашина ~15%, стиралка ~10%\n"
    "3. **Стратегии подбора** (pick_strategies, multi — учитывай ВСЕ):\n"
    "   - 'reviews' → топ по отзывам пользователей\n"
    "   - 'balance' → оптимальное цена/качество\n"
    "   - 'premium_brand' → только премиум-имена (Miele, Gaggenau, Sub-Zero, V-ZUG, Asko)\n"
    "   - 'cheap' → надёжный минимум по цене\n"
    "   - 'tech' → топ функционал (Wi-Fi, инвертор, пар, авто-программы)\n"
    "   - 'style' → согласованный дизайн всей техники\n"
    "4. **Инфраструктура**:\n"
    "   - газ исключает индукцию; нет вентиляции → только рециркуляция (угольный фильтр)\n"
    "5. **Особенности (features)**: если клиент явно отметил — обязательно ставь модели с этими фичами\n"
    "6. ВАЖНО: каждую тех. фичу в highlights ОБЯЗАТЕЛЬНО объясняй простым языком в скобках.\n\n"
    "Примеры пояснений:\n"
    "  «NoFrost (не нужно размораживать вручную)»\n"
    "  «PowerBoost (форсаж — кипятит за минуту)»\n"
    "  «FlexZone (объединяет зоны под большую сковороду)»\n"
    "  «4D HotAir (конвекция с 4 сторон — равномерное запекание)»\n"
    "  «Термощуп (готовит до точной температуры)»\n"
    "  «AquaStop (защита от протечек)»\n"
    "  «Инвертор (тише и экономия ~30% электричества)»\n\n"
    "═══ ФОРМАТ ОТВЕТА ═══\n"
    "Количество моделей по категории определяется параметром `checklist.model_count` (3 / 5 / 7) — соблюдай!\n"
    "Каждая модель ДОЛЖНА содержать аналитику: pros (минимум 3), cons (минимум 2), почему выбрана, с чем сравнивать.\n"
    "По КАЖДОЙ категории напиши `analysis` — обзор: какие компромиссы, на что обратить внимание.\n"
    "Валидный JSON без markdown, без ```:\n"
    "{\n"
    '  "summary": "2-3 предложения общего вывода: что подобрали, почему этот набор, на чём сэкономили / куда вложились",\n'
    '  "by_category": {\n'
    '    "fridge": {\n'
    '      "analysis": "2-3 предложения: какие компромиссы в этой категории, какие модели для каких сценариев, на что смотреть при финальном выборе",\n'
    '      "models": [\n'
    '        {\n'
    '          "brand": "Haier",\n'
    '          "model": "C4F744CMG",\n'
    '          "price_min_rub": 79990,\n'
    '          "price_max_rub": 92000,\n'
    '          "search_query": "Haier C4F744CMG холодильник",\n'
    '          "manual_search_query": "Haier C4F744CMG manual инструкция pdf",\n'
    '          "highlights": ["NoFrost (не нужно размораживать)", "Инвертор (тише и -30% энергии)"],\n'
    '          "pros": ["тихий 36 дБ — на 4 дБ тише среднего по сегменту", "класс A++, экономия ~30% против A+", "большой объём 463 л против 380 л у конкурентов в той же ценовой категории"],\n'
    '          "cons": ["глубина 660 мм — на 60 мм больше стандартной ниши, проверить нишу клиента", "нет зоны свежести BioFresh — в этом плане Liebherr ровно вдвое лучше"],\n'
    '          "reasoning": "Лучший выбор по цена/качество в этом бюджете. Тише и больше чем Bosch в той же цене, но без премиум-зоны свежести.",\n'
    '          "specs": {\n'
    '            "dimensions_mm": "595×660×2000",\n'
    '            "weight_kg": 75,\n'
    '            "volume_l": 463,\n'
    '            "noise_db": 36,\n'
    '            "energy_class": "A++",\n'
    '            "color": "Нержавеющая сталь"\n'
    '          },\n'
    '          "tier": "middle",\n'
    '          "match_score": 0.92\n'
    "        }\n"
    "      ]\n"
    "    }\n"
    "  },\n"
    '  "total_price_estimate_rub": { "min": 320000, "max": 480000 },\n'
    '  "budget_status": "в_рамках|превышение|значительно_ниже",\n'
    '  "client_temperature": "premium|middle|budget|mixed",\n'
    '  "warnings": [],\n'
    '  "next_steps": ["рекомендации для менеджера: что уточнить с клиентом, что проверить на замере"]\n'
    "}\n\n"
    "═══ КРИТИЧНО ═══\n"
    "1. **Реальные модели**: артикулы должны существовать в природе (Haier C4F744CMG, Bosch Serie 4 KGN39NW00R, Liebherr CNd 5223 — НЕ «Bosch X-200» и НЕ «Haier выгодный»).\n"
    "2. **РЕАЛИИ РФ 2026**: Bosch/Siemens/Miele идут параллельным импортом — их цена в РФ выше официальных на 15-30%. Учитывай это.\n"
    "3. **Pros с числами**: НЕ «тихий» — а «36 дБ». НЕ «энергоэффективный» — а «класс A++, ~30% экономии». НЕ «вместительный» — а «463 л».\n"
    "4. **Cons обязательны**: даже у лучших моделей есть недостатки. Если cons пусто — модель не выбрана. Конкретные минусы: габарит больше ниши, шумнее на 2 дБ, без какой-то функции, цена выше на N%, длительная гарантия только N лет.\n"
    "5. **Reasoning**: 1 предложение «почему именно эта модель в этом наборе» — позиционирование относительно других в выдаче.\n"
    "6. **search_query**: точная строка для поиска (бренд + индекс + слово категория). AI агент будет парсить маркетплейсы по этой строке — не указывай лишнего.\n"
    "7. **manual_search_query**: строка для Google-поиска инструкции, в формате «<brand> <model> manual инструкция pdf»\n"
    "8. **specs ОБЯЗАТЕЛЬНЫ для проектирования кухни**:\n"
    "   - `dimensions_mm` — габариты ШхГxВ в мм (это критично для дизайна ниш в кухне ЗОВ)\n"
    "   - `weight_kg`, `volume_l` (для холодильников/духовок/ПММ), `noise_db`, `energy_class` ('A+++', 'A++', 'A+', 'A', 'B')\n"
    "   - `color` — основной цвет/материал\n"
    "9. **Количество моделей в каждой категории = `checklist.model_count`** (3 или 5 или 7). Меньше не возвращай. Если AI не уверен в N-й модели — добавь её всё равно из доступных в РФ.\n"
    "10. Бренд-стратегия 'single' — ВСЕ models из одной марки.\n"
    "11. price_min_rub/price_max_rub — диапазон по разным магазинам (если не уверен — один и тот же)."
)


def call_ai(user_prompt: str, system_prompt: str | None = None,
            temperature: float = 0.3, max_tokens: int = 8000) -> dict[str, Any]:
    """Вызов GigaChat. Возвращает {json, text, tokens, model, error?}."""
    cfg = get_config()
    try:
        token = _get_token()
    except Exception as e:
        return {"json": None, "text": f"AI auth: {e}", "tokens": 0, "model": cfg.gigachat_model, "error": True}

    payload = {
        "model": cfg.gigachat_model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system_prompt or SYSTEM_PROMPT_PICKER},
            {"role": "user", "content": user_prompt},
        ],
    }

    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(
                _CHAT_URL,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                content=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            )
    except Exception as e:
        return {"json": None, "text": f"AI network: {e}", "tokens": 0, "model": cfg.gigachat_model, "error": True}

    if resp.status_code >= 400:
        try:
            j = resp.json()
            err_msg = j.get("message") or (j.get("error") or {}).get("message") or resp.text[:300]
        except Exception:
            err_msg = resp.text[:300]
        return {"json": None, "text": f"AI HTTP {resp.status_code}: {err_msg}",
                "tokens": 0, "model": cfg.gigachat_model, "error": True}

    data = resp.json()
    choice = (data.get("choices") or [{}])[0]
    response_text = (choice.get("message") or {}).get("content", "")
    tokens = (data.get("usage") or {}).get("total_tokens", 0)
    actual_model = data.get("model", cfg.gigachat_model)

    json_obj = None
    if response_text:
        try:
            json_obj = json.loads(response_text)
        except json.JSONDecodeError:
            stripped = re.sub(r"^```(?:json)?\s*", "", response_text.strip())
            stripped = re.sub(r"\s*```\s*$", "", stripped)
            try:
                json_obj = json.loads(stripped)
            except json.JSONDecodeError:
                pass

    return {"json": json_obj, "text": response_text, "tokens": tokens, "model": actual_model}
