#!/usr/bin/env bash
# =============================================================
# Claude Code — PostToolUse hook: syntax check after Edit/Write
# Reads tool input JSON from stdin, extracts file_path,
# runs language-appropriate syntax check.
# Exit 2 → Claude sees the error and can fix it immediately.
# =============================================================

set -euo pipefail

# Parse file_path from JSON stdin (jq if available, else python fallback)
if command -v jq &>/dev/null; then
  FILE_PATH=$(echo "$CLAUDE_TOOL_INPUT" | jq -r '.file_path // empty' 2>/dev/null || true)
else
  FILE_PATH=$(python3 -c "
import sys, json
try:
    d = json.loads(sys.stdin.read())
    print(d.get('file_path', ''))
except Exception:
    pass
" <<< "$CLAUDE_TOOL_INPUT" 2>/dev/null || true)
fi

# Also try env var set by Claude Code
FILE_PATH="${FILE_PATH:-${CLAUDE_TOOL_INPUT_FILE_PATH:-}}"

if [[ -z "$FILE_PATH" || ! -f "$FILE_PATH" ]]; then
  exit 0
fi

EXT="${FILE_PATH##*.}"

case "$EXT" in
  js)
    if ! OUTPUT=$(node --check "$FILE_PATH" 2>&1); then
      echo "❌ JS SYNTAX ERROR: $FILE_PATH"
      echo "$OUTPUT"
      exit 2
    fi
    ;;
  py)
    if ! OUTPUT=$(python3 -c "
import py_compile, sys
try:
    py_compile.compile('$FILE_PATH', doraise=True)
except py_compile.PyCompileError as e:
    print(e)
    sys.exit(1)
" 2>&1); then
      echo "❌ PY SYNTAX ERROR: $FILE_PATH"
      echo "$OUTPUT"
      exit 2
    fi
    ;;
  *)
    # Остальные типы файлов — пропускаем
    exit 0
    ;;
esac

exit 0
