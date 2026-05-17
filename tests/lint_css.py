"""
CSS-линтер для miniapp/assets/
Запуск: python tests/lint_css.py
Возвращает exit code 1 если найдены проблемы.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent / "miniapp" / "assets"

ISSUES = []


def issue(file: str, line: int, msg: str):
    ISSUES.append(f"  ❌  {file}:{line}  {msg}")


# ─── Правила ────────────────────────────────────────────────────────────────

# 1. Запрещённые паттерны скрытия текста
FORBIDDEN_COLOR_PATTERNS = [
    (
        # Только свойство color:, но НЕ -webkit-tap-highlight-color:
        r"(?<![a-z-])color\s*:\s*transparent",
        "color:transparent создаёт дырку — используй opacity:0 или жёсткий HEX",
    ),
]

# 2. Классы для которых color:var(--card) запрещён (текст на карточке)
TEXT_CLASSES = [
    r"\.client-name", r"\.client-phone", r"\.client-footer",
    r"\.client-arrow", r"\.measurement-\w+", r"\.assembly-card-\w+",
]

# 3. Классы у которых ОБЯЗАТЕЛЬНО должен быть явный color:
REQUIRED_COLOR_CLASSES = [
    r"\.client-name", r"\.client-phone",
    r"\.assembly-card-name", r"\.assembly-card-status",
]

# ─── Анализ файлов ──────────────────────────────────────────────────────────

def lint_file(path: Path):
    text = path.read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    fname = path.name

    # Разбираем CSS-блоки
    current_selector = ""
    block_lines = []
    brace_depth = 0
    block_start = 0

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        if brace_depth == 0 and stripped and not stripped.startswith("/*"):
            # Накапливаем селектор (может быть многострочным)
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
                _lint_block(fname, current_selector, block_lines, block_start, i)
                current_selector = ""
                block_lines = []

        # Построчные проверки
        for pattern, msg in FORBIDDEN_COLOR_PATTERNS:
            if re.search(pattern, stripped, re.IGNORECASE):
                issue(fname, i, msg)


def _lint_block(fname, selector, block_lines, start_line, end_line):
    block_text = " ".join(block_lines)

    # Правило 1: color:var(--card) в текстовых классах
    if re.search(r"color\s*:\s*var\(--card\)", block_text, re.IGNORECASE):
        for pat in TEXT_CLASSES:
            if re.search(pat, selector):
                issue(
                    fname, start_line,
                    f"`{selector.strip()}` использует color:var(--card) — "
                    f"не совпадает с фоном карточки в тёмных темах. Используй HEX или opacity:0",
                )

    # Правило 2: color:var(--paper) в текстовых классах
    if re.search(r"color\s*:\s*var\(--paper\)", block_text, re.IGNORECASE):
        for pat in TEXT_CLASSES:
            if re.search(pat, selector):
                issue(
                    fname, start_line,
                    f"`{selector.strip()}` использует color:var(--paper) — "
                    f"может не совпасть с фоном в других темах. Используй HEX",
                )

    # Правило 3: обязательные классы должны иметь явный color:
    has_color = bool(re.search(r"\bcolor\s*:", block_text))
    for pat in REQUIRED_COLOR_CLASSES:
        if re.search(pat, selector) and not has_color:
            issue(
                fname, start_line,
                f"`{selector.strip()}` не имеет явного color: — "
                f"текст унаследует цвет от body и может быть невидим или слишком ярким",
            )


# ─── Проверка версий в index.html ──────────────────────────────────────────

def lint_versions():
    index = Path(__file__).parent.parent / "miniapp" / "index.html"
    if not index.exists():
        return

    text = index.read_text(encoding="utf-8")
    versions = {}

    # Собираем версии из href/src
    for m in re.finditer(r'(?:href|src)="assets/([^"]+)\?v=([^"]+)"', text):
        fname, ver = m.group(1), m.group(2)
        versions[fname] = ver

    # Проверяем что CSS и JS версии не слишком старые (> 30 дней назад)
    from datetime import datetime
    today_str = datetime.now().strftime("%Y%m%d")
    for fname, ver in versions.items():
        if re.match(r"^\d{8}", ver):
            file_date = ver[:8]
            # Сравниваем как строки (работает для YYYYMMDD)
            days_diff = (datetime.strptime(today_str, "%Y%m%d") -
                         datetime.strptime(file_date, "%Y%m%d")).days
            if days_diff > 30:
                ISSUES.append(
                    f"  ⚠️  index.html: {fname} версия «{ver}» устарела "
                    f"на {days_diff} дней — возможно забыли обновить версию при последнем изменении"
                )

    # Форматы версии должны совпадать с шаблоном YYYYMMDDx
    for fname, ver in versions.items():
        if not re.match(r"^\d{8}[a-z]$", ver):
            ISSUES.append(
                f"  ⚠️  index.html: {fname} версия «{ver}» не соответствует формату "
                f"YYYYMMDDx (например 20260517j)"
            )


# ─── Main ───────────────────────────────────────────────────────────────────

def main():
    print("🔍 CSS-линтер miniapp/assets/\n")

    css_files = list(ROOT.glob("*.css"))
    if not css_files:
        print("  Нет CSS-файлов для анализа.")
        sys.exit(0)

    for f in sorted(css_files):
        lint_file(f)

    lint_versions()

    if ISSUES:
        print("Найдены проблемы:\n")
        for iss in ISSUES:
            print(iss)
        print(f"\n🚫 Итого: {len(ISSUES)} замечание(й). Исправь перед коммитом.\n")
        sys.exit(1)
    else:
        print("✅ Всё чисто — замечаний нет.\n")
        sys.exit(0)


if __name__ == "__main__":
    main()
