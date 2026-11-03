# 입퇴사자 알림 서비스 (hr_notifier)

인사팀이 관리하는 입퇴사자 명단(엑셀/CSV)을 정기적으로 읽어, 담당 부서별로 **업무 처리 요청 메일**을 보냅니다. IT(계정·장비), 총무(출입카드·좌석), 보안 등 부서마다 처리 항목 체크리스트를 붙여 보냅니다.

Windows 작업 스케줄러로 하루 1~N회 실행하는 것을 전제로 만들었습니다.

## 동작 방식

1. `[input] path` 에 지정한 명단 파일(`.csv` / `.xlsx`)을 읽습니다.
2. 입사일/퇴사일이 **오늘 − past_days ~ 오늘 + lead_days** 범위에 있는 사람을 알림 대상으로 고릅니다.
3. 담당 부서(`[team:부서명]`)마다 아직 보내지 않은 대상을 모아 **메일 한 통**으로 보냅니다.
4. 발송에 성공한 건은 `state/sent.json` 에 기록하므로 다시 보내지 않습니다. 발송에 실패한 채널은 다음 실행 때 다시 시도합니다.

## 명단 파일 위치

기본 설정은 OneDrive의 `인사업무-이소안\1. 인사\입퇴사자현황.xlsx` 를 읽습니다. 경로는 `config.ini` 의 `[input] path` 에서 바꿀 수 있습니다.

```ini
path = %OneDriveCommercial%\인사업무-이소안\1. 인사\입퇴사자현황.xlsx
```

`%OneDriveCommercial%` 은 Windows가 회사 OneDrive 폴더(`C:\Users\<사용자>\OneDrive - BDO Korea`)로 자동 설정하는 환경 변수입니다.

OneDrive 파일을 읽으려면 다음 조건이 필요합니다.

- **본인 계정으로 실행**: 작업 스케줄러를 다른 계정(서비스 계정 등)으로 실행하면 내 OneDrive 폴더를 읽을 수 없습니다.
- **PC 로그인·동기화 상태**: 예약 시간에 PC가 켜져 있고 OneDrive가 로그인되어 있어야 합니다. 파일이 "온라인 전용"이면 실행할 때 자동으로 내려받습니다.
- **Excel에서 열려 있어도 됨**: 읽기만 하므로 파일이 Excel에 열려 있어도 동작합니다. 다만 저장하지 않은 수정 내용은 반영되지 않습니다.

## 명단 파일 형식

한 시트 안에 **입사자 표(A~E열)** 와 **퇴사자 표(Z~AC열)** 가 나란히 있는 형식을 읽습니다.

```
      A      B      C       D      E        ...   Z      AA       AB      AC
 1  2026년 입퇴사자 현황
 2
 3  사번   성명   부서    직급   입사일    ...   성명   부서     직급    퇴사일
 4  ...    홍길동 재무팀  사원   2026-11-05 ...  김철수 감사본부 매니저  2026-11-07
```

- 표마다 열 범위(`range`)와 헤더 이름을 `config.ini` 의 `[join]`(입사자), `[leave]`(퇴사자) 에서 지정합니다.
- 성명과 일자는 필수입니다. 사번·부서·직급·이메일은 없으면 설정에서 지우면 됩니다. 사번이 없는 표는 부서와 성명으로 사람을 구분합니다.
- 입사자 표와 퇴사자 표의 길이가 달라도 됩니다. 표 범위 안이 빈 행은 건너뜁니다.
- 상단에 제목·작성일 행이 있어도 됩니다. 표마다 상위 30행 안에서 설정한 헤더가 모두 있는 행을 자동으로 찾습니다. 헤더 안의 공백·줄바꿈 차이는 무시합니다.
- 일자는 `2026-11-05`, `2026.11.05`, `2026/11/05`, `20261105` 형식과 엑셀 날짜 셀을 모두 인식합니다.
- 형식이 잘못된 행은 건너뛰고, 몇 번째 행인지 로그에 경고로 남깁니다.

예시: [`samples/sample_roster.csv`](samples/sample_roster.csv)

## 설치

```bat
cd C:\hr_notifier
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
copy config.example.ini config.ini
```

`config.ini` 를 환경에 맞게 수정합니다. 파일은 UTF-8로 저장하세요.

SMTP 계정은 설정 파일에 적지 말고 **환경 변수**로 지정합니다. 작업 스케줄러가 실행하는 계정(본인 계정)에서 설정하세요.

```bat
setx HR_NOTIFIER_SMTP_USER "hr-noti@example.com"
setx HR_NOTIFIER_SMTP_PASSWORD "********"
```

## 실행

```bat
:: 메일을 보내지 않고 대상과 본문만 확인
run_notifier.bat --dry-run

:: 기준일을 지정해 확인
run_notifier.bat --dry-run --today 2026-11-03

:: 실제 발송
run_notifier.bat
```

종료 코드: `0` 정상, `1` 명단 오류 또는 일부 발송 실패, `2` 설정 오류

### 작업 스케줄러 등록 (예: 평일 오전 8시 40분)

```bat
schtasks /Create /TN "HR Notifier" /TR "\"C:\hr_notifier\run_notifier.bat\"" /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 08:40 /IT
```

`/RU` 를 생략하면 현재 로그인한 본인 계정으로 실행됩니다. `/IT` 를 주면 로그인해 있을 때만 실행되므로 OneDrive 파일에 접근할 수 있습니다.

### 실행기(`run_notifier.bat`)가 쓰는 환경 변수

| 변수 | 기본값 |
|---|---|
| `HR_NOTIFIER_CONFIG` | 배치 파일과 같은 폴더의 `config.ini` |
| `HR_NOTIFIER_PYTHON` | `.venv\Scripts\python.exe`, 없으면 `python` |

배치 파일은 코드페이지와 상관없이 동작하도록 ASCII 문자로만 작성했습니다. 또 `chcp 65001` 과 `PYTHONUTF8=1` 을 설정해 한글 로그가 깨지지 않게 했습니다.

## 개발

```bash
python -m unittest -v
```

| 모듈 | 역할 |
|---|---|
| `hr_notifier/config.py` | INI 설정 로딩 및 검증, SMTP 계정은 환경 변수에서 읽음 |
| `hr_notifier/reader.py` | CSV / XLSX 읽기, 열 범위로 표 잘라내기 |
| `hr_notifier/records.py` | 행 → 입퇴사 이벤트 변환, 날짜 파싱 |
| `hr_notifier/templates.py` | 업무 처리 요청 메일 본문 (text + HTML) |
| `hr_notifier/mailer.py` | SMTP 발송 (연결 1개 재사용, dry-run 지원) |
| `hr_notifier/state.py` | 발송 이력 저장 (원자적 쓰기, 오래된 기록 정리) |
| `hr_notifier/app.py` | 전체 실행 흐름 |
