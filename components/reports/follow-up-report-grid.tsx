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
import { Avatar, Badge } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChecklistFollowUpBadge,
  ChecklistOverdueBadge,
  ChecklistPriorityBadge,
} from "@/components/checklist/checklist-badges";
import type { ChecklistFollowUpRow } from "@/lib/checklist-types";
import type { PageRequest } from "@/lib/pagination";
import { formatDateHuman, formatDateTime } from "@/lib/time";

const columns: ColumnDef<DataGridFeatures, ChecklistFollowUpRow>[] = [
  {
    id: "title",
    accessorFn: (row) => row.followUp.title,
    header: "Tindak lanjut",
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
          {row.original.followUp.title}
        </Link>
        {row.original.prompt && (
          <span className="max-w-64 truncate text-xs text-muted-foreground">
            Item: {row.original.prompt}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {row.original.inspection.templateName} ·{" "}
          {row.original.inspection.periodLabel}
        </span>
      </div>
    ),
  },
  {
    id: "status",
    accessorFn: (row) => row.followUp.status,
    header: "Status",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-1">
        <ChecklistFollowUpBadge status={row.original.followUp.status} />
        {row.original.overdue && <ChecklistOverdueBadge />}
      </div>
    ),
  },
  {
    id: "priority",
    accessorFn: (row) => row.followUp.priority,
    header: "Prioritas",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    cell: ({ row }) => (
      <ChecklistPriorityBadge priority={row.original.followUp.priority} />
    ),
  },
  {
    id: "dueDate",
    accessorFn: (row) => row.followUp.dueDate,
    header: "Deadline",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    cell: ({ row }) =>
      row.original.followUp.dueDate ? (
        <span className="text-xs font-medium text-foreground tabular-nums">
          {formatDateHuman(
            `${row.original.followUp.dueDate}T12:00:00`,
            "d MMM yyyy",
          )}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    id: "pic",
    accessorFn: (row) => row.pic?.name ?? "",
    header: "PIC",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "max-w-48",
    },
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5">
        {row.original.pic ? (
          <div className="flex items-center gap-2">
            <Avatar
              name={row.original.pic.name}
              seed={row.original.pic.id}
              size="xs"
            />
            <span className="truncate text-xs text-foreground">
              {row.original.pic.name}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Belum ditentukan</span>
        )}
        {row.original.followUp.safetyName && (
          <span className="text-xs text-muted-foreground">
            Petugas safety {row.original.followUp.safetyName}
          </span>
        )}
      </div>
    ),
  },
  {
    id: "area",
    accessorFn: (row) =>
      row.inspection.locationPath ?? row.inspection.locationName,
    header: "Area",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "max-w-56",
    },
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1 text-xs font-medium text-foreground">
          <MapPin className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {row.original.inspection.locationPath ??
              row.original.inspection.locationName}
          </span>
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDateHuman(
            `${row.original.inspection.occurrenceDate}T12:00:00`,
            "d MMM yyyy",
          )}
        </span>
      </div>
    ),
  },
  {
    id: "createdAt",
    accessorFn: (row) => row.followUp.createdAt,
    header: "Dibuat",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
    },
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatDateTime(row.original.followUp.createdAt, "d MMM yyyy")}
      </span>
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

function PrintFollowUpTable({ rows }: { rows: ChecklistFollowUpRow[] }) {
  const table = useTable({
    features: dataGridFeatures,
    data: rows,
    columns,
    initialState: {
      pagination: { pageIndex: 0, pageSize: Math.max(rows.length, 1) },
    },
    getRowId: (row) => row.followUp.id,
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

export function FollowUpReportGrid({
  rows,
  total,
  pagination,
  printRows,
}: {
  rows: ChecklistFollowUpRow[];
  total: number;
  pagination: PageRequest;
  printRows?: ChecklistFollowUpRow[];
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
    getRowId: (row) => row.followUp.id,
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
            base: "min-w-[68rem]",
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
                  aria-label="Memuat laporan tindak lanjut"
                >
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                pageRows.map((row) => (
                  <article
                    key={row.followUp.id}
                    className="flex flex-col gap-3 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Link
                          href={`/checklist/${row.inspection.id}`}
                          className="block truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                        >
                          {row.followUp.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {row.inspection.templateName} ·{" "}
                          {row.inspection.periodLabel}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <ChecklistFollowUpBadge
                          status={row.followUp.status}
                        />
                        <ChecklistPriorityBadge
                          priority={row.followUp.priority}
                        />
                        {row.overdue && <ChecklistOverdueBadge />}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/50 px-3 py-2.5">
                      <div>
                        <p className="text-xs text-muted-foreground">Deadline</p>
                        <p className="mt-0.5 text-xs font-medium text-foreground tabular-nums">
                          {row.followUp.dueDate
                            ? formatDateHuman(
                                `${row.followUp.dueDate}T12:00:00`,
                                "d MMM yyyy",
                              )
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">PIC</p>
                        <p className="mt-0.5 truncate text-xs font-medium text-foreground">
                          {row.pic?.name ?? "Belum ditentukan"}
                        </p>
                      </div>
                    </div>

                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {row.inspection.locationPath ??
                          row.inspection.locationName}
                      </span>
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock
                        className="size-3 shrink-0"
                        aria-hidden="true"
                      />
                      Dibuat{" "}
                      {formatDateTime(row.followUp.createdAt, "d MMM yyyy")}
                    </p>
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
        {printRows && <PrintFollowUpTable rows={printRows} />}
      </div>
    </>
  );
}
