"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  useSessionOvertimePeriodStartDay,
  useSessionUser,
} from "@/components/session-user-provider";
import { isSuperAdmin } from "@/lib/access";
import { ReportDataSkeleton } from "@/components/reports/report-data-skeleton";
import {
  ReportOptionSkeleton,
  ReportShell,
  reportTab,
  type ReportParams,
} from "@/components/reports/report-shell";

function ReportLoadingShell() {
  const user = useSessionUser();
  const overtimePeriodStartDay = useSessionOvertimePeriodStartDay();
  const searchParams = useSearchParams();
  const params: ReportParams = Object.fromEntries(searchParams.entries());
  const tab = reportTab(params);
  if (user.role !== "atasan" && !isSuperAdmin(user)) return null;
  return (
    <ReportShell
      tab={tab}
      user={user}
      params={params}
      overtimePeriodStartDay={overtimePeriodStartDay}
      optionFilters={<ReportOptionSkeleton tab={tab} />}
    >
      <ReportDataSkeleton tab={tab} />
    </ReportShell>
  );
}

export default function ReportLoading() {
  return (
    <Suspense fallback={<ReportDataSkeleton tab="checklist" />}>
      <ReportLoadingShell />
    </Suspense>
  );
}
