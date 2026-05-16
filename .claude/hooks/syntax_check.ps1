# ================================================================
# Claude Code — PostToolUse hook (Windows PowerShell fallback)
# Syntax check after every Edit / Write tool call.
# Exit code 2 = Claude sees the error and can fix immediately.
# ================================================================

param()

# Read file_path from CLAUDE_TOOL_INPUT env var (JSON)
$filePath = ""
try {
    $input_json = $env:CLAUDE_TOOL_INPUT | ConvertFrom-Json -ErrorAction Stop
    $filePath = $input_json.file_path
} catch {}

if (-not $filePath -or -not (Test-Path $filePath)) { exit 0 }

$ext = [System.IO.Path]::GetExtension($filePath).TrimStart('.')

switch ($ext) {
    "js" {
        $result = & node --check $filePath 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Output "❌ JS SYNTAX ERROR: $filePath"
            Write-Output $result
            exit 2
        }
    }
    "py" {
        $escaped = $filePath -replace "'", "''"
        $result = & python -c "import py_compile,sys; py_compile.compile('$escaped', doraise=True)" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Output "❌ PY SYNTAX ERROR: $filePath"
            Write-Output $result
            exit 2
        }
    }
    default { exit 0 }
}

exit 0
