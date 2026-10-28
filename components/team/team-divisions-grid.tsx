"use client";

import { useMemo } from "react";
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
import type { Division } from "@/lib/types";
import {
  TEAM_PAGE_SIZES,
  teamGridI18n,
  type TeamDivisionRow,
} from "@/components/team/team-grid-shared";

interface TeamDivisionsGridProps {
  rows: TeamDivisionRow[];
  activeDivisionTotal: number;
  busyId: string | null;
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

function deactivationBlockedReason(
  row: TeamDivisionRow,
  activeDivisionTotal: number,
) {
  if (!row.division.active) return undefined;
  if (row.workerCount > 0) {
    return "Pindahkan pekerja ke divisi lain terlebih dahulu.";
  }
  if (activeDivisionTotal <= 1) {
    return "Minimal satu divisi aktif harus tersedia.";
  }
  return undefined;
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
  activeDivisionTotal,
  busyId,
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
        accessorFn: (row) => row.workerCount,
        header: "Jumlah pekerja",
        meta: {
          headerClassName: "whitespace-nowrap",
          cellClassName: "whitespace-nowrap",
        },
        cell: ({ row }) => (
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-medium text-foreground tabular-nums">
              {row.original.workerCount}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {row.original.activeWorkerCount} aktif
            </span>
          </div>
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
    [],
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
        const blockedReason = deactivationBlockedReason(
          row.original,
          activeDivisionTotal,
        );
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onToggle(division)}
              disabled={busy || Boolean(blockedReason)}
              title={blockedReason}
            >
              {busy ? <Spinner /> : <Power aria-hidden="true" />}
              {division.active ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </div>
        );
      },
    };
    return [...dataColumns, actionColumn];
  }, [activeDivisionTotal, busyId, dataColumns, onAdd, onEdit, onToggle]);

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
                const blockedReason = deactivationBlockedReason(
                  row,
                  activeDivisionTotal,
                );
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
                      <p className="text-xs text-muted-foreground">
                        <span className="text-sm font-medium text-foreground tabular-nums">
                          {row.workerCount}
                        </span>{" "}
                        pekerja ·{" "}
                        <span className="tabular-nums">
                          {row.activeWorkerCount} aktif
                        </span>
                      </p>
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggle(division)}
                          disabled={busy || Boolean(blockedReason)}
                          title={blockedReason}
                        >
                          {busy ? <Spinner /> : <Power aria-hidden="true" />}
                          {division.active ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                      </div>
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

      <PrintDivisionsTable
        key={rows.length}
        rows={rows}
        columns={dataColumns}
      />
    </>
  );
}
