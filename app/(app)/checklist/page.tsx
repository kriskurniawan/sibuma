import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  ChecklistCountSkeleton,
  ChecklistListSkeleton,
  ChecklistRows,
  ChecklistSummary,
  ChecklistView,
  type ChecklistFilters,
} from "@/components/checklist/checklist-view";
import { ChecklistLocationFilter } from "@/components/checklist/checklist-primary-filters";
import { DataLoadError } from "@/components/data-load-error";
import { isReadOnly } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { checklistReadOwner } from "@/lib/checklist-access";
import { getChecklistDashboard, getChecklistLocations } from "@/lib/checklist-queries";
import { pageRequest } from "@/lib/pagination";
import { todayLocal } from "@/lib/time";
import type { SessionUser } from "@/lib/types";

export const metadata = { title: "Checklist" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function dashboardData(user: SessionUser, searchParams: SearchParams) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const status = first(params.status) ?? "aktif";
  const filters: ChecklistFilters = {
    status,
    locationId: first(params.locationId) ?? "",
    search: first(params.search) ?? "",
    includeSubLocations: first(params.includeSub) !== "0",
  };
  const request = pageRequest(first(params.page), first(params.size));
  // "Aktif" adalah daftar kerja hari ini; jadwal hari lain tetap tersedia
  // lewat filter status lain. Setelah semua selesai, daftar ini kosong.
  const today = status === "aktif" ? todayLocal() : null;
  try {
    const data = await getChecklistDashboard(
      user,
      today ? { ...filters, from: today, to: today } : filters,
      request,
    );
    return { data, filters, request };
  } catch {
    return null;
  }
}

type DashboardPromise = ReturnType<typeof dashboardData>;

async function SummaryData({ data }: { data: DashboardPromise }) {
  const result = await data;
  return result ? <ChecklistSummary totals={result.data.totals} /> : <><ChecklistSummary failed /><DataLoadError message="Ringkasan checklist belum dapat dimuat." /></>;
}

async function CountData({ data, followUps = false }: { data: DashboardPromise; followUps?: boolean }) {
  const result = await data;
  if (!result) return <span aria-label="Jumlah belum tersedia">—</span>;
  if (!followUps) return result.data.total;
  const count = result.data.totals.openFollowUps;
  return count > 0 ? <span className="rounded-full bg-primary-foreground/20 px-1.5 text-xs tabular-nums">{count}</span> : null;
}

async function ListData({ data, user }: { data: DashboardPromise; user: SessionUser }) {
  const result = await data;
  if (!result) return <DataLoadError message="Daftar checklist belum dapat dimuat." />;
  return <ChecklistRows items={result.data.items} total={result.data.total} pagination={result.data.pagination ?? result.request}
    filters={result.filters} canManage={user.role === "atasan" && !isReadOnly(user)} readOnly={isReadOnly(user)} />;
}

async function LocationFilters({ user }: { user: SessionUser }) {
  try {
    const locations = await getChecklistLocations(checklistReadOwner(user));
    return <ChecklistLocationFilter locations={locations} />;
  } catch {
    return <div className="flex flex-col gap-2"><ChecklistLocationFilter /><DataLoadError message="Pilihan lokasi belum dapat dimuat." /></div>;
  }
}

export default async function ChecklistPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "super_admin") redirect("/");

  // Query work starts below the authenticated static shell, not before it.
  const data = dashboardData(user, searchParams);
  return <ChecklistView user={user}
    summary={<Suspense fallback={<ChecklistSummary />}><SummaryData data={data} /></Suspense>}
    count={<Suspense fallback={<ChecklistCountSkeleton />}><CountData data={data} /></Suspense>}
    followUpCount={<Suspense fallback={<ChecklistCountSkeleton />}><CountData data={data} followUps /></Suspense>}
    filtersRegion={<Suspense fallback={<ChecklistLocationFilter />}><LocationFilters user={user} /></Suspense>}
  >
    <Suspense fallback={<ChecklistListSkeleton />}><ListData data={data} user={user} /></Suspense>
  </ChecklistView>;
}
