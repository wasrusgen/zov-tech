"""
CSS-линтер для miniapp/assets/
Проверяет: запрещённые паттерны, читаемость цветов (контраст WCAG),
           явные цвета в ключевых классах, версии кэша.
Запуск: python -X utf8 tests/lint_css.py
Возвращает exit code 1 если найдены проблемы.
"""

import re
import sys
import math
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).parent.parent / "miniapp" / "assets"

ISSUES   = []   # критические — блокируют коммит
WARNINGS = []   # предупреждения — не блокируют, но стоит исправить


def issue(file: str, line: int, msg: str):
    ISSUES.append(f"  ❌  {file}:{line}  {msg}")

def warn(file: str, line: int, msg: str):
    WARNINGS.append(f"  ⚠️   {file}:{line}  {msg}")


# ════════════════════════════════════════════════════════════════
#  WCAG-контраст
# ════════════════════════════════════════════════════════════════

def _hex_to_rgb(h: str) -> tuple[int, int, int] | None:
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c*2 for c in h)
    if len(h) != 6:
        return None
    try:
        return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    except ValueError:
        return None


def _relative_luminance(r: int, g: int, b: int) -> float:
    def c(x):
        x /= 255
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)


def contrast_ratio(hex1: str, hex2: str) -> float | None:
    rgb1 = _hex_to_rgb(hex1)
    rgb2 = _hex_to_rgb(hex2)
    if not rgb1 or not rgb2:
        return None
    L1 = _relative_luminance(*rgb1)
    L2 = _relative_luminance(*rgb2)
    lighter, darker = max(L1, L2), min(L1, L2)
    return (lighter + 0.05) / (darker + 0.05)


def contrast_grade(ratio: float | None) -> str:
    if ratio is None:
        return "?"
    if ratio >= 7.0:
        return "AAA"
    if ratio >= 4.5:
        return "AA"
    if ratio >= 3.0:
        return "AA-Large"
    return "FAIL"


# Известные фоны карточек по темам (для проверки текста без background в блоке)
CARD_BACKGROUNDS = [
    "#FFFFFF",   # Default light
    "#EAE3CC",   # Foundry
    "#EDE5D0",   # Boardroom
    "#E9EBEF",   # Atelier
]
PAGE_BACKGROUNDS = [
    "#FAFAF7",   # Default light
    "#14130E",   # Default dark
    "#EFE9D8",   # Foundry
    "#F2E9D6",   # Boardroom
    "#E9EBEF",   # Atelier
]


# ════════════════════════════════════════════════════════════════
#  Паттерны-запреты (построчные)
# ════════════════════════════════════════════════════════════════

FORBIDDEN_LINE_PATTERNS = [
    (
        r"(?<![a-z-])color\s*:\s*transparent",
        "color:transparent создаёт дырку сквозь карточку — используй opacity:0 или HEX",
    ),
]

# ════════════════════════════════════════════════════════════════
#  Классы — правила по селекторам
# ════════════════════════════════════════════════════════════════

# Текстовые классы: color:var(--card)/var(--paper) запрещены
TEXT_ON_CARD_CLASSES = [
    r"\.client-name", r"\.client-phone", r"\.client-footer",
    r"\.client-arrow", r"\.client-detail-name", r"\.client-detail-meta",
    r"\.assembly-card-\w+", r"\.measurement-card-\w+",
    r"\.proposal-\w+", r"\.kicker", r"\.display-title",
    r"\.lede", r"\.block-head",
]

# Классы у которых ОБЯЗАТЕЛЬНО должен быть явный color:
REQUIRED_EXPLICIT_COLOR = [
    r"\.client-name", r"\.client-phone",
    r"\.assembly-card-name", r"\.assembly-card-status", r"\.assembly-card-address",
    r"\.measurement-card-name", r"\.measurement-card-address",
]


# ════════════════════════════════════════════════════════════════
#  Парсинг и анализ блоков
# ════════════════════════════════════════════════════════════════

def lint_file(path: Path):
    text = path.read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    fname = path.name

    current_selector = ""
    block_lines: list[str] = []
    brace_depth = 0
    block_start = 0

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # Построчные проверки
        for pattern, msg in FORBIDDEN_LINE_PATTERNS:
            if re.search(pattern, stripped, re.IGNORECASE):
                issue(fname, i, msg)

        if brace_depth == 0 and stripped and not stripped.startswith("/*"):
            if "{" in stripped:
                current_selector += stripped.split("{")[0].strip()
                brace_depth = stripped.count("{") - stripped.count("}")
                block_start = i
                block_lines = [stripped]
            else:
                current_selector += " " + stripped
        elif brace_depth > 0:
            brace_depth += stripped.count("{") - stripped.count("}")
            block_lines.append(stripped)
            if brace_depth == 0:
                _lint_block(fname, current_selector.strip(), block_lines, block_start)
                current_selector = ""
                block_lines = []


