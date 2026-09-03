import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { JobGrade, PositionTitle } from "@/generated/prisma/client";
import {
  CONTRACT_TYPE_LABELS,
  JOB_GRADE_LABELS,
  POSITION_TITLE_LABELS,
  formatDate,
} from "@/lib/format";

async function requireEditor() {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "HR")) {
    redirect("/");
  }
  return session;
}

export default async function EmployeeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireEditor();

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { qualifications: { orderBy: { acquiredDate: "asc" } } },
  });
  if (!employee) notFound();

  async function updateEmployee(formData: FormData) {
    "use server";
    await requireEditor();

    await prisma.employee.update({
      where: { id },
      data: {
        positionTitle: ((formData.get("positionTitle") as string) || null) as PositionTitle | null,
        jobGrade: ((formData.get("jobGrade") as string) || null) as JobGrade | null,
        phone: (formData.get("phone") as string) || null,
        email: (formData.get("email") as string) || null,
        personalEmail: (formData.get("personalEmail") as string) || null,
        yearsOfExperience: Number(formData.get("yearsOfExperience") ?? 0),
      },
    });

    redirect(`/employees/${id}`);
  }

  async function addQualification(formData: FormData) {
    "use server";
    await requireEditor();

    const name = formData.get("name") as string;
    if (!name?.trim()) return;

    await prisma.qualification.create({
      data: {
        employeeId: id,
        name: name.trim(),
        registrationNumber: (formData.get("registrationNumber") as string) || null,
        acquiredDate: formData.get("acquiredDate")
          ? new Date(formData.get("acquiredDate") as string)
          : null,
      },
    });

    redirect(`/employees/${id}/edit`);
  }

  async function deleteQualification(formData: FormData) {
    "use server";
    await requireEditor();
    const qualificationId = formData.get("qualificationId") as string;
    await prisma.qualification.delete({ where: { id: qualificationId } });
    redirect(`/employees/${id}/edit`);
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link href={`/employees/${id}`} className="text-sm text-slate-500 hover:underline">
          ← {employee.name} 상세로 돌아가기
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">직원 정보 수정</h1>
      </div>

      <form action={updateEmployee} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500">직위</label>
            <select
              name="positionTitle"
              defaultValue={employee.positionTitle ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">선택안함</option>
              {Object.entries(POSITION_TITLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">직급</label>
            <select
              name="jobGrade"
              defaultValue={employee.jobGrade ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">선택안함</option>
              {Object.entries(JOB_GRADE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">계약형태</label>
            <input
              disabled
              value={CONTRACT_TYPE_LABELS[employee.contractType]}
              className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">사내 이메일</label>
            <input
              name="email"
              type="email"
              defaultValue={employee.email ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">연락처</label>
            <input
              name="phone"
              defaultValue={employee.phone ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">개인 이메일</label>
            <input
              name="personalEmail"
              type="email"
              defaultValue={employee.personalEmail ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">경력연수(입사 전)</label>
            <input
              name="yearsOfExperience"
              type="number"
              min={0}
              defaultValue={employee.yearsOfExperience}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          저장
        </button>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">보유자격 관리</h2>
        <ul className="mt-3 space-y-2">
          {employee.qualifications.map((q) => (
            <li key={q.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
              <span>
                {q.name} · {q.registrationNumber ?? "등록번호 없음"} · {formatDate(q.acquiredDate)}
              </span>
              <form action={deleteQualification}>
                <input type="hidden" name="qualificationId" value={q.id} />
                <button type="submit" className="text-xs text-red-600 hover:underline">
                  삭제
                </button>
              </form>
            </li>
          ))}
          {employee.qualifications.length === 0 && (
            <p className="text-sm text-slate-400">등록된 자격이 없습니다.</p>
          )}
        </ul>

        <form action={addQualification} className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
          <div>
            <label className="block text-xs font-medium text-slate-500">자격명</label>
            <input
              name="name"
              required
              placeholder="예: KICPA"
              className="mt-1 w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">등록번호</label>
            <input
              name="registrationNumber"
              className="mt-1 w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">취득일</label>
            <input
              name="acquiredDate"
              type="date"
              className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            추가
          </button>
        </form>
      </div>
    </div>
  );
}
