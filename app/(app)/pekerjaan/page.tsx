import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  loadManualWorkList,
  ManualWorkFilterOptionsData,
  ManualWorkListData,
  ManualWorkListDescriptionData,
  ManualWorkListFooterData,
  ManualWorkSummaryData,
} from "@/components/pekerjaan/manual-work-data";
import { ManualWorkFilters } from "@/components/pekerjaan/manual-work-filters";
import { ManualWorkListFrame, ManualWorkPageShell } from "@/components/pekerjaan/manual-work-list";
import {
  ManualWorkCountSkeleton,
  ManualWorkFiltersSkeleton,
  ManualWorkFooterSkeleton,
  ManualWorkRowsSkeleton,
  ManualWorkSummarySkeleton,
} from "@/components/pekerjaan/manual-work-skeletons";
import { getCurrentUser } from "@/lib/auth";
import { pageRequest } from "@/lib/pagination";

export const metadata = { title: "Pekerjaan Harian" };

const STATUS_VALUES = new Set([
  "aktif", "terlambat", "belum_mulai", "terbuka", "dikerjakan", "selesai", "dibatalkan", "semua",
]);

export default async function ManualWorkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "super_admin") redirect("/");

  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const requestedStatus = first(params.status);
  const requestedDivision = first(params.divisionId);
  const requestedEmployee = first(params.employeeId);
  const filters = {
    status: requestedStatus && STATUS_VALUES.has(requestedStatus) ? requestedStatus : "semua",
    search: first(params.search) ?? "",
    divisionId: requestedDivision && requestedDivision !== "semua" ? requestedDivision : "",
    employeeId: requestedEmployee && requestedEmployee !== "semua" ? requestedEmployee : "",
  };
  const request = pageRequest(first(params.page), first(params.size));
  const result = loadManualWorkList(user, filters, request);

  // Stable boundaries preserve the previous results during URL transitions.
  return (
    <ManualWorkPageShell user={user} summary={
      <Suspense fallback={<ManualWorkSummarySkeleton />}>
        <ManualWorkSummaryData user={user} />
      </Suspense>
    }>
      <ManualWorkListFrame
        description={
          <Suspense fallback={<ManualWorkCountSkeleton />}>
            <ManualWorkListDescriptionData result={result} filters={filters} />
          </Suspense>
        }
        controls={
          <ManualWorkFilters dynamicOptions={
            <Suspense fallback={<ManualWorkFiltersSkeleton />}>
              <ManualWorkFilterOptionsData user={user} />
            </Suspense>
          } />
        }
        footer={
          <Suspense fallback={<ManualWorkFooterSkeleton />}>
            <ManualWorkListFooterData result={result} />
          </Suspense>
        }
      >
        <Suspense fallback={<ManualWorkRowsSkeleton />}>
          <ManualWorkListData result={result} filters={filters} user={user} />
        </Suspense>
      </ManualWorkListFrame>
    </ManualWorkPageShell>
  );
}
