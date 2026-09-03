import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  CONTRACT_TYPE_LABELS,
  EMPLOYEE_STATUS_COLORS,
  EMPLOYEE_STATUS_LABELS,
  JOB_GRADE_LABELS,
  QUALIFICATION_GRADE_LABELS,
  formatDate,
} from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    branchId?: string;
    departmentId?: string;
    status?: string;
    qualification?: string;
  }>;
}) {
  const params = await searchParams;

  const where: Prisma.EmployeeWhereInput = {};

  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { employeeNumber: { contains: params.q, mode: "insensitive" } },
    ];
  }
  if (params.departmentId) {
    where.departmentId = params.departmentId;
  } else if (params.branchId) {
    where.department = { branchId: params.branchId };
  }
  if (params.status) {
    where.status = params.status as Prisma.EnumEmployeeStatusFilter["equals"];
  }
  if (params.qualification) {
    where.qualifications = {
      some: { name: { contains: params.qualification, mode: "insensitive" } },
    };
  }

  const [employees, branches, departments] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: { department: { include: { branch: true } }, qualifications: true },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.department.findMany({
      where: { branchId: params.branchId ? params.branchId : { not: null } },
      include: { branch: true },
      orderBy: [{ branch: { displayOrder: "asc" } }, { displayOrder: "asc" }],
    }),
  ]);

  const exportQuery = new URLSearchParams();
  if (params.q) exportQuery.set("q", params.q);
  if (params.branchId) exportQuery.set("branchId", params.branchId);
  if (params.departmentId) exportQuery.set("departmentId", params.departmentId);
  if (params.status) exportQuery.set("status", params.status);
  if (params.qualification) exportQuery.set("qualification", params.qualification);
  const exportQueryString = exportQuery.toString();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">전직원 현황판</h1>
        <div className="flex items-center gap-2">
          <a
            href={`/api/employees/export${exportQueryString ? `?${exportQueryString}` : ""}`}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            엑셀 다운로드
          </a>
          <Link
            href="/cases/new"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            입퇴사 케이스 생성
          </Link>
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-slate-500">이름/사번 검색</label>
          <input
            type="text"
            name="q"
            defaultValue={params.q}
            className="mt-1 w-48 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">본부</label>
          <select
            name="branchId"
            defaultValue={params.branchId}
            className="mt-1 w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">전체</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">부서</label>
          <select
            name="departmentId"
            defaultValue={params.departmentId}
            className="mt-1 w-48 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">전체</option>
            {branches.map((b) => {
              const deptsInBranch = departments.filter((d) => d.branchId === b.id);
              if (deptsInBranch.length === 0) return null;
              return (
                <optgroup key={b.id} label={b.name}>
                  {deptsInBranch.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">재직상태</label>
          <select
            name="status"
            defaultValue={params.status}
            className="mt-1 w-36 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">전체</option>
            {Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">보유자격</label>
          <input
            type="text"
            name="qualification"
            placeholder="예: KICPA"
            defaultValue={params.qualification}
            className="mt-1 w-36 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          검색
        </button>
        {(params.q || params.branchId || params.departmentId || params.status || params.qualification) && (
          <Link href="/employees" className="text-sm text-slate-500 hover:underline">
            필터 초기화
          </Link>
        )}
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
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
                <td colSpan={10} className="px-4 py-6 text-center text-slate-400">
                  조건에 맞는 직원이 없습니다.
                </td>
              </tr>
            )}
            {employees.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/employees/${e.id}`} className="font-medium text-slate-900 hover:underline">
                    {e.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-500">{e.employeeNumber}</td>
                <td className="px-4 py-2 text-slate-500">{e.department.branch?.name ?? "-"}</td>
                <td className="px-4 py-2">{e.department.name}</td>
                <td className="px-4 py-2 text-slate-500">
                  {e.jobGrade ? JOB_GRADE_LABELS[e.jobGrade] : "-"}
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {e.qualificationGrades.length > 0
                    ? e.qualificationGrades.map((g) => QUALIFICATION_GRADE_LABELS[g]).join(", ")
                    : "-"}
                </td>
                <td className="px-4 py-2 text-slate-500">{CONTRACT_TYPE_LABELS[e.contractType]}</td>
                <td className="px-4 py-2 text-slate-500">
                  {e.qualifications.length > 0
                    ? e.qualifications.map((q) => q.name).join(", ")
                    : "-"}
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
      <p className="text-xs text-slate-400">
        마지막 갱신: {formatDate(new Date())} · 총 {employees.length}명 표시중
      </p>
    </div>
  );
}
