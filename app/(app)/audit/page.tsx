import { redirect } from "next/navigation";
import { AuditView } from "@/components/audit/audit-view";
import { isSuperAdmin } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { getAllAuditLogs, getAuditLogs, getNotifications } from "@/lib/queries";

export const metadata = {
  title: "Log audit",
};

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "atasan" && !isSuperAdmin(user)) redirect("/");

  const [logs, notifications] = await Promise.all([
    isSuperAdmin(user) ? getAllAuditLogs(200) : getAuditLogs(user.id, 200),
    isSuperAdmin(user)
      ? Promise.resolve([])
      : getNotifications(user.id, 100),
  ]);

  return (
    <AuditView logs={logs} notifications={notifications} />
  );
}
