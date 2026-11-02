import { redirect } from "next/navigation";
import { dashboardQuery } from "@/components/dashboard/dashboard-data";
import { OrganizationDashboard } from "@/components/dashboard/organization-dashboard";
import { SupervisorDashboard } from "@/components/dashboard/supervisor-dashboard";
import { WorkerDashboard } from "@/components/dashboard/worker-dashboard";
import { getCurrentUser } from "@/lib/auth";
import { getChecklistDashboard, getChecklistFollowUps } from "@/lib/checklist-queries";
import { getManualWorkDashboard } from "@/lib/manual-work-queries";
import { getAllAuditLogs, getSupervisorOverview, getWorkerOverview } from "@/lib/queries";
import { getOrganizationOverview, getSupervisors } from "@/lib/supervisor-queries";

export const metadata = {
  title: "Beranda",
};

const CHECKLIST_PREVIEW = { pageIndex: 0, pageSize: 5 };
const FOLLOW_UP_PREVIEW = { pageIndex: 0, pageSize: 4 };
const MANUAL_WORK_PREVIEW = 3;

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role === "super_admin") {
    return (
      <OrganizationDashboard
        user={user}
        overview={dashboardQuery(() => getOrganizationOverview())}
        supervisors={dashboardQuery(() => getSupervisors())}
        logs={dashboardQuery(() => getAllAuditLogs(6))}
      />
    );
  }

  // One request per query: regions reuse these promises, including queries that
  // generate scheduled checklists or finalize overtime while reading.
  const checklists = dashboardQuery(() => getChecklistDashboard(user, { status: "aktif", includeLate: true }, CHECKLIST_PREVIEW));
  const followUps = dashboardQuery(() => getChecklistFollowUps(
    user,
    user.role === "atasan" ? { status: "aktif" } : { status: "aktif", mine: true },
    FOLLOW_UP_PREVIEW,
  ));
  const manualWorks = dashboardQuery(() => getManualWorkDashboard(user, MANUAL_WORK_PREVIEW));

  if (user.role === "atasan") {
    return (
      <SupervisorDashboard
        user={user}
        overview={dashboardQuery(() => getSupervisorOverview(user))}
        checklists={checklists}
        followUps={followUps}
        manualWorks={manualWorks}
      />
    );
  }

  return (
    <WorkerDashboard
      user={user}
      overview={dashboardQuery(() => getWorkerOverview(user))}
      checklists={checklists}
      followUps={followUps}
      manualWorks={manualWorks}
    />
  );
}
