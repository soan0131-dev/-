@echo off
rem ------------------------------------------------------------------
rem HR joiner/leaver mail notifier launcher (for Windows Task Scheduler)
rem
rem This file is ASCII-only on purpose so it runs under any code page.
rem chcp 65001 switches the console to UTF-8 so Korean log output
rem from Python is displayed correctly.
rem
rem Optional environment variables:
rem   HR_NOTIFIER_CONFIG   config file path   (default: config.ini next to this file)
rem   HR_NOTIFIER_PYTHON   python executable  (default: .venv\Scripts\python.exe, then python)
rem   HR_NOTIFIER_SMTP_USER / HR_NOTIFIER_SMTP_PASSWORD   SMTP credentials
rem
rem Extra arguments are passed to the program, e.g.  run_notifier.bat --dry-run
rem ------------------------------------------------------------------
chcp 65001 > nul
setlocal

set "SCRIPT_DIR=%~dp0"
set "PYTHONUTF8=1"

if not defined HR_NOTIFIER_CONFIG set "HR_NOTIFIER_CONFIG=%SCRIPT_DIR%config.ini"

if not defined HR_NOTIFIER_PYTHON (
    if exist "%SCRIPT_DIR%.venv\Scripts\python.exe" (
        set "HR_NOTIFIER_PYTHON=%SCRIPT_DIR%.venv\Scripts\python.exe"
    ) else (
        set "HR_NOTIFIER_PYTHON=python"
    )
)

cd /d "%SCRIPT_DIR%" || exit /b 1
"%HR_NOTIFIER_PYTHON%" -m hr_notifier --config "%HR_NOTIFIER_CONFIG%" %*
set "RC=%ERRORLEVEL%"

endlocal & exit /b %RC%
