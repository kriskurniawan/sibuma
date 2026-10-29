"use client";

import Link from "next/link";
import { CalendarClock, MapPin } from "lucide-react";
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
import { useServerGridPagination } from "@/components/server-grid-pagination";
import { Avatar, Badge, ProgressBar } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChecklistOverdueBadge,
  ChecklistStatusBadge,
} from "@/components/checklist/checklist-badges";
import type { ChecklistReportRow } from "@/lib/checklist-types";
import type { PageRequest } from "@/lib/pagination";
import { formatDateHuman, formatDateTime } from "@/lib/time";

const columns: ColumnDef<DataGridFeatures, ChecklistReportRow>[] = [
  {
    id: "inspection",
    accessorFn: (row) => row.inspection.templateName,
    header: "Pemeriksaan",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "max-w-72",
    },
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          href={`/checklist/${row.original.inspection.id}`}
          className="block max-w-64 truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
        >
          {row.original.inspection.templateName}
        </Link>
        <span className="text-xs text-muted-foreground">
          {row.original.inspection.category} ·{" "}
          {row.original.inspection.periodLabel}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
          <CalendarClock className="size-3 shrink-0" aria-hidden="true" />
          {formatDateHuman(
            `${row.original.inspection.occurrenceDate}T12:00:00`,
            "d MMM yyyy",
          )}
        </span>
      </div>
    ),
  },
  {
    id: "location",
    accessorFn: (row) => row.locationPath ?? row.inspection.locationName,
    header: "Lokasi",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "max-w-56",
    },
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1 text-sm text-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {row.original.locationPath ?? row.original.inspection.locationName}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">
          Jatuh tempo{" "}
          {formatDateTime(row.original.inspection.dueAt, "d MMM yyyy, HH:mm")}
        </span>
      </div>
    ),
  },
  {
    id: "status",
    accessorFn: (row) => row.inspection.status,
    header: "Status",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-1">
        <ChecklistStatusBadge status={row.original.inspection.status} />
        {row.original.overdue && <ChecklistOverdueBadge />}
        {row.original.late && (
          <Badge variant="warning-outline">Selesai terlambat</Badge>
        )}
      </div>
    ),
  },
  {
    id: "progress",
    accessorFn: (row) => row.answeredCount,
    header: "Progres",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "min-w-40",
    },
    cell: ({ row }) => (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-foreground tabular-nums">
          {row.original.answeredCount}/{row.original.totalItems} item
        </span>
        <ProgressBar
          value={row.original.answeredCount}
          max={Math.max(row.original.totalItems, 1)}
          tone={row.original.issueCount > 0 ? "warning" : "primary"}
        />
        <span className="text-xs text-muted-foreground">
          {row.original.issueCount} temuan
        </span>
      </div>
    ),
  },
  {
    id: "followUps",
    accessorFn: (row) => row.openFollowUps,
    header: "Tindak lanjut",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    cell: ({ row }) =>
      row.original.openFollowUps > 0 ? (
        <Badge variant="warning-light">
          {row.original.openFollowUps} terbuka
        </Badge>
      ) : (
        <Badge variant="outline">Tidak ada</Badge>
      ),
  },
  {
    id: "assignees",
    accessorFn: (row) => row.assignees.map((person) => person.name).join(", "),
    header: "Petugas",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "max-w-56",
    },
    cell: ({ row }) =>
      row.original.assignees.length === 0 ? (
        <span className="text-xs text-muted-foreground">Belum ditugaskan</span>
      ) : (
        <div className="flex flex-col gap-1">
          {row.original.assignees.slice(0, 3).map((person) => (
            <span
              key={person.id}
              className="flex min-w-0 items-center gap-1.5"
            >
              <Avatar name={person.name} seed={person.id} size="xs" />
              <span className="truncate text-xs text-foreground">
                {person.name}
              </span>
            </span>
          ))}
          {row.original.assignees.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{row.original.assignees.length - 3} petugas lain
            </span>
          )}
        </div>
      ),
  },
];

const PAGE_SIZES = [10, 25, 50, 100];

