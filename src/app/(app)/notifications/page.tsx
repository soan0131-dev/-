import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  async function markAllRead() {
    "use server";
    const session = await auth();
    if (!session) redirect("/login");
    await prisma.notification.updateMany({
      where: { userId: session.user.id, isRead: false },
      data: { isRead: true },
    });
    redirect("/notifications");
  }

  async function markRead(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session) redirect("/login");
    const notificationId = formData.get("notificationId") as string;
    await prisma.notification.updateMany({
      where: { id: notificationId, userId: session.user.id },
      data: { isRead: true },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">알림함</h1>
        <form action={markAllRead}>
          <button type="submit" className="text-sm text-slate-500 hover:underline">
            모두 읽음 처리
          </button>
        </form>
      </div>

      <div className="space-y-2">
        {notifications.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
            알림이 없습니다.
          </p>
        )}
        {notifications.map((n) => (
          <form
            key={n.id}
            action={markRead}
            className={`flex items-center justify-between rounded-lg border p-4 ${
              n.isRead ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50"
            }`}
          >
            <input type="hidden" name="notificationId" value={n.id} />
            <div>
              {n.link ? (
                <Link href={n.link} className="text-sm font-medium text-slate-900 hover:underline">
                  {n.message}
                </Link>
              ) : (
                <p className="text-sm font-medium text-slate-900">{n.message}</p>
              )}
              <p className="text-xs text-slate-400">{formatDateTime(n.createdAt)}</p>
            </div>
            {!n.isRead && (
              <button type="submit" className="text-xs text-slate-500 hover:underline">
                읽음 처리
              </button>
            )}
          </form>
        ))}
      </div>
    </div>
  );
}
