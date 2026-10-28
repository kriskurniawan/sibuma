"use client";

import type { PageRequest } from "@/lib/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useServerGridPagination } from "@/components/server-grid-pagination";

import Link from "next/link";
import { Camera, MapPin } from "lucide-react";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { AttendanceBadge, Avatar } from "@/components/ui";
import { durationLabel, formatDateHuman, formatTime } from "@/lib/time";
import type { ReportRow } from "@/lib/types";
import { useTable, type ColumnDef } from "@tanstack/react-table";

function recordDuration(row: ReportRow) {
  if (row.attendance.status === "tidak_hadir") return "Tidak hadir";
  if (row.attendance.durationMinutes !== null) {
    return durationLabel(row.attendance.durationMinutes);
  }
  if (!row.attendance.checkInAt) return "Belum absen";
  return "Sedang berjalan";
}

const columns: ColumnDef<DataGridFeatures, ReportRow>[] = [
  {
    id: "date",
    accessorFn: (row) => row.spkl.startAt,
    header: "Tanggal",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName:
        "whitespace-nowrap text-xs font-medium text-muted-foreground tabular-nums",
    },
    cell: ({ row }) => formatDateHuman(row.original.spkl.startAt, "d MMM yyyy"),
  },
  {
    id: "spkl",
    accessorFn: (row) => row.spkl.number,
    header: "SPKL",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "max-w-72",
    },
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          href={`/spkl/${row.original.spkl.id}`}
          className="block max-w-64 truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
        >
          {row.original.spkl.title}
        </Link>
        <span className="text-xs text-muted-foreground">
          {row.original.spkl.number}
        </span>
      </div>
    ),
  },
  {
    id: "employee",
    accessorFn: (row) => row.employee.name,
    header: "Pekerja",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "max-w-56",
    },
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Avatar
          name={row.original.employee.name}
          seed={row.original.employee.id}
          size="xs"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-foreground">
            {row.original.employee.name}
          </span>
          <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
            {row.original.employee.nik}
          </span>
        </div>
      </div>
    ),
  },
  {
    id: "status",
    accessorFn: (row) => row.attendance.status,
    header: "Status",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "max-w-56",
    },
    cell: ({ row }) => (
      <div className="flex flex-col gap-1">
        <AttendanceBadge status={row.original.attendance.status} />
        {row.original.attendance.correctionReason && (
          <p className="max-w-48 text-xs leading-snug text-muted-foreground">
            {row.original.attendance.correctionReason}
          </p>
        )}
      </div>
    ),
  },
  {
    id: "checkIn",
    accessorFn: (row) => row.attendance.checkInAt,
    header: "Masuk",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName:
        "whitespace-nowrap text-xs font-medium text-muted-foreground tabular-nums",
    },
    cell: ({ row }) =>
      row.original.attendance.checkInAt
        ? formatTime(row.original.attendance.checkInAt)
        : "—",
  },
  {
    id: "checkOut",
    accessorFn: (row) => row.attendance.checkOutAt,
    header: "Pulang",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName:
        "whitespace-nowrap text-xs font-medium text-muted-foreground tabular-nums",
    },
    cell: ({ row }) =>
      row.original.attendance.checkOutAt
        ? formatTime(row.original.attendance.checkOutAt)
        : "—",
  },
  {
    id: "duration",
    accessorFn: (row) => row.attendance.durationMinutes,
    header: "Durasi",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap text-sm font-medium text-foreground",
    },
    cell: ({ row }) => recordDuration(row.original),
  },
  {
    id: "documentation",
    accessorFn: (row) => row.documentationCount,
    header: "Bukti",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
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
    id: "location",
    accessorFn: (row) => row.spkl.location.address,
    header: "Lokasi",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "max-w-56",
    },
    cell: ({ row }) => {
      const address = row.original.spkl.location.address;
      return (
        <span
          className="block max-w-56 truncate text-xs text-muted-foreground"
          title={address}
        >
          {address ?? "—"}
        </span>
      );
    },
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

function PrintReportTable({ rows }: { rows: ReportRow[] }) {
  const table = useTable({
    features: dataGridFeatures,
    data: rows,
    columns,
    initialState: {
      pagination: { pageIndex: 0, pageSize: Math.max(rows.length, 1) },
    },
    getRowId: (row) => row.attendance.id,
  });

  return (
    <DataGrid
      table={table}
      recordCount={rows.length}
      tableLayout={{ dense: true, width: "auto", headerBorder: true }}
      tableClassNames={{
        base: "min-w-0",
        headerRow: "bg-muted/40",
      }}
    >
      <DataGridContainer>
        <DataGridScrollArea>
          <DataGridTable />
        </DataGridScrollArea>
      </DataGridContainer>
    </DataGrid>
  );
}

export function ReportDataGrid({ rows, total, pagination, printRows }: {
  rows: ReportRow[]; total: number; pagination: PageRequest; printRows?: ReportRow[];
}) {
  const { onPaginationChange, isPending } = useServerGridPagination(pagination);
  const table = useTable({
    features: dataGridFeatures,
    data: rows,
    columns,
    manualPagination: true,
    rowCount: total,
    state: { pagination },
    onPaginationChange,
    getRowId: (row) => row.attendance.id,
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
                <div className="flex flex-col gap-3 p-4" role="status" aria-label="Memuat laporan">
                  <Skeleton className="h-5 w-40" /><Skeleton className="h-16 w-full" />
                </div>
              ) : pageRows.map((row) => (
                <article
                  key={row.attendance.id}
                  className="flex flex-col gap-3 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <Link
                        href={`/spkl/${row.spkl.id}`}
                        className="block truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                      >
                        {row.spkl.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {row.spkl.number} ·{" "}
                        {formatDateHuman(row.spkl.startAt, "d MMM yyyy")}
                      </p>
                    </div>
                    <AttendanceBadge
                      status={row.attendance.status}
                      className="shrink-0"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Avatar
                      name={row.employee.name}
                      seed={row.employee.id}
                      size="xs"
                    />
                    <p className="truncate text-xs font-medium text-foreground">
                      {row.employee.name}
                    </p>
                    <span className="ml-auto shrink-0 text-xs font-semibold text-foreground">
                      {recordDuration(row)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/50 px-3 py-2.5">
                    <div>
                      <p className="text-xs text-muted-foreground">Masuk</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                        {row.attendance.checkInAt
                          ? formatTime(row.attendance.checkInAt)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Pulang</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                        {row.attendance.checkOutAt
                          ? formatTime(row.attendance.checkOutAt)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Bukti</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                        {row.documentationCount} foto
                      </p>
                    </div>
                  </div>

                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {row.spkl.location.address ?? "Lokasi tidak tersedia"}
                    </span>
                  </p>

                  {row.attendance.correctionReason && (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Koreksi: {row.attendance.correctionReason}
                    </p>
                  )}
                </article>
              ))}
            </div>

            <div className="border-t border-border/70 px-4 py-2">
              <DataGridPagination sizes={PAGE_SIZES} />
            </div>
          </div>
        </DataGrid>
      </div>

      <div className="hidden print:block">
        {printRows && <PrintReportTable rows={printRows} />}
      </div>
    </>
  );
}
