import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TimeZoneBootstrap } from "@/components/time-zone-bootstrap";
import { getActiveTimeZone } from "@/lib/active-time-zone";
import { getCurrentUser } from "@/lib/auth";
import { getManualWorkActiveCount } from "@/lib/manual-work-queries";
import { getUnreadNotificationCount } from "@/lib/notification-store";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const timeZone = getActiveTimeZone();
  const [workActiveCount, notificationUnreadCount] = await Promise.all([
    getManualWorkActiveCount(user),
    getUnreadNotificationCount(user.id),
  ]);

  return (
    <>
      <TimeZoneBootstrap timeZone={timeZone} />
      <AppShell
        user={user}
        workActiveCount={workActiveCount}
        notificationUnreadCount={notificationUnreadCount}
      >
        {children}
      </AppShell>
    </>
  );
}