def _lint_block(fname: str, selector: str, block_lines: list[str], start_line: int):
    block_text = " ".join(block_lines)

    # ── Запрет var(--card) / var(--paper) для текстовых классов ──
    for bad_var in (r"var\(--card\)", r"var\(--paper\)"):
        if re.search(rf"(?<![a-z-])color\s*:\s*{bad_var}", block_text, re.IGNORECASE):
            for pat in TEXT_ON_CARD_CLASSES:
                if re.search(pat, selector):
                    var_name = re.search(r"var\(--\w+\)", bad_var).group()
                    issue(fname, start_line,
                          f"`{selector}` color:{var_name} — ненадёжный цвет, "
                          f"зависит от темы Telegram. Используй жёсткий HEX")

    # ── Обязательный явный color: ──
    has_color = bool(re.search(r"(?<![a-z-])color\s*:", block_text))
    for pat in REQUIRED_EXPLICIT_COLOR:
        if re.search(pat, selector) and not has_color:
            issue(fname, start_line,
                  f"`{selector}` не имеет явного color: — "
                  f"текст унаследует цвет от body, может слиться с фоном")

    # ── WCAG-контраст: если в блоке есть и color и background — проверяем ──
    color_hex   = _extract_hex(block_text, r"(?<![a-z-])color\s*:\s*(#[0-9a-fA-F]{3,8})")
    bg_hex      = _extract_hex(block_text,
                               r"background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8})")

    if color_hex and bg_hex:
        ratio = contrast_ratio(color_hex, bg_hex)
        grade = contrast_grade(ratio)
        if grade == "FAIL":
            issue(fname, start_line,
                  f"`{selector}` контраст {ratio:.1f}:1 ({color_hex} на {bg_hex}) — "
                  f"WCAG FAIL, текст нечитаем. Нужно ≥ 4.5:1")
        elif grade == "AA-Large":
            warn(fname, start_line,
                 f"`{selector}` контраст {ratio:.1f}:1 ({color_hex} на {bg_hex}) — "
                 f"только для крупного текста (≥18pt). Для мелкого нужно ≥ 4.5:1")

    # ── WCAG: если есть только color HEX — проверяем против всех фонов карточек ──
    if color_hex and not bg_hex:
        # Проверяем только текстовые классы
        is_text_class = any(re.search(p, selector) for p in TEXT_ON_CARD_CLASSES)
        if is_text_class:
            _check_color_against_known_backgrounds(fname, start_line, selector, color_hex)


def _extract_hex(text: str, pattern: str) -> str | None:
    m = re.search(pattern, text, re.IGNORECASE)
    return m.group(1) if m else None


def _check_color_against_known_backgrounds(
    fname: str, line: int, selector: str, color_hex: str
):
    """Проверяет цвет текста против всех известных фонов карточек."""
    fails = []
    for bg in CARD_BACKGROUNDS:
        ratio = contrast_ratio(color_hex, bg)
        if ratio is not None and ratio < 4.5:
            fails.append(f"{bg}={ratio:.1f}:1")

    if len(fails) == len(CARD_BACKGROUNDS):
        # Плохой контраст против ВСЕХ фонов — критично
        issue(fname, line,
              f"`{selector}` color:{color_hex} — низкий контраст против всех "
              f"фонов карточек: {', '.join(fails)}. Текст нечитаем во всех темах")
    elif fails:
        warn(fname, line,
             f"`{selector}` color:{color_hex} — низкий контраст в некоторых темах: "
             f"{', '.join(fails)}. Проверь Foundry/Boardroom/Atelier")


# ════════════════════════════════════════════════════════════════
#  Проверка версий в index.html
# ════════════════════════════════════════════════════════════════

def lint_versions():
    index = Path(__file__).parent.parent / "miniapp" / "index.html"
    if not index.exists():
        return

    text  = index.read_text(encoding="utf-8")
    versions: dict[str, str] = {}

    for m in re.finditer(r'(?:href|src)="assets/([^"]+)\?v=([^"]+)"', text):
        versions[m.group(1)] = m.group(2)

    today = datetime.now().strftime("%Y%m%d")
    for fname, ver in versions.items():
        if re.match(r"^\d{8}", ver):
            days_diff = (datetime.strptime(today, "%Y%m%d") -
                         datetime.strptime(ver[:8], "%Y%m%d")).days
            if days_diff > 30:
                warn("index.html", 0,
                     f"{fname} версия «{ver}» не обновлялась {days_diff} дней — "
                     f"проверь, не забыли ли поднять версию после изменений")

        if not re.match(r"^\d{8}[a-z]$", ver):
            warn("index.html", 0,
                 f"{fname} версия «{ver}» не соответствует формату YYYYMMDDx")


# ════════════════════════════════════════════════════════════════
#  Main
# ════════════════════════════════════════════════════════════════

def main():
    print("🔍 CSS-линтер miniapp/assets/\n")

    for f in sorted(ROOT.glob("*.css")):
        lint_file(f)

    lint_versions()

    if WARNINGS:
        print("Предупреждения (не блокируют, но стоит исправить):\n")
        for w in WARNINGS:
            print(w)
        print()

    if ISSUES:
        print("Критические проблемы (блокируют коммит):\n")
        for iss in ISSUES:
            print(iss)
        print(f"\n🚫 Итого: {len(ISSUES)} ошибок, {len(WARNINGS)} предупреждений. "
              f"Исправь ошибки перед коммитом.\n")
        sys.exit(1)
    elif WARNINGS:
        print(f"⚠️  Итого: 0 ошибок, {len(WARNINGS)} предупреждений.\n")
        sys.exit(0)
    else:
        print("✅ Всё чисто — ни ошибок, ни предупреждений.\n")
        sys.exit(0)


if __name__ == "__main__":
    main()
