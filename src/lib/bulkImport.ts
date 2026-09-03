export const BULK_IMPORT_HEADERS = [
  "이름",
  "사번",
  "부서코드",
  "계약형태",
  "직급",
  "파트너유형",
  "자격",
  "생년월일",
  "입사일",
  "사내이메일",
  "연락처",
  "제출서류체크리스트유형",
];

export const BULK_IMPORT_MAX_ROWS = 1000;

export type BulkImportRowResult = {
  row: number;
  name: string;
  employeeNumber: string;
  status: "success" | "error";
  message?: string;
};

export type BulkImportState = {
  total: number;
  successCount: number;
  failCount: number;
  results: BulkImportRowResult[];
} | null;

/** 라벨 텍스트(예: "정규직")로부터 Prisma enum 값(예: "REGULAR")을 역으로 찾는다 */
export function reverseLookup(labels: Record<string, string>, label: string): string | undefined {
  return Object.entries(labels).find(([, v]) => v === label)?.[0];
}
