import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CONTRACT_TYPE_LABELS,
  EMPLOYEE_STATUS_LABELS,
  JOB_GRADE_LABELS,
  QUALIFICATION_GRADE_LABELS,
  formatDate,
} from "@/lib/format";
import type { EmployeeStatus, Prisma, QualificationGrade } from "@/generated/prisma/client";
import EmployeeBulkTable, { type BulkActionState } from "./EmployeeBulkTable";

async function requireHr() {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "HR")) {
    redirect("/");
  }
  return session;
}

const MAX_BULK_IDS = 500;

async function bulkUpdateStatusAction(
  _prevState: BulkActionState,
  formData: FormData
): Promise<BulkActionState> {
  "use server";
  await requireHr();

  const employeeIds = formData
    .getAll("employeeIds")
    .map(String)
    .filter(Boolean)
    .slice(0, MAX_BULK_IDS);
  const status = formData.get("status") as string;

  if (employeeIds.length === 0) {
    return { total: 0, successCount: 0, failCount: 0, errors: ["선택된 직원이 없습니다."] };
  }
  if (!Object.keys(EMPLOYEE_STATUS_LABELS).includes(status)) {
    return {
      total: employeeIds.length,
      successCount: 0,
      failCount: employeeIds.length,
      errors: ["알 수 없는 재직상태 값입니다."],
    };
  }

  const data: Prisma.EmployeeUpdateManyMutationInput = { status: status as EmployeeStatus };
  if (status === "TERMINATED") {
    data.terminationDate = new Date();
  }

  const result = await prisma.employee.updateMany({
    where: { id: { in: employeeIds } },
    data,
  });

  revalidatePath("/employees");

  return {
    total: employeeIds.length,
    successCount: result.count,
    failCount: employeeIds.length - result.count,
    errors: [],
  };
}

async function bulkDeleteAction(
  _prevState: BulkActionState,
  formData: FormData
): Promise<BulkActionState> {
  "use server";
  await requireHr();

  const employeeIds = formData
    .getAll("employeeIds")
    .map(String)
    .filter(Boolean)
    .slice(0, MAX_BULK_IDS);

  if (employeeIds.length === 0) {
    return { total: 0, successCount: 0, failCount: 0, errors: ["선택된 직원이 없습니다."] };
  }

  const result = await prisma.employee.deleteMany({ where: { id: { in: employeeIds } } });

  revalidatePath("/employees");

  return {
    total: employeeIds.length,
    successCount: result.count,
    failCount: employeeIds.length - result.count,
    errors: [],
  };
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    branchId?: string;
    departmentId?: string;
    status?: string;
    qualification?: string;
    qualificationGrade?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "HR";

  const qualificationGrades = Array.isArray(params.qualificationGrade)
    ? params.qualificationGrade
    : params.qualificationGrade
      ? [params.qualificationGrade]
      : [];

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
  if (qualificationGrades.length > 0) {
    where.qualificationGrades = { hasSome: qualificationGrades as QualificationGrade[] };
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
  for (const g of qualificationGrades) exportQuery.append("qualificationGrade", g);
  const exportQueryString = exportQuery.toString();

  const employeeRows = employees.map((e) => ({
    id: e.id,
    name: e.name,
    employeeNumber: e.employeeNumber,
    branchName: e.department.branch?.name ?? null,
    departmentName: e.department.name,
    jobGradeLabel: e.jobGrade ? JOB_GRADE_LABELS[e.jobGrade] : null,
    qualificationGradeLabels: e.qualificationGrades.map((g) => QUALIFICATION_GRADE_LABELS[g]),
    contractTypeLabel: CONTRACT_TYPE_LABELS[e.contractType],
    qualificationNames: e.qualifications.map((q) => q.name),
    phone: e.phone,
    status: e.status,
  }));

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
            href="/employees/bulk-upload"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            일괄 등록(엑셀 업로드)
          </Link>
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
        <div>
          <label className="block text-xs font-medium text-slate-500">자격 (다중 선택 가능)</label>
          <div className="mt-1 flex max-w-xs flex-wrap gap-x-3 gap-y-1 rounded-md border border-slate-300 px-2.5 py-1.5">
            {Object.entries(QUALIFICATION_GRADE_LABELS).map(([value, label]) => (
              <label key={value} className="flex items-center gap-1 text-xs text-slate-700">
                <input
                  type="checkbox"
                  name="qualificationGrade"
                  value={value}
                  defaultChecked={qualificationGrades.includes(value)}
                  className="h-3.5 w-3.5 rounded border-slate-300"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          검색
        </button>
        {(params.q ||
          params.branchId ||
          params.departmentId ||
          params.status ||
          params.qualification ||
          qualificationGrades.length > 0) && (
          <Link href="/employees" className="text-sm text-slate-500 hover:underline">
            필터 초기화
          </Link>
        )}
      </form>

      <EmployeeBulkTable
        employees={employeeRows}
        canEdit={!!canEdit}
        bulkUpdateStatusAction={bulkUpdateStatusAction}
        bulkDeleteAction={bulkDeleteAction}
      />
      <p className="text-xs text-slate-400">
        마지막 갱신: {formatDate(new Date())} · 총 {employees.length}명 표시중
      </p>
    </div>
  );
}
