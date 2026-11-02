"use client";

import { Suspense, use, useMemo } from "react";
import { DataLoadError } from "@/components/data-load-error";
import { Building2, PencilLine, Power, UserPlus } from "lucide-react";
import { useTable, type ColumnDef } from "@tanstack/react-table";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { IconTile } from "@/components/reui/icon-tile";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import type { Division } from "@/lib/types";
import {
  TEAM_PAGE_SIZES,
  teamGridI18n,
  type TeamDivisionRow,
  type TeamDivisionCountsPromise,
} from "@/components/team/team-grid-shared";

interface TeamDivisionsGridProps {
  rows: TeamDivisionRow[];
  divisionCounts: TeamDivisionCountsPromise;
  activeDivisionTotal: number;
  busyId: string | null;
  readOnly?: boolean;
  onAdd: (division: Division) => void;
  onEdit: (division: Division) => void;
  onToggle: (division: Division) => void;
}

const TABLE_CLASSES = {
  base: "min-w-[56rem]",
  headerRow: "bg-muted/40",
};

const PRINT_TABLE_CLASSES = {
  base: "min-w-0",
  headerRow: "bg-muted/40",
};

function DivisionWorkerCount({ id, data, compact = false }: { id: string; data: TeamDivisionCountsPromise; compact?: boolean }) {
  const counts = use(data);
  if (!counts) return <span className="text-xs text-muted-foreground">Jumlah pekerja belum tersedia</span>;
  // Absence means zero only after the complete counts query succeeds.
  const count = counts.find((row) => row.id === id);
  return <span className="inline-flex items-baseline gap-1.5">
    <span className="text-sm font-medium text-foreground tabular-nums">{count?.total ?? 0}</span>
    <span className="text-xs text-muted-foreground tabular-nums">{compact && "pekerja · "}{count?.active ?? 0} aktif</span>
  </span>;
}

function DivisionToggleButton({ division, busy, blockedReason, onToggle }: {
  division: Division;
  busy: boolean;
  blockedReason?: string;
  onToggle: (division: Division) => void;
}) {
  return <Button type="button" variant="ghost" size="sm" onClick={() => onToggle(division)} disabled={busy || Boolean(blockedReason)} title={blockedReason}>
    {busy ? <Spinner /> : <Power aria-hidden="true" />}
    {division.active ? "Nonaktifkan" : "Aktifkan"}
  </Button>;
}

function DivisionDeactivate({ division, busy, data, onToggle }: {
  division: Division;
  busy: boolean;
  data: TeamDivisionCountsPromise;
  onToggle: (division: Division) => void;
}) {
  const counts = use(data);
  const count = counts?.find((row) => row.id === division.id);
  const blockedReason = !counts
    ? "Jumlah pekerja belum dapat dimuat. Coba lagi terlebih dahulu."
    : count && count.total > 0 ? "Pindahkan pekerja ke divisi lain terlebih dahulu." : undefined;
  return <DivisionToggleButton division={division} busy={busy} blockedReason={blockedReason} onToggle={onToggle} />;
}

function DivisionToggle({ division, busy, data, activeDivisionTotal, onToggle }: {
  division: Division;
  busy: boolean;
  data: TeamDivisionCountsPromise;
  activeDivisionTotal: number;
  onToggle: (division: Division) => void;
}) {
  if (!division.active || activeDivisionTotal <= 1) return <DivisionToggleButton division={division} busy={busy} blockedReason={division.active ? "Minimal satu divisi aktif harus tersedia." : undefined} onToggle={onToggle} />;
  return <Suspense fallback={<DivisionToggleButton division={division} busy={busy} blockedReason="Menunggu jumlah pekerja divisi." onToggle={onToggle} />}>
    <DivisionDeactivate division={division} busy={busy} data={data} onToggle={onToggle} />
  </Suspense>;
}

function DivisionCountsError({ data }: { data: TeamDivisionCountsPromise }) {
  return use(data) ? null : <div className="p-4 print:hidden"><DataLoadError message="Jumlah pekerja divisi belum dapat dimuat. Nonaktifkan divisi dikunci sampai jumlah pekerja tersedia." /></div>;
}

function PrintDivisionsTable({
  rows,
  columns,
}: {
  rows: TeamDivisionRow[];
  columns: ColumnDef<DataGridFeatures, TeamDivisionRow>[];
}) {
  const table = useTable({
    features: dataGridFeatures,
    data: rows,
    columns,
    initialState: {
      pagination: { pageIndex: 0, pageSize: Math.max(rows.length, 1) },
    },
    getRowId: (row) => row.division.id,
  });

  return (
    <div className="hidden print:block">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium text-muted-foreground">
            SIBUMA · Sistem Building Management
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Daftar divisi
          </h2>
        </div>
        <p className="text-xs font-medium text-muted-foreground tabular-nums">
          {rows.length} divisi
        </p>
      </div>
      <DataGrid
        table={table}
        recordCount={rows.length}
        tableLayout={{ dense: true, width: "auto", headerBorder: true }}
        tableClassNames={PRINT_TABLE_CLASSES}
      >
        <DataGridContainer>
          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>
        </DataGridContainer>
      </DataGrid>
    </div>
  );
}

