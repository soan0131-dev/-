import { auth, signOut } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/format";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;

  const unreadCount = user
    ? await prisma.notification.count({ where: { userId: user.id, isRead: false } })
    : 0;

  const navItems = [
    { href: "/", label: "대시보드" },
    { href: "/employees", label: "전직원 현황판" },
    { href: "/cases", label: "입퇴사 케이스" },
    { href: "/my-approvals", label: "내 승인함" },
    { href: "/notifications", label: `알림${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
  ];

  if (user?.role === "ADMIN") {
    navItems.push({ href: "/admin/templates", label: "관리자" });
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-8">
            <span className="text-base font-semibold text-slate-900">입퇴사자 관리 시스템</span>
            <nav className="flex gap-4 text-sm text-slate-600">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-slate-900">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          {user && (
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <span>
                {user.name} · {ROLE_LABELS[user.role] ?? user.role}
              </span>
              <form action={signOutAction}>
                <button type="submit" className="text-slate-500 hover:text-slate-900">
                  로그아웃
                </button>
              </form>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
