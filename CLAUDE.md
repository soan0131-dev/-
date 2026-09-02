# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Status

이 저장소는 "일정 가능 여부 확인(Schedule Availability)" 웹 앱을 담고 있습니다.
여러 참가자가 각자 가능한 날짜를 캘린더에 표시하면, 가장 많은 인원이 겹치는 날짜를
자동으로 계산해서 보여주는 도구입니다.

### 구조

- `server.js` — Node.js 내장 모듈(`http`, `fs`, `crypto`)만 사용하는 정적 파일 서버 + REST API. 외부 의존성 없음.
- `public/` — 바닐라 HTML/CSS/JS 프런트엔드 (`index.html`, `style.css`, `app.js`).
- `data/` — 일정 데이터(JSON)가 런타임에 저장되는 디렉터리. `data/*.json`은 git에 커밋되지 않음(`.gitignore` 참고).

### 실행 방법

```bash
node server.js
```
기본 포트는 `PORT` 환경 변수(기본값 3000)로 설정하며, `DATA_DIR`, `MAX_RANGE_DAYS` 등도
환경 변수로 조정합니다. 자세한 내용은 `README.md` 참고.

### 빌드/테스트

별도의 빌드 단계나 자동화된 테스트 스위트는 아직 없습니다. 코드 검증은 `node server.js`로
서버를 띄운 뒤 브라우저에서 직접 동작을 확인하는 방식입니다. 테스트를 추가하게 되면
이 섹션을 실제 명령어로 갱신할 것.

## Development Guidelines

These rules apply to all work in this repository, regardless of what gets built here:

- **BAT 파일 인코딩**: `.bat` 파일을 생성할 때는 한글(또는 비ASCII 문자) 인코딩에 주의한다. Windows 배치 파일은 기본적으로 시스템 로케일 코드페이지(예: CP949/EUC-KR)를 사용하므로, 파일을 UTF-8로 저장할 경우 스크립트 첫 줄에 `chcp 65001`을 추가하거나, 처음부터 ANSI/CP949로 저장하는 등 실행 환경과 인코딩을 맞춰야 한다. 인코딩 불일치로 한글이 깨지거나 스크립트가 오작동하지 않도록 항상 확인한다.
- **효율적인 코드**: 불필요한 반복 연산, 중복 파일 I/O, 과도한 프로세스 생성 등을 피하고 항상 효율적인 방식으로 코드를 작성한다.
- **하드코딩 금지**: 경로, URL, 자격 증명, 포트 번호, 환경별 값 등을 코드에 직접 박아넣지 않는다. 설정 파일, 환경 변수, 인자 등을 통해 값을 주입한다.
- **보안 고려**: 커맨드/스크립트 인젝션, 자격 증명 노출, 안전하지 않은 권한 설정 등을 항상 염두에 두고 코드를 작성한다. 특히 배치/셸 스크립트에서 사용자 입력을 그대로 명령어에 삽입하지 않는다.
