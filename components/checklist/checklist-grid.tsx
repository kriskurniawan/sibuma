"use client";

import Link from "next/link";
import { ChevronRight, MapPin, UsersRound } from "lucide-react";
import { useTable, type ColumnDef } from "@tanstack/react-table";
import type { PageRequest } from "@/lib/pagination";
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
import { Avatar, ProgressBar } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChecklistOverdueBadge,
  ChecklistStatusBadge,
} from "@/components/checklist/checklist-badges";
import { formatDateTime, formatDateHuman } from "@/lib/time";
import type {
  ChecklistInspectionRow,
  ChecklistPerson,
} from "@/lib/checklist-types";

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

function occurrenceIso(date: string) {
  return `${date}T00:00:00+07:00`;
}

function AssigneeStack({ people }: { people: ChecklistPerson[] }) {
  if (people.length === 0) {
    return <span className="text-xs text-muted-foreground">Tanpa anggota</span>;
  }
  const visible = people.slice(0, 3);
  const remaining = people.length - visible.length;
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center" title={people.map((item) => item.name).join(", ")}>
        {visible.map((person, index) => (
          <span key={person.id} className={index > 0 ? "-ml-2" : undefined}>
            <Avatar
              name={person.name}
              seed={person.id}
              size="xs"
              className="ring-2 ring-card"
            />
          </span>
        ))}
        {remaining > 0 && (
          <span className="-ml-2 inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-2 ring-card">
            +{remaining}
          </span>
        )}
      </div>
      <span className="max-w-24 truncate text-xs text-muted-foreground">
        {visible[0].name.split(" ")[0]}
        {people.length > 1 ? ` +${people.length - 1}` : ""}
      </span>
    </div>
  );
}

const columns: ColumnDef<DataGridFeatures, ChecklistInspectionRow>[] = [
  {
    id: "template",
    accessorFn: (row) => row.inspection.templateName,
    header: "Checklist",
    meta: { headerClassName: "whitespace-nowrap", cellClassName: "max-w-72" },
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          href={`/checklist/${row.original.inspection.id}`}
          className="block max-w-64 truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
        >
          {row.original.inspection.templateName}
        </Link>
        <span className="truncate text-xs text-muted-foreground">
          {row.original.inspection.category} · {row.original.inspection.periodLabel}
        </span>
      </div>
    ),
  },
  {
    id: "location",
    accessorFn: (row) => row.locationPath ?? row.inspection.locationName,
    header: "Lokasi & tanggal",
    meta: { headerClassName: "whitespace-nowrap", cellClassName: "max-w-56" },
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1 truncate text-sm text-foreground">
          <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          {row.original.locationPath ?? row.original.inspection.locationName}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDateHuman(occurrenceIso(row.original.inspection.occurrenceDate), "d MMM yyyy")}
        </span>
      </div>
    ),
  },
  {
    id: "due",
    accessorFn: (row) => row.inspection.dueAt,
    header: "Tenggat",
    meta: { headerClassName: "whitespace-nowrap" },
    cell: ({ row }) => (
      <div className="flex flex-col gap-1">
        <span className="whitespace-nowrap text-xs font-medium text-muted-foreground tabular-nums">
          {formatDateTime(row.original.inspection.dueAt, "d MMM, HH:mm")}
        </span>
        {row.original.overdue && <ChecklistOverdueBadge />}
      </div>
    ),
  },
  {
    id: "progress",
    accessorFn: (row) =>
      row.totalItems === 0 ? 0 : row.answeredCount / row.totalItems,
    header: "Progres",
    meta: { headerClassName: "whitespace-nowrap", cellClassName: "w-36" },
    cell: ({ row }) => (
      <div className="flex w-28 flex-col gap-1">
        <span className="text-xs font-medium text-foreground tabular-nums">
          {row.original.answeredCount}/{row.original.totalItems} item
        </span>
        <ProgressBar
          value={row.original.answeredCount}
          max={row.original.totalItems}
          tone={
            row.original.answeredCount === row.original.totalItems
              ? "success"
              : "primary"
          }
        />
      </div>
    ),
  },
  {
    id: "team",
    accessorFn: (row) => row.assignees.map((item) => item.name).join(", "),
    header: "Tim",
    meta: { headerClassName: "whitespace-nowrap" },
    cell: ({ row }) => <AssigneeStack people={row.original.assignees} />,
  },
  {
    id: "status",
    accessorFn: (row) => row.inspection.status,
    header: "Status",
    meta: { headerClassName: "whitespace-nowrap" },
    cell: ({ row }) => <ChecklistStatusBadge status={row.original.inspection.status} />,
  },
  {
    id: "findings",
    accessorFn: (row) => row.openFollowUps,
    header: "Temuan",
    meta: { headerClassName: "whitespace-nowrap" },
    cell: ({ row }) =>
      row.original.openFollowUps > 0 ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground tabular-nums">
          <UsersRound className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {row.original.openFollowUps} terbuka
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    id: "action",
    header: "",
    meta: { headerClassName: "w-10", cellClassName: "text-right" },
    cell: ({ row }) => (
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`Buka checklist ${row.original.inspection.templateName}`}
        nativeButton={false}
        render={<Link href={`/checklist/${row.original.inspection.id}`} />}
      >
        <ChevronRight />
      </Button>
    ),
  },
];

export function ChecklistGrid({
  items,
  total,
  pagination,
}: {
  items: ChecklistInspectionRow[];
  total: number;
  pagination: PageRequest;
}) {
  const { onPaginationChange, isPending } = useServerGridPagination(pagination);
  const table = useTable({
    features: dataGridFeatures,
    data: items,
    columns,
    manualPagination: true,
    rowCount: total,
    state: { pagination },
    onPaginationChange,
    getRowId: (row) => row.inspection.id,
  });
  const pageRows = table.getRowModel().rows.map((row) => row.original);

  return (
    <DataGrid
      table={table}
      recordCount={total}
      isLoading={isPending}
      i18n={gridI18n}
      tableLayout={{ dense: true, width: "auto", headerBorder: true }}
      tableClassNames={{ base: "min-w-[64rem]", headerRow: "bg-muted/40" }}
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
            <div className="flex flex-col gap-3 p-4" role="status" aria-label="Memuat checklist">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            pageRows.map((row) => (
              <article key={row.inspection.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Link
                      href={`/checklist/${row.inspection.id}`}
                      className="block truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                    >
                      {row.inspection.templateName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {row.inspection.category} · {row.inspection.periodLabel}
                    </p>
                  </div>
                  <ChecklistStatusBadge
                    status={row.inspection.status}
                    className="shrink-0"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/50 px-3 py-2.5">
                  <div>
                    <p className="text-xs text-muted-foreground">Lokasi</p>
                    <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                      {row.locationPath ?? row.inspection.locationName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tanggal</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">
                      {formatDateHuman(
                        occurrenceIso(row.inspection.occurrenceDate),
                        "d MMM yyyy",
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tenggat</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                      {formatDateTime(row.inspection.dueAt, "d MMM, HH:mm")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Progres</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                      {row.answeredCount}/{row.totalItems} item
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <AssigneeStack people={row.assignees} />
                  <div className="flex items-center gap-2">
                    {row.overdue && <ChecklistOverdueBadge />}
                    {row.openFollowUps > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {row.openFollowUps} temuan
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="border-t border-border/70 px-4 py-2">
          <DataGridPagination sizes={PAGE_SIZES} />
        </div>
      </div>
    </DataGrid>
  );
}

