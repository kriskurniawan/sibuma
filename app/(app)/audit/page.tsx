import { redirect } from "next/navigation";
import { AuditShell } from "@/components/audit/audit-shell";
import type { AuditDataPromise } from "@/components/audit/audit-data";
import { isReadOnly, isSuperAdmin } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { getAllAuditLogs, getAuditLogs, getNotifications } from "@/lib/queries";

export const metadata = { title: "Log audit" };

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "atasan" && !isSuperAdmin(user)) redirect("/");
  if (isReadOnly(user)) redirect("/");

  // Only database work is caught. Authorization redirects remain outside this promise.
  const dataPromise: AuditDataPromise = Promise.all([
    isSuperAdmin(user) ? getAllAuditLogs(200) : getAuditLogs(user.id, 200),
    isSuperAdmin(user)
      ? getNotifications(null, 200)
      : getNotifications(user.id, 100),
  ])
    .then(([logs, notifications]) => ({ logs, notifications }))
    .catch(() => null);

  return <AuditShell dataPromise={dataPromise} />;
}
