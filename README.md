# 입퇴사자 관리 + 전직원 현황판 시스템

입퇴사자 발생 시 서류를 디지털화하고, 부서별 담당자가 체크리스트를 확인/결재하며,
그 진행상황을 조회·공유할 수 있는 사내 전용 웹 시스템입니다. 입퇴사 처리 결과는
전직원 현황판(전직원 마스터 데이터)에 자동으로 반영됩니다.

## 기술 스택

- Next.js (App Router) + TypeScript, Tailwind CSS
- PostgreSQL + Prisma ORM 7 (드라이버 어댑터: `@prisma/adapter-pg`)
- NextAuth (Credentials 로그인) + 역할 기반 접근제어(RBAC)
- Docker Compose 배포 (app + postgres)

## 주요 기능

- **전직원 현황판** (`/employees`): 기본 인적사항, 재직상태, 연락처, 보유자격(KICPA/AICPA 등),
  자격등록번호, 경력연수를 부서/재직상태/자격으로 필터링해 조회. 입퇴사 케이스가 완료되면
  이 마스터 데이터가 자동 갱신됩니다.
- **입퇴사 케이스 생성** (`/cases/new`, HR/관리자 전용): 입사자는 신규 직원 정보를 입력해
  케이스를 시작하고, 퇴사자는 기존 재직자를 선택해 케이스를 시작합니다.
- **부서별 체크리스트/결재** (`/cases/[id]`): 관리자가 등록한 템플릿을 기반으로 부서별
  확인 항목이 생성됩니다. 같은 "확인 단계" 번호의 항목은 병렬로 동시에 활성화되고,
  이전 단계가 모두 승인되어야 다음 단계가 활성화되는 **혼합형(순차+병렬) 결재 흐름**입니다.
- **서류 업로드/다운로드**: 케이스별로 근로계약서, 신분증사본, 사직서 등 서류를 업로드하고
  다운로드할 수 있습니다.
- **내 승인함** (`/my-approvals`): 로그인한 사용자가 지금 확인/결재해야 할 항목만 모아줍니다.
- **대시보드** (`/`) / **알림함** (`/notifications`): 진행중인 케이스 현황과 승인 대기
  알림을 확인할 수 있습니다.
- **관리자 화면** (`/admin/templates`, `/admin/users`, 관리자 전용): 부서별 체크리스트
  템플릿과 사용자 계정/권한을 관리합니다.

## 권한

| 역할 | 설명 |
| --- | --- |
| `ADMIN` | 시스템 관리자. 모든 기능 및 관리자 화면 접근 가능, 모든 부서 항목 승인 가능 |
| `HR` | 인사담당자. 케이스 생성, 전체 현황 조회 |
| `DEPT_APPROVER` | 부서 담당자. 자신의 담당 부서 체크리스트 항목만 승인/반려 가능 |
| `VIEWER` | 조회 전용 |

## 로컬 개발 환경 설정

1. 의존성 설치
   ```bash
   npm install
   ```
2. `.env.example`을 참고해 `.env` 파일 작성 (`DATABASE_URL`, `AUTH_SECRET`, `FILE_STORAGE_DIR` 등)
3. DB 마이그레이션 및 시드 데이터 생성
   ```bash
   npx prisma migrate dev
   npm run db:seed
   ```
   시드 스크립트는 부서(인사/IT/총무/재무), 관리자·인사·부서담당자 계정, 입사/퇴사
   기본 체크리스트 템플릿을 생성합니다. 관리자 계정은 `admin@bdo.kr` (초기 비밀번호는
   콘솔 출력 참고, `SEED_ADMIN_PASSWORD` 환경변수로 변경 가능)입니다.
4. 개발 서버 실행
   ```bash
   npm run dev
   ```

## 프로덕션 배포 (Docker Compose)

```bash
export POSTGRES_PASSWORD=<강력한-비밀번호>
export AUTH_SECRET=$(openssl rand -base64 32)
docker compose up -d --build
```

- 컨테이너 기동 시 `prisma migrate deploy`가 자동 실행됩니다.
- 최초 배포 후에는 저장소를 체크아웃한 로컬 환경에서 `DATABASE_URL`을 배포된 Postgres로
  지정한 뒤 `npm run db:seed`를 한 번 실행해 초기 데이터를 생성하세요 (`docker-compose.yml`의
  `db` 서비스 포트를 임시로 열어두면 편합니다). 런타임 이미지는 최소 실행 파일만 포함하므로
  컨테이너 내부에서 시드 스크립트를 실행할 수 없습니다.
- 업로드된 서류는 `documents_data` 볼륨(`/data/documents`)에 저장됩니다.
- 이 시스템은 사내망 전용으로 설계되었으므로, 외부 접근이 필요 없다면 리버스 프록시/방화벽에서
  사내망으로만 접근을 제한하는 것을 권장합니다.

## 검증 방법

```bash
npx tsc --noEmit   # 타입체크
npm run lint       # ESLint
npm run build      # 프로덕션 빌드
```

## 알려진 제약사항 (MVP 범위)

- 알림은 시스템 내 알림함으로만 제공되며, 이메일/메신저 알림은 포함되어 있지 않습니다
  (추후 SMTP 연동 등으로 확장 가능한 구조입니다).
- 반려된 케이스는 HR/관리자가 "반려 항목 재오픈"으로 보완 후 재진행합니다.
- `prisma` CLI의 개발 의존성인 `deepmerge-ts`에 알려진 취약점(GHSA-ggr8-5vv4-36mx, 스택 소진
  DoS)이 있습니다. 런타임에 노출되는 경로가 아닌 CLI 도구의 devDependency이므로 즉시 위험은
  낮으나, 향후 Prisma CLI 업데이트로 해결되면 반영하세요.