export function TeamDivisionsGrid({
  rows,
  divisionCounts,
  activeDivisionTotal,
  busyId,
  readOnly = false,
  onAdd,
  onEdit,
  onToggle,
}: TeamDivisionsGridProps) {
  const dataColumns = useMemo<ColumnDef<DataGridFeatures, TeamDivisionRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.division.name,
        header: "Nama",
        meta: {
          headerClassName: "whitespace-nowrap",
          cellClassName: "max-w-56",
        },
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <IconTile
              variant="soft"
              size="sm"
              className="text-primary"
              aria-hidden="true"
            >
              <Building2 />
            </IconTile>
            <span className="truncate text-sm font-medium text-foreground">
              {row.original.division.name}
            </span>
          </div>
        ),
      },
      {
        id: "description",
        accessorFn: (row) => row.division.description,
        header: "Deskripsi",
        meta: {
          headerClassName: "whitespace-nowrap",
          cellClassName: "max-w-80",
        },
        cell: ({ row }) => {
          const description = row.original.division.description;
          return (
            <span
              className="block max-w-80 truncate text-xs text-muted-foreground"
              title={description || undefined}
            >
              {description || "—"}
            </span>
          );
        },
      },
      {
        id: "workers",
        accessorFn: (row) => row.division.id,
        header: "Jumlah pekerja",
        meta: {
          headerClassName: "whitespace-nowrap",
          cellClassName: "whitespace-nowrap",
        },
        cell: ({ row }) => (
          <Suspense fallback={<Skeleton className="h-4 w-28" role="status" aria-label="Memuat jumlah pekerja divisi" />}>
            <DivisionWorkerCount id={row.original.division.id} data={divisionCounts} />
          </Suspense>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => row.division.active,
        header: "Status",
        meta: {
          headerClassName: "whitespace-nowrap",
          cellClassName: "whitespace-nowrap",
        },
        cell: ({ row }) => (
          <Badge
            variant={row.original.division.active ? "success-light" : "outline"}
            dot={row.original.division.active}
          >
            {row.original.division.active ? "Aktif" : "Nonaktif"}
          </Badge>
        ),
      },
    ],
    [divisionCounts],
  );

  const columns = useMemo<ColumnDef<DataGridFeatures, TeamDivisionRow>[]>(() => {
    const actionColumn: ColumnDef<DataGridFeatures, TeamDivisionRow> = {
      id: "actions",
      header: "Aksi",
      meta: {
        headerClassName: "whitespace-nowrap text-end [&>div]:justify-end",
        cellClassName: "whitespace-nowrap text-end",
      },
      cell: ({ row }) => {
        const division = row.original.division;
        const busy = busyId === division.id;
        return (
          <div className="flex justify-end gap-1">
            {division.active && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onAdd(division)}
              >
                <UserPlus aria-hidden="true" />
                Tambah
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEdit(division)}
            >
              <PencilLine aria-hidden="true" />
              Ubah
            </Button>
            <DivisionToggle division={division} busy={busy} data={divisionCounts} activeDivisionTotal={activeDivisionTotal} onToggle={onToggle} />
          </div>
        );
      },
    };
    return readOnly ? dataColumns : [...dataColumns, actionColumn];
  }, [activeDivisionTotal, busyId, dataColumns, divisionCounts, onAdd, onEdit, onToggle, readOnly]);

  const table = useTable({
    features: dataGridFeatures,
    data: rows,
    columns,
    initialState: {
      pagination: { pageIndex: 0, pageSize: TEAM_PAGE_SIZES[0] },
    },
    getRowId: (row) => row.division.id,
  });

  const pageRows = table.getRowModel().rows.map((row) => row.original);

  return (
    <>
      <div className="print:hidden">
        <DataGrid
          table={table}
          recordCount={rows.length}
          i18n={teamGridI18n}
          tableLayout={{ dense: true, width: "auto", headerBorder: true }}
          tableClassNames={TABLE_CLASSES}
        >
          <div className="flex w-full flex-col">
            <div className="hidden md:block">
              <DataGridContainer>
                <DataGridScrollArea>
                  <DataGridTable />
                </DataGridScrollArea>
              </DataGridContainer>
            </div>

            <div className="divide-y divide-border/70 md:hidden">
              {pageRows.map((row) => {
                const division = row.division;
                const busy = busyId === division.id;
                return (
                  <article
                    key={division.id}
                    className="flex flex-col gap-3 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <IconTile
                          variant="soft"
                          size="sm"
                          className="text-primary"
                          aria-hidden="true"
                        >
                          <Building2 />
                        </IconTile>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {division.name}
                          </p>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {division.description || "Tanpa deskripsi"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          division.active ? "success-light" : "outline"
                        }
                        dot={division.active}
                        className="shrink-0"
                      >
                        {division.active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
                      <Suspense fallback={<Skeleton className="h-4 w-28" role="status" aria-label="Memuat jumlah pekerja divisi" />}>
                        <DivisionWorkerCount id={division.id} data={divisionCounts} compact />
                      </Suspense>
                      {!readOnly && (
                        <div className="flex flex-wrap justify-end gap-1">
                          {division.active && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onAdd(division)}
                            >
                              <UserPlus aria-hidden="true" />
                              Tambah
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(division)}
                          >
                            <PencilLine aria-hidden="true" />
                            Ubah
                          </Button>
                          <DivisionToggle division={division} busy={busy} data={divisionCounts} activeDivisionTotal={activeDivisionTotal} onToggle={onToggle} />
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="border-t border-border/70 px-4 py-2">
              <DataGridPagination sizes={TEAM_PAGE_SIZES} />
            </div>
          </div>
        </DataGrid>
      </div>

      <Suspense fallback={null}><DivisionCountsError data={divisionCounts} /></Suspense>
      <PrintDivisionsTable
        key={rows.length}
        rows={rows}
        columns={dataColumns}
      />
    </>
  );
}
