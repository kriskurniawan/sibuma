import { redirect } from "next/navigation";
import { AuditView } from "@/components/audit/audit-view";
import { getCurrentUser, isDemoMode } from "@/lib/auth";
import { getAuditLogs, getNotifications } from "@/lib/queries";

export const metadata = {
  title: "Log audit",
};

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "atasan") redirect("/");

  const [logs, notifications] = await Promise.all([
    getAuditLogs(user.id, 200),
    getNotifications(user.id, 100),
  ]);

  return (
    <AuditView
      logs={logs}
      notifications={notifications}
      demoMode={isDemoMode()}
    />
  );
}
