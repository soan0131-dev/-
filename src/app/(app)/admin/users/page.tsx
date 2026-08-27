import { redirect } from "next/navigation";
import Link from "next/link";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/format";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/");
  return session;
}

export default async function AdminUsersPage() {
  await requireAdmin();

  const [users, departments] = await Promise.all([
    prisma.user.findMany({ include: { department: true }, orderBy: { createdAt: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  async function createUser(formData: FormData) {
    "use server";
    await requireAdmin();

    const role = formData.get("role") as string;
    const departmentId = (formData.get("departmentId") as string) || null;
    const password = (formData.get("password") as string) || crypto.randomUUID().slice(0, 12);
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email: formData.get("email") as string,
        name: formData.get("name") as string,
        role: role as "ADMIN" | "HR" | "DEPT_APPROVER" | "VIEWER",
        departmentId: role === "DEPT_APPROVER" || role === "HR" ? departmentId : null,
        passwordHash,
      },
    });

    redirect("/admin/users");
  }

  async function toggleActive(formData: FormData) {
    "use server";
    await requireAdmin();
    const userId = formData.get("userId") as string;
    const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await prisma.user.update({ where: { id: userId }, data: { isActive: !target.isActive } });
    redirect("/admin/users");
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-slate-900">사용자 관리</h1>
        <nav className="flex gap-3 text-sm text-slate-500">
          <Link href="/admin/templates" className="hover:text-slate-900">
            템플릿
          </Link>
          <Link href="/admin/users" className="font-medium text-slate-900">
            사용자
          </Link>
        </nav>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">이름</th>
              <th className="px-4 py-2 font-medium">이메일</th>
              <th className="px-4 py-2 font-medium">역할</th>
              <th className="px-4 py-2 font-medium">부서</th>
              <th className="px-4 py-2 font-medium">활성</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2">{u.name}</td>
                <td className="px-4 py-2 text-slate-500">{u.email}</td>
                <td className="px-4 py-2">{ROLE_LABELS[u.role]}</td>
                <td className="px-4 py-2 text-slate-500">{u.department?.name ?? "-"}</td>
                <td className="px-4 py-2">
                  <form action={toggleActive}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button
                      type="submit"
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {u.isActive ? "활성" : "비활성"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">새 사용자 추가</h2>
        <form action={createUser} className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">이름</label>
            <input name="name" required className="mt-1 w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">이메일</label>
            <input name="email" type="email" required className="mt-1 w-48 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">초기 비밀번호</label>
            <input name="password" required className="mt-1 w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">역할</label>
            <select name="role" required className="mt-1 w-36 rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">부서 (HR/부서담당자)</label>
            <select name="departmentId" className="mt-1 w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">-</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            추가
          </button>
        </form>
      </section>
    </div>
  );
}
