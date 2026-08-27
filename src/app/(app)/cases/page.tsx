import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CASE_STATUS_COLORS,
  CASE_STATUS_LABELS,
  CASE_TYPE_LABELS,
  formatDate,
} from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const canCreate = session?.user.role === "ADMIN" || session?.user.role === "HR";

  const where: Prisma.EmployeeCaseWhereInput = {};
  if (params.status) where.status = params.status as Prisma.EnumCaseStatusFilter["equals"];
  if (params.type) where.type = params.type as Prisma.EnumCaseTypeFilter["equals"];

  const cases = await prisma.employeeCase.findMany({
    where,
    include: { employee: true, steps: true },
    orderBy: { initiatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">입퇴사 케이스</h1>
        {canCreate && (
          <Link
            href="/cases/new"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            새 케이스 생성
          </Link>
        )}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-slate-500">구분</label>
          <select name="type" defaultValue={params.type} className="mt-1 w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">전체</option>
            {Object.entries(CASE_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">상태</label>
          <select name="status" defaultValue={params.status} className="mt-1 w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">전체</option>
            {Object.entries(CASE_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
          검색
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">직원</th>
              <th className="px-4 py-2 font-medium">구분</th>
              <th className="px-4 py-2 font-medium">진행률</th>
              <th className="px-4 py-2 font-medium">상태</th>
              <th className="px-4 py-2 font-medium">시작일</th>
              <th className="px-4 py-2 font-medium">완료일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cases.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  조건에 맞는 케이스가 없습니다.
                </td>
              </tr>
            )}
            {cases.map((c) => {
              const approved = c.steps.filter((s) => s.status === "APPROVED").length;
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/cases/${c.id}`} className="font-medium text-slate-900 hover:underline">
                      {c.employee.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{CASE_TYPE_LABELS[c.type]}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {approved} / {c.steps.length}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CASE_STATUS_COLORS[c.status]}`}>
                      {CASE_STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{formatDate(c.initiatedAt)}</td>
                  <td className="px-4 py-2 text-slate-500">{formatDate(c.completedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
