-- KICPA(수습-1년차)/KICPA(수습-2년차)를 하나의 KICPA(수습)으로 통합하고,
-- 기존 데이터(KICPA_TRAINEE_YEAR1/2)는 새 값(KICPA_TRAINEE)으로 매핑한다.
-- Postgres는 enum 값 제거를 직접 지원하지 않으므로 새 타입을 만들어 교체한다.

CREATE TYPE "QualificationGrade_new" AS ENUM (
  'KICPA_REGISTERED',
  'KICPA_TRAINEE',
  'AICPA',
  'TAX_ACCOUNTANT',
  'CISA',
  'ACCA',
  'CIA',
  'OTHER_PROFESSIONAL',
  'OTHER_STAFF'
);

ALTER TABLE "employees"
  ALTER COLUMN "qualificationGrades" TYPE "QualificationGrade_new"[]
  USING (
    array_replace(
      array_replace("qualificationGrades"::text[], 'KICPA_TRAINEE_YEAR1', 'KICPA_TRAINEE'),
      'KICPA_TRAINEE_YEAR2', 'KICPA_TRAINEE'
    )::"QualificationGrade_new"[]
  );

DROP TYPE "QualificationGrade";
ALTER TYPE "QualificationGrade_new" RENAME TO "QualificationGrade";
