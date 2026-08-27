@echo off
setlocal enabledelayedexpansion

set BRANCH=claude/employee-onboarding-offboarding-workflow-rqf49b

echo ============================================
echo  Employee Onboarding System - Update and Run
echo ============================================
echo.

where git >nul 2>nul
if errorlevel 1 (
    echo [ERROR] git is not installed or not on PATH.
    echo         Install it from https://git-scm.com then try again.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not on PATH.
    echo         Install it from https://nodejs.org then close this
    echo         window, open a NEW Command Prompt, and run this file again.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm was not found on PATH even though node was found.
    echo         Try closing this window, opening a NEW Command Prompt,
    echo         and running this file again. If it still fails, reinstall
    echo         Node.js from https://nodejs.org and make sure to check
    echo         "Add to PATH" during setup.
    pause
    exit /b 1
)

if not exist ".git" (
    echo [ERROR] This file must be run from inside the project folder.
    echo         First run:
    echo.
    echo         git clone https://github.com/soan0131-dev/- project-folder
    echo         cd project-folder
    echo         git checkout %BRANCH%
    echo.
    pause
    exit /b 1
)

echo [1/6] Pulling latest code... (%BRANCH%)
git pull origin %BRANCH%
if errorlevel 1 (
    echo [ERROR] git pull failed. See the message above.
    echo         Uncommitted local changes may be causing a conflict.
    pause
    exit /b 1
)

if not exist ".env" (
    echo.
    echo [INFO] .env file not found, copying from .env.example.
    copy /Y ".env.example" ".env" >nul
    echo [INFO] Notepad will open. Edit DATABASE_URL etc. to match your
    echo        local PostgreSQL, save, then run this file again.
    notepad ".env"
    pause
    exit /b 0
)

echo.
echo [2/6] Installing/updating packages...
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)

echo.
echo [3/6] Generating Prisma Client...
call npx prisma generate
if errorlevel 1 (
    echo [ERROR] Prisma Client generation failed.
    pause
    exit /b 1
)

echo.
echo [4/6] Applying database migrations...
call npx prisma migrate deploy
if errorlevel 1 (
    echo [ERROR] Migration failed.
    echo         Check DATABASE_URL in .env and that PostgreSQL is running.
    pause
    exit /b 1
)

echo.
echo [5/6] Checking baseline data... (departments/accounts/templates, skips if already present)
call npm run db:seed

echo.
echo [6/6] Starting dev server. Press Ctrl+C in this window to stop.
echo   Open: http://localhost:3000
echo.
call npm run dev

endlocal
pause
