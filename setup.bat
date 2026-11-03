@echo off
rem ------------------------------------------------------------------
rem One-time setup. Double-click this file.
rem  1) checks Python  2) creates .venv  3) installs packages
rem  4) creates config.ini from config.example.ini and opens it
rem ASCII-only on purpose (see CLAUDE.md); chcp 65001 for Korean output.
rem ------------------------------------------------------------------
chcp 65001 > nul
setlocal
cd /d "%~dp0" || (pause & exit /b 1)

where python > nul 2>&1 || (
    echo [ERROR] Python not found.
    echo Install Python from https://www.python.org/downloads/
    echo and check "Add python.exe to PATH" during install. Then run this file again.
    pause
    exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
    echo [1/3] Creating Python environment...
    python -m venv .venv || (echo [ERROR] Failed to create .venv & pause & exit /b 1)
)

echo [2/3] Installing packages...
".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -q -r requirements.txt || (echo [ERROR] Package install failed & pause & exit /b 1)

if not exist "config.ini" (
    copy /y "config.example.ini" "config.ini" > nul || (echo [ERROR] Could not create config.ini & pause & exit /b 1)
    echo [3/3] config.ini created.
) else (
    echo [3/3] config.ini already exists. Keeping it.
)

echo.
echo Setup complete. Edit config.ini in Notepad, save, then double-click test_run.bat
start "" notepad "config.ini"
pause
endlocal
