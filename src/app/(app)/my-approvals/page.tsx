import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approveStep, rejectStep } from "@/lib/workflow";
import { redirect } from "next/navigation";
import { CASE_TYPE_LABELS, formatDateTime } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

export default async function MyApprovalsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const user = session.user;

  const where: Prisma.CaseStepWhereInput =
    user.role === "ADMIN"
      ? { status: "ACTIVE" }
      : { status: "ACTIVE", departmentId: user.departmentId ?? "__none__" };

  const steps = await prisma.caseStep.findMany({
    where,
    include: { case: { include: { employee: true } }, department: true },
    orderBy: { createdAt: "asc" },
  });

  async function approveAction(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session) redirect("/login");
    await approveStep({ stepId: formData.get("stepId") as string, approverId: session.user.id });
    redirect("/my-approvals");
  }

  async function rejectAction(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session) redirect("/login");
    await rejectStep({
      stepId: formData.get("stepId") as string,
      approverId: session.user.id,
      comment: (formData.get("comment") as string) || "사유 미입력",
    });
    redirect("/my-approvals");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">내 승인함</h1>
      {user.role !== "ADMIN" && !user.departmentId && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          담당 부서가 지정되어 있지 않아 확인할 항목이 없습니다. 관리자에게 문의하세요.
        </p>
      )}
      <div className="space-y-3">
        {steps.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
            확인 대기중인 항목이 없습니다.
          </p>
        )}
        {steps.map((step) => (
          <div key={step.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <Link href={`/cases/${step.caseId}`} className="font-medium text-slate-900 hover:underline">
                  {step.case.employee.name} · {CASE_TYPE_LABELS[step.case.type]}
                </Link>
                <p className="text-sm text-slate-500">
                  [{step.department.name}] {step.title}
                </p>
                <p className="text-xs text-slate-400">요청일 {formatDateTime(step.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <form action={approveAction}>
                  <input type="hidden" name="stepId" value={step.id} />
                  <button
                    type="submit"
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    승인
                  </button>
                </form>
                <form action={rejectAction} className="flex items-center gap-2">
                  <input type="hidden" name="stepId" value={step.id} />
                  <input name="comment" placeholder="반려 사유" className="rounded-md border border-slate-300 px-2 py-1 text-xs" />
                  <button
                    type="submit"
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                  >
                    반려
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
