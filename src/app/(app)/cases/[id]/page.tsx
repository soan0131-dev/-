import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approveStep, canActOnStep, rejectStep, reopenCase } from "@/lib/workflow";
import { saveUploadedFile, UploadError } from "@/lib/storage";
import {
  CASE_STATUS_COLORS,
  CASE_STATUS_LABELS,
  CASE_TYPE_LABELS,
  STEP_STATUS_COLORS,
  STEP_STATUS_LABELS,
  formatDate,
  formatDateTime,
} from "@/lib/format";
import {
  CHECKLIST_TYPE_LABELS,
  OFFBOARDING_DOCUMENT_TYPES,
  REQUIRED_DOCUMENTS,
  getRequiredDocumentItems,
} from "@/lib/documents";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");
  const user = session.user;

  const employeeCase = await prisma.employeeCase.findUnique({
    where: { id },
    include: {
      employee: { include: { department: true } },
      initiatedBy: true,
      documents: { include: { uploadedBy: true }, orderBy: { uploadedAt: "desc" } },
      steps: {
        include: { department: true, approvedBy: true },
        orderBy: [{ sequenceGroup: "asc" }, { displayOrder: "asc" }],
      },
    },
  });

  if (!employeeCase) notFound();

  const canManage = user.role === "ADMIN" || user.role === "HR";

  async function approveAction(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session) redirect("/login");

    const stepId = formData.get("stepId") as string;
    const step = await prisma.caseStep.findUniqueOrThrow({ where: { id: stepId } });
    if (!canActOnStep(session.user, step)) {
      throw new Error("이 항목을 승인할 권한이 없습니다.");
    }

    await approveStep({ stepId, approverId: session.user.id });
    redirect(`/cases/${id}`);
  }

  async function rejectAction(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session) redirect("/login");

    const stepId = formData.get("stepId") as string;
    const comment = (formData.get("comment") as string) || "사유 미입력";
    const step = await prisma.caseStep.findUniqueOrThrow({ where: { id: stepId } });
    if (!canActOnStep(session.user, step)) {
      throw new Error("이 항목을 반려할 권한이 없습니다.");
    }

    await rejectStep({ stepId, approverId: session.user.id, comment });
    redirect(`/cases/${id}`);
  }

  async function reopenAction() {
    "use server";
    const session = await auth();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "HR")) {
      throw new Error("재오픈 권한이 없습니다.");
    }
    await reopenCase({ caseId: id, actorId: session.user.id });
    redirect(`/cases/${id}`);
  }

  async function uploadAction(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session) redirect("/login");

    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string) || "기타";
    if (!file || file.size === 0) return;

    let saved;
    try {
      saved = await saveUploadedFile(file);
    } catch (e) {
      if (e instanceof UploadError) return;
      throw e;
    }

    await prisma.document.create({
      data: {
        caseId: id,
        type,
        originalFileName: saved.originalFileName,
        filePath: saved.filePath,
        mimeType: saved.mimeType,
        fileSize: saved.fileSize,
        uploadedById: session.user.id,
      },
    });

    redirect(`/cases/${id}`);
  }

  const groups = new Map<number, typeof employeeCase.steps>();
  for (const step of employeeCase.steps) {
    if (!groups.has(step.sequenceGroup)) groups.set(step.sequenceGroup, []);
    groups.get(step.sequenceGroup)!.push(step);
  }
  const sortedGroups = [...groups.entries()].sort(([a], [b]) => a - b);

  const hasRejected = employeeCase.steps.some((s) => s.status === "REJECTED");

  const requiredItems =
    employeeCase.type === "ONBOARDING" ? getRequiredDocumentItems(employeeCase.checklistType) : [];
  const documentTypeOptions =
    requiredItems.length > 0 ? [...requiredItems, "기타"] : OFFBOARDING_DOCUMENT_TYPES;
  const uploadedTypes = new Set(employeeCase.documents.map((d) => d.type));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">
              {employeeCase.employee.name} · {CASE_TYPE_LABELS[employeeCase.type]}
            </h1>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CASE_STATUS_COLORS[employeeCase.status]}`}>
              {CASE_STATUS_LABELS[employeeCase.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {employeeCase.employee.department.name} · 시작일 {formatDate(employeeCase.initiatedAt)} · 신청자{" "}
            {employeeCase.initiatedBy.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/employees/${employeeCase.employee.id}`} className="text-sm text-blue-600 hover:underline">
            직원 상세 보기
          </Link>
          {canManage && employeeCase.status === "REJECTED" && hasRejected && (
            <form action={reopenAction}>
              <button
                type="submit"
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-100"
              >
                반려 항목 재오픈
              </button>
            </form>
          )}
        </div>
      </div>

      {employeeCase.note && (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">비고: {employeeCase.note}</p>
      )}

      <section>
        <h2 className="text-sm font-semibold text-slate-900">부서별 체크리스트 진행상황</h2>
        <div className="mt-3 space-y-4">
          {sortedGroups.map(([group, steps]) => (
            <div key={group} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                {group}단계 {steps.length > 1 ? "(병렬 확인)" : ""}
              </p>
              <ul className="space-y-3">
                {steps.map((step) => {
                  const eligible = canActOnStep(user, step) && step.status === "ACTIVE";
                  return (
                    <li key={step.id} className="rounded-md border border-slate-100 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">
                            [{step.department.name}] {step.title}
                          </p>
                          {step.description && <p className="text-xs text-slate-500">{step.description}</p>}
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STEP_STATUS_COLORS[step.status]}`}>
                          {STEP_STATUS_LABELS[step.status]}
                        </span>
                      </div>

                      {step.status !== "PENDING" && step.status !== "ACTIVE" && (
                        <p className="mt-2 text-xs text-slate-500">
                          {step.approvedBy?.name ?? "-"} · {formatDateTime(step.approvedAt)}
                          {step.comment ? ` · ${step.comment}` : ""}
                        </p>
                      )}

                      {eligible && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
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
                            <input
                              name="comment"
                              placeholder="반려 사유"
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                            />
                            <button
                              type="submit"
                              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                            >
                              반려
                            </button>
                          </form>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {employeeCase.type === "ONBOARDING" && employeeCase.checklistType && (
        <section>
          <h2 className="text-sm font-semibold text-slate-900">
            제출서류 체크리스트 ({CHECKLIST_TYPE_LABELS[employeeCase.checklistType]})
          </h2>
          <div className="mt-3 space-y-4">
            {REQUIRED_DOCUMENTS[employeeCase.checklistType].map((group) => (
              <div key={group.category} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {group.category}
                </p>
                <ul className="space-y-1 text-sm">
                  {group.items.map((item) => {
                    const done = uploadedTypes.has(item);
                    return (
                      <li key={item} className="flex items-center gap-2">
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                            done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"
                          }`}
                        >
                          {done ? "✓" : ""}
                        </span>
                        <span className={done ? "text-slate-500 line-through" : "text-slate-800"}>{item}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-slate-900">서류</h2>
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
          <ul className="space-y-2 text-sm">
            {employeeCase.documents.length === 0 && <p className="text-slate-400">업로드된 서류가 없습니다.</p>}
            {employeeCase.documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                <span>
                  <span className="font-medium text-slate-900">[{doc.type}]</span> {doc.originalFileName}{" "}
                  <span className="text-xs text-slate-400">
                    ({Math.round(doc.fileSize / 1024)}KB · {doc.uploadedBy.name} · {formatDateTime(doc.uploadedAt)})
                  </span>
                </span>
                <a href={`/api/documents/${doc.id}`} className="text-xs text-blue-600 hover:underline">
                  다운로드
                </a>
              </li>
            ))}
          </ul>

          <form action={uploadAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
            <div>
              <label className="block text-xs font-medium text-slate-500">서류 종류</label>
              <select name="type" className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                {documentTypeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">파일</label>
              <input name="file" type="file" required className="mt-1 text-sm" />
            </div>
            <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
              업로드
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
