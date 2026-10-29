import { redirect } from "next/navigation";
import { OrganizationDashboard } from "@/components/dashboard/organization-dashboard";
import { SupervisorDashboard } from "@/components/dashboard/supervisor-dashboard";
import { WorkerDashboard } from "@/components/dashboard/worker-dashboard";
import { getCurrentUser } from "@/lib/auth";
import {
  getChecklistDashboard,
  getChecklistFollowUps,
} from "@/lib/checklist-queries";
import {
  getAllAuditLogs,
  getSupervisorOverview,
  getWorkerOverview,
} from "@/lib/queries";
import { getOrganizationOverview, getSupervisors } from "@/lib/supervisor-queries";

export const metadata = {
  title: "Beranda",
};

const CHECKLIST_PREVIEW = { pageIndex: 0, pageSize: 5 };
const FOLLOW_UP_PREVIEW = { pageIndex: 0, pageSize: 4 };

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role === "super_admin") {
    const [overview, supervisors, logs] = await Promise.all([
      getOrganizationOverview(),
      getSupervisors(),
      getAllAuditLogs(6),
    ]);

    return (
      <OrganizationDashboard
        user={user}
        overview={overview}
        supervisors={supervisors}
        logs={logs}
      />
    );
  }

  if (user.role === "atasan") {
    const [checklists, followUps, overview] = await Promise.all([
      getChecklistDashboard(user, { status: "aktif" }, CHECKLIST_PREVIEW),
      getChecklistFollowUps(user, { status: "aktif" }, FOLLOW_UP_PREVIEW),
      getSupervisorOverview(user),
    ]);

    return (
      <SupervisorDashboard
        user={user}
        overview={overview}
        checklists={checklists.items}
        checklistTotals={checklists.totals}
        followUps={followUps.items}
        openFollowUpTotal={followUps.total}
      />
    );
  }

  const [checklists, followUps, overview] = await Promise.all([
    getChecklistDashboard(user, { status: "aktif" }, CHECKLIST_PREVIEW),
    getChecklistFollowUps(
      user,
      { status: "aktif", mine: true },
      FOLLOW_UP_PREVIEW,
    ),
    getWorkerOverview(user),
  ]);

  return (
    <WorkerDashboard
      user={user}
      overview={overview}
      checklists={checklists.items}
      checklistTotals={checklists.totals}
      followUps={followUps.items}
      myFollowUpTotal={followUps.total}
    />
  );
}
