@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set BRANCH=claude/employee-onboarding-offboarding-workflow-rqf49b

echo ============================================
echo  입퇴사자 관리 시스템 - 업데이트 후 로컬 실행
echo ============================================
echo.

where git >nul 2>nul
if errorlevel 1 (
    echo [오류] git이 설치되어 있지 않습니다. https://git-scm.com 에서 설치 후 다시 시도하세요.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo [오류] Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 설치 후 다시 시도하세요.
    pause
    exit /b 1
)

if not exist ".git" (
    echo [오류] 이 파일은 저장소 폴더 안에서 실행해야 합니다.
    echo         먼저 아래 명령으로 저장소를 받아주세요:
    echo.
    echo         git clone https://github.com/soan0131-dev/- 프로젝트폴더
    echo         cd 프로젝트폴더
    echo         git checkout %BRANCH%
    echo.
    pause
    exit /b 1
)

echo [1/5] 최신 코드 받아오는 중... (%BRANCH%)
git pull origin %BRANCH%
if errorlevel 1 (
    echo [오류] git pull에 실패했습니다. 위 메시지를 확인하세요.
    echo         커밋하지 않은 로컬 변경사항이 있으면 충돌할 수 있습니다.
    pause
    exit /b 1
)

if not exist ".env" (
    echo.
    echo [안내] .env 파일이 없어 .env.example을 복사합니다.
    copy /Y ".env.example" ".env" >nul
    echo [안내] 메모장이 열리면 DATABASE_URL 등을 본인 로컬 PostgreSQL 정보에 맞게
    echo         수정하고 저장한 뒤, 이 파일을 다시 실행해 주세요.
    notepad ".env"
    pause
    exit /b 0
)

echo.
echo [2/5] 패키지 설치/업데이트 중...
call npm install
if errorlevel 1 (
    echo [오류] npm install에 실패했습니다.
    pause
    exit /b 1
)

echo.
echo [3/5] 데이터베이스 마이그레이션 적용 중...
call npx prisma migrate deploy
if errorlevel 1 (
    echo [오류] 마이그레이션에 실패했습니다.
    echo         .env의 DATABASE_URL과 PostgreSQL 실행 상태를 확인하세요.
    pause
    exit /b 1
)

echo.
echo [4/5] 기준 데이터 확인 중... (부서/계정/체크리스트 템플릿, 이미 있으면 건너뜀)
call npm run db:seed

echo.
echo [5/5] 개발 서버를 시작합니다. 종료하려면 이 창에서 Ctrl+C를 누르세요.
echo   접속 주소: http://localhost:3000
echo.
call npm run dev

endlocal
pause
