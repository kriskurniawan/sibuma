"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, Building2, Camera, Clock3, FolderPlus, LockKeyhole, Search, UserPlus, UsersRound, X } from "lucide-react";
import { useDebouncedFilterValue, useFilterNavigation } from "@/components/filters/use-filter-navigation";
import { MobileFab } from "@/components/mobile-fab";
import { MobileSummary } from "@/components/mobile-summary";
import { ReportPrintButton } from "@/components/reports/report-print-button";
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { useSessionUser } from "@/components/session-user-provider";
import { TeamPrimaryGridSkeleton } from "@/components/team/team-primary-grid-skeleton";
import { PageHeader, StatCard } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isReadOnly } from "@/lib/access";
import type { getTeamTotals } from "@/lib/team-queries";
import type { Division, SessionUser } from "@/lib/types";

export type TeamTab = "pekerja" | "divisi";
export type TeamStatus = "semua" | "aktif" | "nonaktif";
interface TeamPageState {
  tab: TeamTab;
  divisionSearch: string;
  divisionStatus: TeamStatus;
  workerDivision: string;
  setWorkerDivision: (value: string) => void;
  clearDivisionFilters: () => void;
}
const TeamPageContext = createContext<TeamPageState | null>(null);
export function useTeamPageState() { return useContext(TeamPageContext); }
const STATUSES = { semua: "Semua status", aktif: "Aktif", nonaktif: "Nonaktif" };

export function TeamCountSkeleton() {
  return <Skeleton className="inline-block h-3 w-8 align-middle" />;
}

export function TeamSummary({ totals, divisions, failed = false }: {
  totals?: Awaited<ReturnType<typeof getTeamTotals>>;
  divisions?: Division[];
  failed?: boolean;
}) {
  const value = (number?: number) => number === undefined ? failed ? "—" : <Skeleton className="inline-block h-7 w-12 align-middle" /> : number;
  return <>
    <MobileSummary className="no-print md:hidden" items={[
      { label: "Pekerja aktif", value: totals ? `${totals.active}/${totals.total}` : value(), tone: "primary" },
      { label: "Durasi periode ini", value: totals ? `${Math.floor(totals.minutes / 60)} jam ${totals.minutes % 60} mnt` : value(), tone: "info" },
      { label: "Sesi absensi", value: value(totals?.sessions), tone: "primary" },
      { label: "Foto kerja", value: value(totals?.documents), tone: "primary" },
    ]} />
    <div className="no-print hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Anggota aktif" value={value(totals?.active)} suffix={totals ? `/ ${totals.total}` : undefined} icon={UsersRound} helper={divisions ? `${divisions.filter((division) => division.active).length} divisi aktif` : failed ? "—" : <TeamCountSkeleton />} tone="primary" />
      <StatCard label="Durasi periode ini" value={value(totals ? Math.floor(totals.minutes / 60) : undefined)} suffix="jam" icon={Clock3} helper={totals ? `${totals.minutes % 60} menit · ${totals.periodLabel}` : failed ? "—" : <TeamCountSkeleton />} tone="info" />
      <StatCard label="Sesi absensi" value={value(totals?.sessions)} suffix="sesi" icon={BadgeCheck} helper="Absensi masuk periode ini" />
      <StatCard label="Dokumentasi" value={value(totals?.documents)} suffix="foto" icon={Camera} helper="Bukti kerja yang diunggah" />
    </div>
  </>;
}

