import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CASE_STATUS_COLORS,
  CASE_STATUS_LABELS,
  CASE_TYPE_LABELS,
  CONTRACT_TYPE_LABELS,
  EMPLOYEE_STATUS_COLORS,
  EMPLOYEE_STATUS_LABELS,
  JOB_GRADE_LABELS,
  PARTNER_TYPE_LABELS,
  QUALIFICATION_GRADE_LABELS,
  formatDate,
  tenureYears,
} from "@/lib/format";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "HR";

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      department: { include: { branch: true } },
      qualifications: { orderBy: { acquiredDate: "asc" } },
      cases: { orderBy: { initiatedAt: "desc" } },
    },
  });

  if (!employee) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">{employee.name}</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${EMPLOYEE_STATUS_COLORS[employee.status]}`}
            >
              {EMPLOYEE_STATUS_LABELS[employee.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {employee.department.branch ? `${employee.department.branch.name} · ` : ""}
            {employee.department.name} ·{" "}
            {employee.jobGrade ? JOB_GRADE_LABELS[employee.jobGrade] : "직급 미지정"} · 사번{" "}
            {employee.employeeNumber}
          </p>
        </div>
        {canEdit && (
          <Link
            href={`/employees/${employee.id}/edit`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            정보 수정
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-5 md:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">기본 인적사항</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Field label="계약형태" value={CONTRACT_TYPE_LABELS[employee.contractType]} />
            <Field
              label="직급"
              value={employee.jobGrade ? JOB_GRADE_LABELS[employee.jobGrade] : "-"}
            />
            {employee.jobGrade === "PARTNER" && (
              <Field
                label="파트너 유형"
                value={employee.partnerType ? PARTNER_TYPE_LABELS[employee.partnerType] : "-"}
              />
            )}
            <Field
              label="자격"
              value={
                employee.qualificationGrades.length > 0
                  ? employee.qualificationGrades.map((g) => QUALIFICATION_GRADE_LABELS[g]).join(", ")
                  : "-"
              }
            />
            <Field label="입사일" value={formatDate(employee.hireDate)} />
            <Field label="근속연수" value={`${tenureYears(employee.hireDate)}년`} />
            <Field label="경력연수(입사 전)" value={`${employee.yearsOfExperience}년`} />
            <Field label="퇴사일" value={formatDate(employee.terminationDate)} />
            <Field label="사내 이메일" value={employee.email ?? "-"} />
            <Field label="연락처" value={employee.phone ?? "-"} />
            <Field label="개인 이메일" value={employee.personalEmail ?? "-"} />
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">보유자격</h2>
          {employee.qualifications.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">등록된 자격이 없습니다.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {employee.qualifications.map((q) => (
                <li key={q.id} className="rounded-md bg-slate-50 px-3 py-2">
                  <p className="font-medium text-slate-900">{q.name}</p>
                  <p className="text-xs text-slate-500">
                    등록번호 {q.registrationNumber ?? "-"} · 취득일 {formatDate(q.acquiredDate)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-slate-900">입퇴사 케이스 이력</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">구분</th>
                <th className="px-4 py-2 font-medium">상태</th>
                <th className="px-4 py-2 font-medium">시작일</th>
                <th className="px-4 py-2 font-medium">완료일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employee.cases.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    케이스 이력이 없습니다.
                  </td>
                </tr>
              )}
              {employee.cases.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/cases/${c.id}`} className="font-medium text-slate-900 hover:underline">
                      {CASE_TYPE_LABELS[c.type]}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CASE_STATUS_COLORS[c.status]}`}>
                      {CASE_STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{formatDate(c.initiatedAt)}</td>
                  <td className="px-4 py-2 text-slate-500">{formatDate(c.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{value}</dd>
    </div>
  );
}
