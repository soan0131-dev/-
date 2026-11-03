# 입퇴사자 알림 서비스 (hr_notifier)

인사팀이 관리하는 입퇴사자 명단(엑셀/CSV)을 정기적으로 읽어, 담당 부서별로 **업무 처리 요청 메일**을 보냅니다. IT(계정·장비), 총무(출입카드·좌석), 보안 등 부서마다 처리 항목 체크리스트를 붙여 보냅니다.

Windows 작업 스케줄러로 하루 1~N회 실행하는 것을 전제로 만들었습니다.

## 동작 방식

1. `[input] path` 에 지정한 명단 파일(`.csv` / `.xlsx`)을 읽습니다.
2. 입사일/퇴사일이 **오늘 − past_days ~ 오늘 + lead_days** 범위에 있는 사람을 알림 대상으로 고릅니다.
3. 담당 부서(`[team:부서명]`)마다 아직 보내지 않은 대상을 모아 **메일 한 통**으로 보냅니다.
4. 발송에 성공한 건은 `state/sent.json` 에 기록하므로 다시 보내지 않습니다. 발송에 실패한 채널은 다음 실행 때 다시 시도합니다.

## 명단 파일 형식

| 사번 | 성명 | 부서 | 직급 | 구분 | 일자 | 이메일 |
|---|---|---|---|---|---|---|
| 20261101 | 홍길동 | 재무팀 | 사원 | 입사 | 2026-11-05 | gildong.hong@example.com |

- 헤더 이름은 설정 파일의 `[columns]` 에서 바꿀 수 있습니다. 직급과 이메일은 없어도 됩니다.
- 일자는 `2026-11-05`, `2026.11.05`, `2026/11/05`, `20261105` 형식과 엑셀 날짜 셀을 모두 인식합니다.
- CSV는 UTF-8(BOM 포함)과 CP949를 자동으로 판별합니다.
- 형식이 잘못된 행은 건너뛰고 로그에 경고로 남깁니다.

예시: [`samples/sample_roster.csv`](samples/sample_roster.csv)

## 설치

```bat
cd C:\hr_notifier
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
copy config.example.ini config.ini
```

`config.ini` 를 환경에 맞게 수정합니다. 파일은 UTF-8로 저장하세요.

SMTP 계정은 설정 파일에 적지 말고 **환경 변수**로 지정합니다. 작업을 실행하는 서비스 계정에 설정하세요.

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
schtasks /Create /TN "HR Notifier" /TR "\"C:\hr_notifier\run_notifier.bat\"" /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 08:40 /RU "DOMAIN\svc_hrnoti" /RP
```

`/RU` 에는 명단 파일 공유 폴더를 읽을 권한이 있는 서비스 계정을 지정합니다.

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
| `hr_notifier/reader.py` | CSV / XLSX 읽기 |
| `hr_notifier/records.py` | 행 → 입퇴사 이벤트 변환, 날짜 파싱 |
| `hr_notifier/templates.py` | 업무 처리 요청 메일 본문 (text + HTML) |
| `hr_notifier/mailer.py` | SMTP 발송 (연결 1개 재사용, dry-run 지원) |
| `hr_notifier/state.py` | 발송 이력 저장 (원자적 쓰기, 오래된 기록 정리) |
| `hr_notifier/app.py` | 전체 실행 흐름 |
