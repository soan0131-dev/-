export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "관리자",
  HR: "인사담당자",
  DEPT_APPROVER: "부서담당자",
  VIEWER: "조회전용",
};

export const EMPLOYEE_STATUS_LABELS: Record<string, string> = {
  PENDING_ENTRY: "입사예정",
  ACTIVE: "재직중",
  ON_LEAVE: "휴직",
  PENDING_EXIT: "퇴사예정",
  TERMINATED: "퇴사완료",
};

export const EMPLOYEE_STATUS_COLORS: Record<string, string> = {
  PENDING_ENTRY: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  ON_LEAVE: "bg-slate-200 text-slate-700",
  PENDING_EXIT: "bg-orange-100 text-orange-800",
  TERMINATED: "bg-slate-300 text-slate-700",
};

export const CASE_TYPE_LABELS: Record<string, string> = {
  ONBOARDING: "입사",
  OFFBOARDING: "퇴사",
};

export const CASE_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "진행중",
  COMPLETED: "완료",
  REJECTED: "반려",
  CANCELLED: "취소",
};

export const CASE_STATUS_COLORS: Record<string, string> = {
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-slate-200 text-slate-700",
};

export const STEP_STATUS_LABELS: Record<string, string> = {
  PENDING: "대기",
  ACTIVE: "확인중",
  APPROVED: "승인",
  REJECTED: "반려",
};

export const STEP_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-500",
  ACTIVE: "bg-blue-100 text-blue-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
};

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  REGULAR: "정규직",
  CONTRACT: "계약직",
  INTERN: "인턴",
};

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function tenureYears(hireDate: Date | string): number {
  const d = typeof hireDate === "string" ? new Date(hireDate) : hireDate;
  const diffMs = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25)));
}
