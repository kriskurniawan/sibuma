import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ChecklistReportScreen } from "@/components/reports/checklist-report-screen";
import { FollowUpReportScreen } from "@/components/reports/follow-up-report-screen";
import { ManualWorkReportScreen } from "@/components/reports/manual-work-report-screen";
import { OvertimeReportScreen } from "@/components/reports/overtime-report-screen";
import { ReportDataSkeleton } from "@/components/reports/report-data-skeleton";
import { ReportOptionFilters } from "@/components/reports/report-option-filters";
import {
  ReportOptionSkeleton,
  ReportShell,
  reportTab,
  type ReportParams,
} from "@/components/reports/report-shell";
import { isSuperAdmin } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Laporan & rekap" };

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<ReportParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "atasan" && !isSuperAdmin(user)) redirect("/riwayat");
  const params = await searchParams;
  const tab = reportTab(params);
  const key = JSON.stringify(params);
  return (
    <ReportShell
      tab={tab}
      user={user}
      params={params}
      printedAt={new Date().toISOString()}
      optionFilters={
        <Suspense
          key={`options-${key}`}
          fallback={<ReportOptionSkeleton tab={tab} />}
        >
          <ReportOptionFilters tab={tab} user={user} params={params} />
        </Suspense>
      }
    >
      <Suspense key={key} fallback={<ReportDataSkeleton tab={tab} />}>
        {tab === "checklist" ? (
          <ChecklistReportScreen user={user} params={params} />
        ) : tab === "tindak-lanjut" ? (
          <FollowUpReportScreen user={user} params={params} />
        ) : tab === "pekerjaan" ? (
          <ManualWorkReportScreen user={user} params={params} />
        ) : (
          <OvertimeReportScreen user={user} params={params} />
        )}
      </Suspense>
    </ReportShell>
  );
}
