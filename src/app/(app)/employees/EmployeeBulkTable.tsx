"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { EMPLOYEE_STATUS_COLORS, EMPLOYEE_STATUS_LABELS } from "@/lib/format";

export type EmployeeRow = {
  id: string;
  name: string;
  employeeNumber: string;
  branchName: string | null;
  departmentName: string;
  jobGradeLabel: string | null;
  qualificationGradeLabels: string[];
  contractTypeLabel: string;
  qualificationNames: string[];
  phone: string | null;
  status: string;
};

export type BulkActionState = {
  total: number;
  successCount: number;
  failCount: number;
  errors: string[];
} | null;

type BulkAction = (prevState: BulkActionState, formData: FormData) => Promise<BulkActionState>;

export default function EmployeeBulkTable({
  employees,
  canEdit,
  bulkUpdateStatusAction,
  bulkDeleteAction,
}: {
  employees: EmployeeRow[];
  canEdit: boolean;
  bulkUpdateStatusAction: BulkAction;
  bulkDeleteAction: BulkAction;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetStatus, setTargetStatus] = useState("ACTIVE");
  const [statusState, statusFormAction, statusPending] = useActionState(bulkUpdateStatusAction, null);
  const [deleteState, deleteFormAction, deletePending] = useActionState(bulkDeleteAction, null);

  // 액션 결과가 새로 도착하면(=성공적으로 제출됨) 선택 상태를 초기화한다 (렌더링 중 상태 조정 패턴)
  const [lastStatusState, setLastStatusState] = useState(statusState);
  if (statusState !== lastStatusState) {
    setLastStatusState(statusState);
    setSelected(new Set());
  }
  const [lastDeleteState, setLastDeleteState] = useState(deleteState);
  if (deleteState !== lastDeleteState) {
    setLastDeleteState(deleteState);
    setSelected(new Set());
  }

  const allSelected = employees.length > 0 && selected.size === employees.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(employees.map((e) => e.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <span className="text-sm text-slate-500">{selected.size}명 선택됨</span>
          <form
            action={statusFormAction}
            className="flex items-center gap-2"
            onSubmit={(e) => {
              if (
                !window.confirm(
                  `선택한 ${selected.size}명의 재직상태를 "${EMPLOYEE_STATUS_LABELS[targetStatus]}"(으)로 일괄 변경하시겠습니까?`
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            {[...selected].map((id) => (
              <input key={id} type="hidden" name="employeeIds" value={id} />
            ))}
            <select
              name="status"
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={selected.size === 0 || statusPending}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              재직상태 일괄 변경
            </button>
          </form>
          <form
            action={deleteFormAction}
            onSubmit={(e) => {
              if (
                !window.confirm(
                  `선택한 ${selected.size}명을 삭제하시겠습니까?\n관련된 입퇴사 케이스, 서류, 결재 이력이 모두 함께 삭제되며 되돌릴 수 없습니다.`
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            {[...selected].map((id) => (
              <input key={id} type="hidden" name="employeeIds" value={id} />
            ))}
            <button
              type="submit"
              disabled={selected.size === 0 || deletePending}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              선택 삭제
            </button>
          </form>
        </div>
      )}

      {statusState && (
        <p className="text-sm text-slate-600">
          재직상태 일괄 변경: 총 {statusState.total}건 중 성공 {statusState.successCount}건, 실패{" "}
          {statusState.failCount}건
          {statusState.errors.length > 0 && ` (${statusState.errors.join(", ")})`}
        </p>
      )}
      {deleteState && (
        <p className="text-sm text-slate-600">
          선택 삭제: 총 {deleteState.total}건 중 성공 {deleteState.successCount}건, 실패{" "}
          {deleteState.failCount}건
          {deleteState.errors.length > 0 && ` (${deleteState.errors.join(", ")})`}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              {canEdit && (
                <th className="px-4 py-2 font-medium">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </th>
              )}
              <th className="px-4 py-2 font-medium">이름</th>
              <th className="px-4 py-2 font-medium">사번</th>
              <th className="px-4 py-2 font-medium">본부</th>
              <th className="px-4 py-2 font-medium">부서</th>
              <th className="px-4 py-2 font-medium">직급</th>
              <th className="px-4 py-2 font-medium">자격</th>
              <th className="px-4 py-2 font-medium">계약형태</th>
              <th className="px-4 py-2 font-medium">보유자격</th>
              <th className="px-4 py-2 font-medium">연락처</th>
              <th className="px-4 py-2 font-medium">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 11 : 10} className="px-4 py-6 text-center text-slate-400">
                  조건에 맞는 직원이 없습니다.
                </td>
              </tr>
            )}
            {employees.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                {canEdit && (
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(e.id)}
                      onChange={() => toggleOne(e.id)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>
                )}
                <td className="px-4 py-2">
                  <Link href={`/employees/${e.id}`} className="font-medium text-slate-900 hover:underline">
                    {e.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-500">{e.employeeNumber}</td>
                <td className="px-4 py-2 text-slate-500">{e.branchName ?? "-"}</td>
                <td className="px-4 py-2">{e.departmentName}</td>
                <td className="px-4 py-2 text-slate-500">{e.jobGradeLabel ?? "-"}</td>
                <td className="px-4 py-2 text-slate-500">
                  {e.qualificationGradeLabels.length > 0 ? e.qualificationGradeLabels.join(", ") : "-"}
                </td>
                <td className="px-4 py-2 text-slate-500">{e.contractTypeLabel}</td>
                <td className="px-4 py-2 text-slate-500">
                  {e.qualificationNames.length > 0 ? e.qualificationNames.join(", ") : "-"}
                </td>
                <td className="px-4 py-2 text-slate-500">{e.phone ?? "-"}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${EMPLOYEE_STATUS_COLORS[e.status]}`}
                  >
                    {EMPLOYEE_STATUS_LABELS[e.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