export function TeamDivisionFilter({ divisions, unassigned = false }: { divisions?: Division[]; unassigned?: boolean }) {
  const state = useTeamPageState();
  if (!state) return null;
  const items: Record<string, string> = { semua: "Semua divisi" };
  if (unassigned) items.tanpa = "Tanpa divisi";
  for (const division of divisions ?? []) items[division.id] = division.active ? division.name : `${division.name} (nonaktif)`;
  // Preserve a selected id while its label/options are being fetched.
  if (!(state.workerDivision in items)) items[state.workerDivision] = "Divisi terpilih";
  return <Select items={items} value={state.workerDivision} disabled={!divisions} onValueChange={(next) => { if (next !== null) state.setWorkerDivision(String(next)); }}>
    <SelectTrigger size="sm" className="min-w-0 flex-1 sm:w-44 sm:flex-none" aria-label="Filter divisi"><SelectValue /></SelectTrigger>
    <SelectContent>{Object.entries(items).map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent>
  </Select>;
}

export function TeamListSkeleton({ kind }: { kind?: "pekerja" | "divisi" | "atasan" }) {
  const state = useTeamPageState();
  const variant = kind ?? state?.tab ?? "pekerja";
  return <div aria-busy="true" role="status" aria-label="Memuat daftar tim">
    <TeamPrimaryGridSkeleton kind={variant} />
    <div className="divide-y divide-border/70 md:hidden">{Array.from({ length: 4 }, (_, index) => <div key={index} className="flex min-w-0 flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1"><Skeleton className="h-4 w-40 max-w-full" /><Skeleton className="h-3 w-28 max-w-full" />{variant !== "divisi" && <><Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-36" /><Skeleton className="h-3 w-24" /></>}</div>
        </div>
        <Skeleton className="h-5 w-16 shrink-0" />
      </div>
      {variant !== "divisi" ? <div className="grid grid-cols-3 gap-2 border-y border-border/70 py-2.5">{(variant === "atasan" ? ["Anggota tim", "Divisi", "Hak akses"] : ["Durasi", "Sesi", "Bukti"]).map((label) => <div key={label} className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{label}</span><Skeleton className="h-4 w-12" /></div>)}</div> : <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3"><Skeleton className="h-4 w-28" /><div className="flex justify-end gap-1"><Skeleton className="h-7 w-16" /><Skeleton className="h-7 w-16" /><Skeleton className="h-7 w-24" /></div></div>}
      {variant !== "divisi" && <div className="flex justify-end gap-2"><Skeleton className="h-7 w-16" />{variant !== "atasan" && <Skeleton className="h-7 w-24" />}</div>}
    </div>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-2"><Skeleton className="h-8 w-44 max-w-full" /><Skeleton className="h-8 w-40 max-w-full" /></div>
  </div>;
}

/** Shell owns controls and dialog triggers, while list/modals stream as children. */
export function TeamPageShell({ user: snapshot, summary, count, workerCount, divisionCount, divisionFilter, children }: {
  user?: SessionUser;
  summary?: ReactNode;
  count?: ReactNode;
  workerCount?: ReactNode;
  divisionCount?: ReactNode;
  divisionFilter?: ReactNode;
  children?: ReactNode;
}) {
  const sessionUser = useSessionUser();
  const user = snapshot ?? sessionUser;
  const params = useSearchParams();
  const { navigate } = useFilterNavigation({ division: "semua", status: "semua" });
  const workerSearch = useDebouncedFilterValue(params.get("search") ?? "", (next) => navigate({ search: next }));
  const workerDivision = params.get("division") ?? "semua";
  const statusParam = params.get("status");
  const workerStatus = statusParam === "aktif" || statusParam === "nonaktif" ? statusParam : "semua";
  const [tab, setTab] = useState<TeamTab>("pekerja");
  const [divisionSearch, setDivisionSearch] = useState("");
  const [divisionStatus, setDivisionStatus] = useState<TeamStatus>("semua");
  if (user.role !== "atasan") return null;
  const readOnly = isReadOnly(user);
  const workerFiltersActive = Boolean(workerSearch.text || workerDivision !== "semua" || workerStatus !== "semua");
  const divisionFiltersActive = Boolean(divisionSearch || divisionStatus !== "semua");
  const context = { tab, divisionSearch, divisionStatus, workerDivision, setWorkerDivision: (next: string) => navigate({ division: next }), clearDivisionFilters: () => { setDivisionSearch(""); setDivisionStatus("semua"); } };

  function clearFilters() {
    if (tab === "divisi") { setDivisionSearch(""); setDivisionStatus("semua"); }
    else { workerSearch.reset(); navigate({ search: null, division: null, status: null }); }
  }

  return <TeamPageContext.Provider value={context}>
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader mobileCompact className="no-print" eyebrow={readOnly ? "Lihat tim" : "Kelola tim"} title="Tim." description={readOnly ? "Pekerja, divisi, dan beban kerja tim." : "Kelola pekerja, divisi, dan penempatan tim."} descriptionClassName="hidden md:block" action={
        <div className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto print:hidden">
          {!readOnly && <div className="flex shrink-0 items-center gap-2 max-md:hidden">
            <Button type="button" size="sm" data-dialog-intent={tab === "divisi" ? "division-new" : "worker-new"} aria-haspopup="dialog">
              {tab === "divisi" ? <FolderPlus /> : <UserPlus />}{tab === "divisi" ? "Tambah divisi" : "Tambah pekerja"}
            </Button>
            {tab === "pekerja" && <Button type="button" size="sm" variant="outline" data-dialog-intent="division-new" aria-haspopup="dialog"><FolderPlus />Tambah divisi</Button>}
          </div>}
          <ReportPrintButton variant="outline" />
        </div>
      } />
      {summary ?? <TeamSummary />}
      <Frame spacing="default" className="min-w-0 w-full self-start">
        <FrameHeader className="gap-3 print:hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-0.5">
              <FrameTitle className="max-md:sr-only">{tab === "pekerja" ? "Pekerja" : "Divisi"}</FrameTitle>
              <FrameDescription className="text-xs">{tab === "pekerja" ? count ?? <TeamCountSkeleton /> : divisionCount ?? <TeamCountSkeleton />} {tab === "pekerja" ? "pekerja" : "divisi"} ditampilkan</FrameDescription>
            </div>
            <Tabs value={tab} onValueChange={(next) => setTab(next as TeamTab)}>
              <TabsList className="w-full sm:w-max">
                <TabsTrigger value="pekerja"><UsersRound aria-hidden="true" />Pekerja<span className="text-xs tabular-nums">{workerCount ?? <TeamCountSkeleton />}</span></TabsTrigger>
                <TabsTrigger value="divisi"><Building2 aria-hidden="true" />Divisi<span className="text-xs tabular-nums">{divisionCount ?? <TeamCountSkeleton />}</span></TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </FrameHeader>
        <FramePanel className="p-0">
          <div className="flex flex-col gap-3 border-b border-border p-4 print:hidden lg:flex-row lg:items-center lg:justify-between">
            <InputGroup className="w-full lg:max-w-xs">
              <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
              <InputGroupInput type="search" value={tab === "pekerja" ? workerSearch.text : divisionSearch} onChange={(event) => tab === "pekerja" ? workerSearch.change(event.target.value) : setDivisionSearch(event.target.value)} onFocus={tab === "pekerja" ? workerSearch.onFocus : undefined} onBlur={tab === "pekerja" ? workerSearch.onBlur : undefined} onKeyDown={(event) => { if (tab === "pekerja" && event.key === "Enter") { event.preventDefault(); workerSearch.commitNow(event.currentTarget.value); } }} placeholder={tab === "pekerja" ? "Cari nama, NIK, HP…" : "Cari nama atau deskripsi…"} aria-label={tab === "pekerja" ? "Cari pekerja" : "Cari divisi"} />
              {(tab === "pekerja" ? workerSearch.text : divisionSearch) && <InputGroupAddon align="inline-end"><InputGroupButton type="button" variant="ghost" size="icon-xs" aria-label="Hapus pencarian" onClick={() => tab === "pekerja" ? workerSearch.commitNow("") : setDivisionSearch("")}><X /></InputGroupButton></InputGroupAddon>}
            </InputGroup>
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto lg:justify-end">
              {tab === "pekerja" && (divisionFilter ?? <TeamDivisionFilter />)}
              <Select items={STATUSES} value={tab === "pekerja" ? workerStatus : divisionStatus} onValueChange={(next) => { if (next !== null) { if (tab === "pekerja") navigate({ status: String(next) }); else setDivisionStatus(next as TeamStatus); } }}>
                <SelectTrigger size="sm" className="min-w-0 flex-1 sm:w-36 sm:flex-none" aria-label={tab === "pekerja" ? "Filter status pekerja" : "Filter status divisi"}><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUSES).map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent>
              </Select>
              {(tab === "pekerja" ? workerFiltersActive : divisionFiltersActive) && <Button type="button" variant="ghost" size="sm" onClick={clearFilters} aria-label="Hapus filter"><X /><span className="hidden sm:inline">Hapus filter</span></Button>}
            </div>
          </div>
          {children ?? <TeamListSkeleton />}
        </FramePanel>
        <FrameFooter className="hidden flex-row items-start gap-2 print:hidden md:flex"><LockKeyhole className="size-3.5 shrink-0" aria-hidden="true" /><p className="text-xs leading-relaxed text-muted-foreground">Riwayat pekerja nonaktif tetap tersimpan. Divisi harus kosong untuk dinonaktifkan; minimal satu divisi tetap aktif.</p></FrameFooter>
      </Frame>
      {!readOnly && <div data-dialog-intent={tab === "divisi" ? "division-new" : "worker-new"}><MobileFab><>{tab === "divisi" ? <FolderPlus aria-hidden="true" /> : <UserPlus aria-hidden="true" />}{tab === "divisi" ? "Tambah divisi" : "Tambah pekerja"}</></MobileFab></div>}
    </div>
  </TeamPageContext.Provider>;
}