const gridI18n = {
  labels: {
    rowsPerPage: "Baris per halaman",
    paginationInfo: ({
      from,
      to,
      count,
    }: {
      from: number;
      to: number;
      count: number;
    }) => `${from}–${to} dari ${count}`,
    previousPage: "Halaman sebelumnya",
    nextPage: "Halaman berikutnya",
    goToPage: (page: number) => `Ke halaman ${page}`,
    paginationEllipsis: "…",
  },
};

function PrintChecklistTable({ rows }: { rows: ChecklistReportRow[] }) {
  const table = useTable({
    features: dataGridFeatures,
    data: rows,
    columns,
    initialState: {
      pagination: { pageIndex: 0, pageSize: Math.max(rows.length, 1) },
    },
    getRowId: (row) => row.inspection.id,
  });

  return (
    <DataGrid
      table={table}
      recordCount={rows.length}
      tableLayout={{ dense: true, width: "auto", headerBorder: true }}
      tableClassNames={{ base: "min-w-0", headerRow: "bg-muted/40" }}
    >
      <DataGridContainer>
        <DataGridScrollArea>
          <DataGridTable />
        </DataGridScrollArea>
      </DataGridContainer>
    </DataGrid>
  );
}

export function ChecklistReportGrid({
  rows,
  total,
  pagination,
  printRows,
}: {
  rows: ChecklistReportRow[];
  total: number;
  pagination: PageRequest;
  printRows?: ChecklistReportRow[];
}) {
  const { onPaginationChange, isPending } =
    useServerGridPagination(pagination);
  const table = useTable({
    features: dataGridFeatures,
    data: rows,
    columns,
    manualPagination: true,
    rowCount: total,
    state: { pagination },
    onPaginationChange,
    getRowId: (row) => row.inspection.id,
  });
  const pageRows = table.getRowModel().rows.map((row) => row.original);

  return (
    <>
      <div className="print:hidden">
        <DataGrid
          table={table}
          recordCount={total}
          isLoading={isPending}
          i18n={gridI18n}
          tableLayout={{ dense: true, width: "auto", headerBorder: true }}
          tableClassNames={{
            base: "min-w-[64rem]",
            headerRow: "bg-muted/40",
          }}
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
                <div
                  className="flex flex-col gap-3 p-4"
                  role="status"
                  aria-label="Memuat laporan checklist"
                >
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                pageRows.map((row) => (
                  <article
                    key={row.inspection.id}
                    className="flex flex-col gap-3 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Link
                          href={`/checklist/${row.inspection.id}`}
                          className="block truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                        >
                          {row.inspection.templateName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {row.inspection.category} ·{" "}
                          {row.inspection.periodLabel}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatDateHuman(
                            `${row.inspection.occurrenceDate}T12:00:00`,
                            "d MMM yyyy",
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <ChecklistStatusBadge
                          status={row.inspection.status}
                        />
                        {row.overdue && <ChecklistOverdueBadge />}
                        {row.late && (
                          <Badge variant="warning-outline">
                            Selesai terlambat
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/50 px-3 py-2.5">
                      <div>
                        <p className="text-xs text-muted-foreground">Progres</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                          {row.answeredCount}/{row.totalItems} item
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Temuan</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                          {row.issueCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Tindak lanjut
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                          {row.openFollowUps} terbuka
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Jatuh tempo
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-foreground tabular-nums">
                          {formatDateTime(
                            row.inspection.dueAt,
                            "d MMM, HH:mm",
                          )}
                        </p>
                      </div>
                    </div>

                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {row.locationPath ?? row.inspection.locationName}
                      </span>
                    </p>

                    {row.assignees.length > 0 && (
                      <p className="truncate text-xs text-muted-foreground">
                        Petugas:{" "}
                        {row.assignees.map((person) => person.name).join(", ")}
                      </p>
                    )}
                  </article>
                ))
              )}
            </div>

            <div className="border-t border-border/70 px-4 py-2">
              <DataGridPagination sizes={PAGE_SIZES} />
            </div>
          </div>
        </DataGrid>
      </div>

      <div className="hidden print:block">
        {printRows && <PrintChecklistTable rows={printRows} />}
      </div>
    </>
  );
}
