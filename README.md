# 일정 가능 여부 확인 (Schedule Availability)

여러 명이 함께 만날 날짜를 잡을 때, 각자 가능한 날짜를 캘린더에 표시하고
가장 많은 인원이 겹치는 날을 자동으로 찾아주는 간단한 웹 앱입니다.

## 사용 방법

1. 서버 실행
   ```bash
   node server.js
   ```
   기본 포트는 `3000`이며 브라우저에서 `http://localhost:3000` 으로 접속합니다.

2. **새 일정 만들기** 화면에서 제목과 기간(시작일~종료일)을 입력하고
   "일정 만들기"를 누르면 공유 가능한 링크가 생성됩니다.

3. 생성된 링크를 참가자들에게 공유합니다. 각자 접속해서 본인 이름을 입력하고,
   가능한 날짜 칸을 클릭해 체크합니다. (입력은 자동 저장됩니다.)

4. 표 하단의 **합계** 행과 상단의 배너에서 가장 많은 인원이 가능한 날짜를
   바로 확인할 수 있습니다.

## 환경 변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PORT` | `3000` | 서버가 사용할 포트 |
| `DATA_DIR` | `./data` | 일정 데이터(JSON)를 저장할 디렉터리 |
| `MAX_RANGE_DAYS` | `62` | 하나의 일정에 허용되는 최대 기간(일) |

예시:
```bash
PORT=4000 DATA_DIR=/var/data/schedule node server.js
```

## 구조

- `server.js` — 별도 의존성 없이 Node.js 내장 모듈만으로 동작하는 정적 파일 서버 + REST API
- `public/` — 프런트엔드 (바닐라 HTML/CSS/JS)
- `data/events.json` — 일정 및 참가자별 가능 날짜 데이터 (런타임에 생성됨, git에는 포함되지 않음)

## API

- `POST /api/events` — `{ title, startDate, endDate }` 로 일정 생성, `{ id }` 반환
- `GET /api/events/:id` — 일정 및 참가자별 가능 날짜 조회
- `PUT /api/events/:id/participants` — `{ name, dates: string[] }` 로 참가자의 가능 날짜 저장
