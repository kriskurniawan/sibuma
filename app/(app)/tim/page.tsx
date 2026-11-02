import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DataLoadError } from "@/components/data-load-error";
import { TeamCountSkeleton, TeamDivisionFilter, TeamListSkeleton, TeamPageShell, TeamSummary } from "@/components/team/team-page-shell";
import { TeamSupervisorsCount, TeamSupervisorsLoading, TeamSupervisorsRows, TeamSupervisorsSummary } from "@/components/team/team-supervisors-loading";
import { TeamView } from "@/components/team/team-view";
import type { TeamDivisionCountsPromise } from "@/components/team/team-grid-shared";
import { isReadOnly, readOwnerId } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { getDivisions, getTeamOverview, getTeamTotals } from "@/lib/queries";
import { pageRequest } from "@/lib/pagination";
import { getSupervisors } from "@/lib/supervisor-queries";
import type { SessionUser } from "@/lib/types";

export const metadata = { title: "Tim" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function teamData(user: SessionUser, searchParams: SearchParams) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const status = first(params.status);
  const filters = {
    search: first(params.search) ?? "",
    division: first(params.division) ?? "semua",
    status: status === "aktif" || status === "nonaktif" ? status : "semua",
  } as const;
  const printing = first(params.print) === "1";
  const request = pageRequest(first(params.page), first(params.size));
  try {
    const team = await getTeamOverview(readOwnerId(user), filters, printing ? undefined : request);
    return { team, filters, printing, request };
  } catch {
    return null;
  }
}

async function divisionData(user: SessionUser) {
  try { return await getDivisions(readOwnerId(user)); }
  catch { return null; }
}
async function totalsData(user: SessionUser) {
  try { return await getTeamTotals(readOwnerId(user)); }
  catch { return null; }
}
type DivisionPromise = ReturnType<typeof divisionData>;
type TotalsPromise = ReturnType<typeof totalsData>;
type TeamPromise = ReturnType<typeof teamData>;

async function auxiliaryData(divisions: DivisionPromise, totals: TotalsPromise) {
  const [divisionRows, teamTotals] = await Promise.all([divisions, totals]);
  return divisionRows && teamTotals ? { divisions: divisionRows, totals: teamTotals } : null;
}
type AuxiliaryPromise = ReturnType<typeof auxiliaryData>;

async function SummaryData({ data }: { data: AuxiliaryPromise }) {
  const result = await data;
  return result ? <TeamSummary totals={result.totals} divisions={result.divisions} /> : <><TeamSummary failed /><DataLoadError message="Ringkasan tim belum dapat dimuat." /></>;
}

async function CountData({ data }: { data: TeamPromise }) {
  const result = await data;
  return result ? result.team.total : "—";
}

async function WorkerCount({ data }: { data: TotalsPromise }) {
  const result = await data;
  return result ? result.total : "—";
}

async function DivisionCount({ data }: { data: DivisionPromise }) {
  const result = await data;
  return result ? result.length : "—";
}

async function DivisionOptions({ data }: { data: DivisionPromise }) {
  const divisions = await data;
  return divisions ? <TeamDivisionFilter divisions={divisions} unassigned /> : <div className="flex flex-col gap-2"><TeamDivisionFilter /><DataLoadError message="Pilihan divisi belum dapat dimuat." /></div>;
}

async function ListData({ data, divisions, divisionCounts, user }: {
  data: TeamPromise;
  divisions: DivisionPromise;
  divisionCounts: TeamDivisionCountsPromise;
  user: SessionUser;
}) {
  // Only the team query gates rows. Options and counts resolve in their own
  // regions, and employee dialogs await options only after an action.
  const result = await data;
  if (!result) return <DataLoadError message="Daftar tim belum dapat dimuat." />;
  return <TeamView team={result.team.rows} total={result.team.total} pagination={result.team.pagination ?? { pageIndex: 0, pageSize: Math.max(10, result.team.total) }}
    filters={result.filters} printRows={result.printing ? result.team.rows : undefined} divisionOptions={divisions} divisionCounts={divisionCounts} readOnly={isReadOnly(user)} />;
}

async function supervisorData() {
  try { return await getSupervisors(); }
  catch { return null; }
}
type SupervisorPromise = ReturnType<typeof supervisorData>;

async function SupervisorSummary({ data }: { data: SupervisorPromise }) {
  const rows = await data;
  return rows ? <TeamSupervisorsSummary rows={rows} /> : <><TeamSupervisorsSummary failed /><DataLoadError message="Ringkasan atasan belum dapat dimuat." /></>;
}
async function SupervisorCount({ data }: { data: SupervisorPromise }) {
  const rows = await data;
  return rows ? <TeamSupervisorsCount rows={rows} /> : "—";
}
async function SupervisorRows({ data }: { data: SupervisorPromise }) {
  const rows = await data;
  return rows ? <TeamSupervisorsRows rows={rows} /> : <DataLoadError message="Daftar atasan belum dapat dimuat." />;
}

export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "super_admin") {
    const data = supervisorData();
    return <TeamSupervisorsLoading
      summary={<Suspense fallback={<TeamSupervisorsSummary />}><SupervisorSummary data={data} /></Suspense>}
      count={<Suspense fallback={<TeamCountSkeleton />}><SupervisorCount data={data} /></Suspense>}
    >
      <Suspense fallback={<TeamListSkeleton kind="atasan" />}><SupervisorRows data={data} /></Suspense>
    </TeamSupervisorsLoading>;
  }
  if (user.role !== "atasan") redirect("/");

  const data = teamData(user, searchParams);
  const divisions = divisionData(user);
  const totals = totalsData(user);
  const divisionCounts = totals.then((result) => result?.divisions ?? null);
  const auxiliary = auxiliaryData(divisions, totals);
  return <TeamPageShell user={user}
    summary={<Suspense fallback={<TeamSummary />}><SummaryData data={auxiliary} /></Suspense>}
    count={<Suspense fallback={<TeamCountSkeleton />}><CountData data={data} /></Suspense>}
    workerCount={<Suspense fallback={<TeamCountSkeleton />}><WorkerCount data={totals} /></Suspense>}
    divisionCount={<Suspense fallback={<TeamCountSkeleton />}><DivisionCount data={divisions} /></Suspense>}
    divisionFilter={<Suspense fallback={<TeamDivisionFilter />}><DivisionOptions data={divisions} /></Suspense>}
  >
    <Suspense fallback={<TeamListSkeleton />}><ListData data={data} divisions={divisions} divisionCounts={divisionCounts} user={user} /></Suspense>
  </TeamPageShell>;
}
