import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  CASE_STATUS_COLORS,
  CASE_STATUS_LABELS,
  CASE_TYPE_LABELS,
  formatDate,
} from "@/lib/format";

export default async function DashboardPage() {
  const session = await auth();
  const user = session!.user;

  const [inProgressCases, myPendingApprovals, employeeCount] = await Promise.all([
    prisma.employeeCase.findMany({
      where: { status: "IN_PROGRESS" },
      include: { employee: true, steps: true },
      orderBy: { initiatedAt: "desc" },
      take: 10,
    }),
    prisma.caseStep.count({
      where:
        user.role === "ADMIN"
          ? { status: "ACTIVE" }
          : { status: "ACTIVE", departmentId: user.departmentId ?? "__none__" },
    }),
    prisma.employee.count(),
  ]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="전체 직원 수" value={employeeCount} href="/employees" />
        <StatCard label="진행중인 입퇴사 건" value={inProgressCases.length} href="/cases" />
        <StatCard label="내가 확인할 항목" value={myPendingApprovals} href="/my-approvals" />
      </div>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">진행중인 입퇴사 케이스</h2>
          <Link href="/cases" className="text-sm text-blue-600 hover:underline">
            전체 보기
          </Link>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">직원</th>
                <th className="px-4 py-2 font-medium">구분</th>
                <th className="px-4 py-2 font-medium">진행률</th>
                <th className="px-4 py-2 font-medium">상태</th>
                <th className="px-4 py-2 font-medium">시작일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inProgressCases.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    진행중인 케이스가 없습니다.
                  </td>
                </tr>
              )}
              {inProgressCases.map((c) => {
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
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${CASE_STATUS_COLORS[c.status]}`}
                      >
                        {CASE_STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-500">{formatDate(c.initiatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-300"
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </Link>
  );
}
