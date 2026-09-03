import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CASE_TYPE_LABELS } from "@/lib/format";
import Link from "next/link";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/");
  return session;
}

export default async function AdminTemplatesPage() {
  await requireAdmin();

  const [templates, departments] = await Promise.all([
    prisma.caseStepTemplate.findMany({
      include: { department: true },
      orderBy: [{ type: "asc" }, { sequenceGroup: "asc" }, { displayOrder: "asc" }],
    }),
    // 결재 라우팅 전용 부서만 노출 (branchId가 없는, 실제 조직도가 아닌 부서)
    prisma.department.findMany({ where: { branchId: null }, orderBy: { name: "asc" } }),
  ]);

  async function createTemplate(formData: FormData) {
    "use server";
    await requireAdmin();

    await prisma.caseStepTemplate.create({
      data: {
        type: formData.get("type") as "ONBOARDING" | "OFFBOARDING",
        title: formData.get("title") as string,
        description: (formData.get("description") as string) || null,
        departmentId: formData.get("departmentId") as string,
        sequenceGroup: Number(formData.get("sequenceGroup")),
        displayOrder: Number(formData.get("displayOrder") ?? 0),
      },
    });

    redirect("/admin/templates");
  }

  async function toggleActive(formData: FormData) {
    "use server";
    await requireAdmin();
    const templateId = formData.get("templateId") as string;
    const template = await prisma.caseStepTemplate.findUniqueOrThrow({ where: { id: templateId } });
    await prisma.caseStepTemplate.update({
      where: { id: templateId },
      data: { isActive: !template.isActive },
    });
    redirect("/admin/templates");
  }

  async function deleteTemplate(formData: FormData) {
    "use server";
    await requireAdmin();
    const templateId = formData.get("templateId") as string;
    await prisma.caseStepTemplate.delete({ where: { id: templateId } });
    redirect("/admin/templates");
  }

  const onboarding = templates.filter((t) => t.type === "ONBOARDING");
  const offboarding = templates.filter((t) => t.type === "OFFBOARDING");

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-slate-900">체크리스트 템플릿 관리</h1>
        <nav className="flex gap-3 text-sm text-slate-500">
          <Link href="/admin/templates" className="font-medium text-slate-900">
            템플릿
          </Link>
          <Link href="/admin/users" className="hover:text-slate-900">
            사용자
          </Link>
        </nav>
      </div>

      <p className="text-sm text-slate-500">
        같은 <b>확인 단계</b> 번호의 항목은 병렬로 동시에 활성화되며, 이전 단계가 모두 승인되어야 다음 단계가
        활성화됩니다.
      </p>

      {([
        { type: "ONBOARDING" as const, items: onboarding },
        { type: "OFFBOARDING" as const, items: offboarding },
      ]).map(({ type, items }) => (
        <section key={type}>
          <h2 className="text-sm font-semibold text-slate-900">{CASE_TYPE_LABELS[type]} 체크리스트</h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">단계</th>
                  <th className="px-4 py-2 font-medium">순서</th>
                  <th className="px-4 py-2 font-medium">부서</th>
                  <th className="px-4 py-2 font-medium">항목명</th>
                  <th className="px-4 py-2 font-medium">활성</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2">{t.sequenceGroup}</td>
                    <td className="px-4 py-2 text-slate-500">{t.displayOrder}</td>
                    <td className="px-4 py-2">{t.department.name}</td>
                    <td className="px-4 py-2">{t.title}</td>
                    <td className="px-4 py-2">
                      <form action={toggleActive}>
                        <input type="hidden" name="templateId" value={t.id} />
                        <button
                          type="submit"
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            t.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          {t.isActive ? "사용중" : "비활성"}
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <form action={deleteTemplate}>
                        <input type="hidden" name="templateId" value={t.id} />
                        <button type="submit" className="text-xs text-red-600 hover:underline">
                          삭제
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">새 체크리스트 항목 추가</h2>
        <form action={createTemplate} className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">구분</label>
            <select name="type" required className="mt-1 w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              {Object.entries(CASE_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">부서</label>
            <select name="departmentId" required className="mt-1 w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">확인 단계</label>
            <input
              name="sequenceGroup"
              type="number"
              min={1}
              required
              defaultValue={1}
              className="mt-1 w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">표시순서</label>
            <input
              name="displayOrder"
              type="number"
              min={0}
              defaultValue={0}
              className="mt-1 w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex-1 min-w-[12rem]">
            <label className="block text-xs font-medium text-slate-500">항목명</label>
            <input name="title" required className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            추가
          </button>
        </form>
      </section>
    </div>
  );
}
