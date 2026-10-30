"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Camera,
  ListChecks,
  MapPin,
} from "lucide-react";
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
  ManualWorkOverdueBadge,
  ManualWorkSelfReportedBadge,
  ManualWorkStatusBadge,
} from "@/components/pekerjaan/manual-work-badges";
import type { ManualWorkReportRow } from "@/lib/manual-work-types";
import type { PageRequest } from "@/lib/pagination";
import { formatDateHuman, formatDateTime } from "@/lib/time";

function dateLabel(value: string | null | undefined, pattern = "d MMM yyyy") {
  if (!value) return "—";
  return formatDateHuman(`${value.slice(0, 10)}T12:00:00`, pattern);
}

function rangeLabel(row: ManualWorkReportRow) {
  const start = dateLabel(row.work.startDate, "d MMM");
  if (!row.work.targetDate) return `Mulai ${start}`;
  if (row.work.targetDate === row.work.startDate) return start;
  return `${start} – ${dateLabel(row.work.targetDate, "d MMM")}`;
}

function buildColumns(
  maxPhotos: number,
): ColumnDef<DataGridFeatures, ManualWorkReportRow>[] {
  return [
    {
      id: "work",
      accessorFn: (row) => row.work.title,
      header: "Pekerjaan",
      meta: {
        headerClassName: "whitespace-nowrap",
        cellClassName: "max-w-72",
      },
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link
            href={`/pekerjaan/${row.original.work.id}`}
            className="block max-w-64 truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            {row.original.work.title}
          </Link>
          {row.original.work.description && (
            <span className="line-clamp-1 max-w-64 text-xs text-muted-foreground">
              {row.original.work.description}
            </span>
          )}
          {row.original.sourceFollowUp && (
            <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <ListChecks className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                Tindak lanjut: {row.original.sourceFollowUp.title}
              </span>
            </span>
          )}
        </div>
      ),
    },
    {
      id: "location",
      accessorFn: (row) =>
        row.locationPath ?? row.work.locationName,
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
              {row.original.locationPath ??
                (row.original.work.locationName || "Tanpa lokasi")}
            </span>
          </span>
          <span className="truncate text-xs text-muted-foreground">
            Atasan: {row.original.ownerName}
          </span>
        </div>
      ),
    },
    {
      id: "status",
      accessorFn: (row) => row.work.status,
      header: "Status",
      meta: {
        headerClassName: "whitespace-nowrap",
        cellClassName: "min-w-36",
      },
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1">
            <ManualWorkStatusBadge status={row.original.work.status} />
            {row.original.overdue && <ManualWorkOverdueBadge />}
          </div>
          {row.original.work.completedAt && (
            <span className="text-xs text-muted-foreground tabular-nums">
              Selesai{" "}
              {formatDateTime(row.original.work.completedAt, "d MMM yyyy")}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "schedule",
      accessorFn: (row) => row.work.startDate,
      header: "Jadwal",
      meta: {
        headerClassName: "whitespace-nowrap",
        cellClassName: "min-w-36",
      },
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1 text-xs font-medium text-foreground tabular-nums">
            <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
            {rangeLabel(row.original)}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            Target{" "}
            {row.original.work.targetDate
              ? dateLabel(row.original.work.targetDate)
              : "—"}
          </span>
        </div>
      ),
    },
    {
      id: "assignees",
      accessorFn: (row) => row.assignees.map((person) => person.name).join(", "),
      header: "Pekerja",
      meta: {
        headerClassName: "whitespace-nowrap",
        cellClassName: "max-w-56",
      },
      cell: ({ row }) =>
        row.original.assignees.length === 0 ? (
          <span className="text-xs text-muted-foreground">Belum ada pekerja</span>
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
                +{row.original.assignees.length - 3} pekerja lain
              </span>
            )}
          </div>
        ),
    },
    {
      id: "safety",
      accessorFn: (row) => row.work.safetyName,
      header: "Petugas safety",
      meta: {
        headerClassName: "whitespace-nowrap",
        cellClassName: "max-w-44",
      },
      cell: ({ row }) =>
        row.original.work.safetyName ? (
          <span className="truncate text-xs text-foreground">
            {row.original.work.safetyName}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "documentation",
      accessorFn: (row) => row.photoCount,
      header: "Dokumentasi",
      meta: {
        headerClassName: "whitespace-nowrap",
        cellClassName: "min-w-32",
      },
      cell: ({ row }) => {
        if (!row.original.work.requiresDocumentation) {
          return <Badge variant="outline">Tidak wajib</Badge>;
        }
        const missing = row.original.photoCount === 0;
        return (
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-foreground tabular-nums">
              <Camera className="size-3.5 shrink-0" aria-hidden="true" />
              {row.original.photoCount}/{maxPhotos} foto
            </span>
            {missing && (
              <Badge
                variant={
                  ["terbuka", "dikerjakan"].includes(row.original.work.status)
                    ? "warning-light"
                    : "destructive-light"
                }
              >
                Belum ada foto
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: "reporter",
      accessorFn: (row) => row.createdByName,
      header: "Pelapor",
      meta: {
        headerClassName: "whitespace-nowrap",
        cellClassName: "max-w-48",
      },
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar
              name={row.original.createdByName}
              seed={row.original.work.createdBy}
              size="xs"
            />
            <span className="truncate text-xs text-foreground">
              {row.original.createdByName}
            </span>
          </span>
          {row.original.selfReported && <ManualWorkSelfReportedBadge />}
        </div>
      ),
    },
  ];
}

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

function PrintManualWorkTable({
  rows,
  photoLimit,
}: {
  rows: ManualWorkReportRow[];
  photoLimit: number;
}) {
  const columns = useMemo(() => buildColumns(photoLimit), [photoLimit]);
  const table = useTable({
    features: dataGridFeatures,
    data: rows,
    columns,
    initialState: {
      pagination: { pageIndex: 0, pageSize: Math.max(rows.length, 1) },
    },
    getRowId: (row) => row.work.id,
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

export function ManualWorkReportGrid({
  rows,
  total,
  pagination,
  printRows,
  photoLimit,
}: {
  rows: ManualWorkReportRow[];
  total: number;
  pagination: PageRequest;
  printRows?: ManualWorkReportRow[];
  photoLimit: number;
}) {
  const { onPaginationChange, isPending } =
    useServerGridPagination(pagination);
  const columns = useMemo(() => buildColumns(photoLimit), [photoLimit]);
  const table = useTable({
    features: dataGridFeatures,
    data: rows,
    columns,
    manualPagination: true,
    rowCount: total,
    state: { pagination },
    onPaginationChange,
    getRowId: (row) => row.work.id,
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
            base: "min-w-[76rem]",
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
                  aria-label="Memuat laporan pekerjaan harian"
                >
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                pageRows.map((row) => (
                  <article
                    key={row.work.id}
                    className="flex flex-col gap-3 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Link
                          href={`/pekerjaan/${row.work.id}`}
                          className="block truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                        >
                          {row.work.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {rangeLabel(row)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <ManualWorkStatusBadge status={row.work.status} />
                        {row.overdue && <ManualWorkOverdueBadge />}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/50 px-3 py-2.5">
                      <div>
                        <p className="text-xs text-muted-foreground">Mulai</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                          {dateLabel(row.work.startDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Target</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                          {row.work.targetDate
                            ? dateLabel(row.work.targetDate)
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Pekerja</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                          {row.assignees.length} orang
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Dokumentasi
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                          {row.work.requiresDocumentation
                            ? `${row.photoCount}/${photoLimit} foto`
                            : "Tidak wajib"}
                        </p>
                      </div>
                    </div>

                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {row.locationPath ??
                          (row.work.locationName || "Tanpa lokasi")}
                      </span>
                    </p>

                    {row.assignees.length > 0 && (
                      <p className="truncate text-xs text-muted-foreground">
                        Pekerja:{" "}
                        {row.assignees.map((person) => person.name).join(", ")}
                      </p>
                    )}

                    {row.work.safetyName && (
                      <p className="truncate text-xs text-muted-foreground">
                        Petugas safety: {row.work.safetyName}
                      </p>
                    )}

                    <p className="truncate text-xs text-muted-foreground">
                      Pelapor: {row.createdByName}
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
        {printRows && (
          <PrintManualWorkTable rows={printRows} photoLimit={photoLimit} />
        )}
      </div>
    </>
  );
}
