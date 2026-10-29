"use client";

import { useMemo } from "react";
import type { PageRequest } from "@/lib/pagination";
import { useServerGridPagination } from "@/components/server-grid-pagination";
import { Camera, PencilLine, Phone, Power } from "lucide-react";
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
import { Avatar, Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { avatarUrl } from "@/lib/avatar-url";
import type { Division, Employee } from "@/lib/types";
import { cn } from "@/lib/utils";
import { durationLabel } from "@/lib/time";
import {
  TEAM_PAGE_SIZES,
  teamGridI18n,
  type TeamWorkerRow,
} from "@/components/team/team-grid-shared";

interface TeamWorkersGridProps {
  rows: TeamWorkerRow[];
  total: number;
  pagination: PageRequest;
  printRows?: TeamWorkerRow[];
  divisionById: Map<string, Division>;
  busyId: string | null;
  readOnly?: boolean;
  onEdit: (employee: Employee) => void;
  onToggle: (employee: Employee) => void;
}

const TABLE_CLASSES = {
  base: "min-w-[64rem]",
  headerRow: "bg-muted/40",
};

const PRINT_TABLE_CLASSES = {
  base: "min-w-0",
  headerRow: "bg-muted/40",
};

function workerStatus(employee: Employee) {
  return employee.active ? "Aktif" : "Nonaktif";
}

function PrintWorkersTable({
  rows,
  columns,
}: {
  rows: TeamWorkerRow[];
  columns: ColumnDef<DataGridFeatures, TeamWorkerRow>[];
}) {
  const table = useTable({
    features: dataGridFeatures,
    data: rows,
    columns,
    initialState: {
      pagination: { pageIndex: 0, pageSize: Math.max(rows.length, 1) },
    },
    getRowId: (row) => row.employee.id,
  });

  return (
    <div className="hidden print:block">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium text-muted-foreground">
            SIBUMA · Sistem Building Management
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Daftar pekerja
          </h2>
        </div>
        <p className="text-xs font-medium text-muted-foreground tabular-nums">
          {rows.length} pekerja
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

export function TeamWorkersGrid({
  rows,
  total,
  pagination,
  printRows,
  divisionById,
  busyId,
  readOnly = false,
  onEdit,
  onToggle,
}: TeamWorkersGridProps) {
  const dataColumns = useMemo<ColumnDef<DataGridFeatures, TeamWorkerRow>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => `${row.employee.name} ${row.employee.nik}`,
        header: "Pekerja",
        meta: {
          headerClassName: "whitespace-nowrap",
          cellClassName: "max-w-72",
        },
        cell: ({ row }) => {
          const employee = row.original.employee;
          return (
            <div className="flex items-center gap-2">
              <Avatar
                name={employee.name}
                seed={employee.id}
                src={avatarUrl(employee.id, employee.avatarKey)}
                size="xs"
                className={cn(!employee.active && "opacity-50 grayscale")}
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-foreground">
                    {employee.name}
                  </span>
                  {employee.role === "atasan" && (
                    <Badge variant="outline">Atasan</Badge>
                  )}
                </div>
                <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                  NIK {employee.nik}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: "division",
        accessorFn: (row) =>
          (row.employee.divisionId
            ? divisionById.get(row.employee.divisionId)?.name
            : undefined) ?? "Tanpa divisi",
        header: "Divisi",
        meta: {
          headerClassName: "whitespace-nowrap",
          cellClassName: "max-w-44",
        },
        cell: ({ row }) => {
          const division = row.original.employee.divisionId
            ? divisionById.get(row.original.employee.divisionId)
            : undefined;
          if (!division) {
            return <Badge variant="warning-light">Tanpa divisi</Badge>;
          }
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-sm text-foreground">
                {division.name}
              </span>
              {!division.active && (
                <Badge variant="outline">Nonaktif</Badge>
              )}
            </div>
          );
        },
      },
      {
        id: "phone",
        accessorFn: (row) => row.employee.phone,
        header: "Kontak",
        meta: {
          headerClassName: "whitespace-nowrap",
          cellClassName: "whitespace-nowrap",
        },
        cell: ({ row }) => (
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Phone className="size-3.5 shrink-0" aria-hidden="true" />
              {row.original.employee.phone}
            </span>
            <span>{row.original.employee.email ?? "Email belum diisi"}</span>
          </div>
        ),
      },
      {
        id: "sessions",
        accessorFn: (row) => row.sessions,
        header: "Sesi",
        meta: {
          headerClassName: "whitespace-nowrap text-end [&>div]:justify-end",
          cellClassName: "whitespace-nowrap text-end tabular-nums",
        },
        cell: ({ row }) => (
          <span className="text-sm font-medium text-foreground">
            {row.original.sessions}
          </span>
        ),
      },
      {
        id: "duration",
        accessorFn: (row) => row.monthlyMinutes,
        header: "Durasi",
        meta: {
          headerClassName: "whitespace-nowrap",
          cellClassName: "whitespace-nowrap",
        },
        cell: ({ row }) => (
          <span className="text-sm font-medium text-foreground tabular-nums">
            {durationLabel(row.original.monthlyMinutes)}
          </span>
        ),
      },
      {
        id: "documentation",
        accessorFn: (row) => row.documentationCount,
        header: "Bukti",
        meta: {
          headerClassName: "whitespace-nowrap text-end [&>div]:justify-end",
          cellClassName: "whitespace-nowrap text-end tabular-nums",
        },
        cell: ({ row }) =>
          row.original.documentationCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
              <Camera className="size-3.5" aria-hidden="true" />
              {row.original.documentationCount}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "status",
        accessorFn: (row) => workerStatus(row.employee),
        header: "Status",
        meta: {
          headerClassName: "whitespace-nowrap",
          cellClassName: "whitespace-nowrap",
        },
        cell: ({ row }) => (
          <Badge
            variant={row.original.employee.active ? "success-light" : "outline"}
            dot={row.original.employee.active}
          >
            {workerStatus(row.original.employee)}
          </Badge>
        ),
      },
    ],
    [divisionById],
  );

  const columns = useMemo<ColumnDef<DataGridFeatures, TeamWorkerRow>[]>(() => {
    const actionColumn: ColumnDef<DataGridFeatures, TeamWorkerRow> = {
      id: "actions",
      header: "Aksi",
      meta: {
        headerClassName: "whitespace-nowrap text-end [&>div]:justify-end",
        cellClassName: "whitespace-nowrap text-end",
      },
      cell: ({ row }) => {
        const employee = row.original.employee;
        const busy = busyId === employee.id;
        return (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEdit(employee)}
            >
              <PencilLine aria-hidden="true" />
              Ubah
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onToggle(employee)}
              disabled={busy}
            >
              {busy ? <Spinner /> : <Power aria-hidden="true" />}
              {employee.active ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </div>
        );
      },
    };
    return readOnly ? dataColumns : [...dataColumns, actionColumn];
  }, [busyId, dataColumns, onEdit, onToggle, readOnly]);

  const { onPaginationChange, isPending } = useServerGridPagination(pagination);
  const table = useTable({
    features: dataGridFeatures,
    data: rows,
    columns,
    manualPagination: true,
    rowCount: total,
    state: { pagination },
    onPaginationChange,
    getRowId: (row) => row.employee.id,
  });

  const pageRows = table.getRowModel().rows.map((row) => row.original);

  return (
    <>
      <div className="print:hidden">
        <DataGrid
          table={table}
          recordCount={total}
          isLoading={isPending}
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
              {isPending ? (
                <div className="flex flex-col gap-3 p-4" role="status" aria-label="Memuat pekerja">
                  <Skeleton className="h-5 w-40" /><Skeleton className="h-16 w-full" />
                </div>
              ) : pageRows.map((row) => {
                const employee = row.employee;
                const division = employee.divisionId
                  ? divisionById.get(employee.divisionId)
                  : undefined;
                const busy = busyId === employee.id;
                return (
                  <article
                    key={employee.id}
                    className="flex flex-col gap-3 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <Avatar
                          name={employee.name}
                          seed={employee.id}
                          src={avatarUrl(employee.id, employee.avatarKey)}
                          size="md"
                          className={cn(
                            !employee.active && "opacity-50 grayscale",
                          )}
                        />
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {employee.name}
                            </p>
                            {employee.role === "atasan" && (
                              <Badge variant="outline">Atasan</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            NIK {employee.nik}
                          </p>
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                            <Phone
                              className="size-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            {employee.phone}
                          </p>
                          <p className="break-all text-xs text-muted-foreground">
                            {employee.email ?? "Email belum diisi"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {division?.name ?? "Tanpa divisi"}
                            {division && !division.active && " (nonaktif)"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          employee.active ? "success-light" : "outline"
                        }
                        dot={employee.active}
                        className="shrink-0"
                      >
                        {workerStatus(employee)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-y border-border/70 py-2.5">
                      <div>
                        <p className="text-xs text-muted-foreground">Durasi</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                          {durationLabel(row.monthlyMinutes)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Sesi</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                          {row.sessions}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Bukti</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                          {row.documentationCount} foto
                        </p>
                      </div>
                    </div>

                    {!readOnly && (
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(employee)}
                        >
                          <PencilLine aria-hidden="true" />
                          Ubah
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggle(employee)}
                          disabled={busy}
                        >
                          {busy ? <Spinner /> : <Power aria-hidden="true" />}
                          {employee.active ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                      </div>
                    )}
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

      {printRows && <PrintWorkersTable rows={printRows} columns={dataColumns} />}
    </>
  );
}
