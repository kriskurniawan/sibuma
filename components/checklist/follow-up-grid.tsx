"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Clock3, MapPin, Pencil } from "lucide-react";
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
import { Avatar } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChecklistFollowUpBadge,
  ChecklistOverdueBadge,
  ChecklistPriorityBadge,
} from "@/components/checklist/checklist-badges";
import { ChecklistFollowUpUpdateDialog } from "@/components/checklist/follow-up-update-dialog";
import { formatDateHuman } from "@/lib/time";
import {
  CHECKLIST_PRIORITY_LABEL,
  type ChecklistFollowUpRow,
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

function dueIso(date: string) {
  return `${date}T23:59:59+07:00`;
}

const columns = (
  onEdit: (row: ChecklistFollowUpRow) => void,
  canEdit: boolean,
): ColumnDef<DataGridFeatures, ChecklistFollowUpRow>[] => [
  {
    id: "title",
    accessorFn: (row) => row.followUp.title,
    header: "Tindak lanjut",
    meta: { headerClassName: "whitespace-nowrap", cellClassName: "max-w-72" },
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          href={`/checklist/${row.original.inspection.id}`}
          className="block max-w-64 truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
        >
          {row.original.followUp.title}
        </Link>
        <span className="truncate text-xs text-muted-foreground">
          {row.original.inspection.templateName} ·{" "}
          {row.original.inspection.locationName}
        </span>
      </div>
    ),
  },
  {
    id: "origin",
    accessorFn: (row) => row.prompt ?? "",
    header: "Item asal",
    meta: { headerClassName: "whitespace-nowrap", cellClassName: "max-w-64" },
    cell: ({ row }) =>
      row.original.prompt ? (
        <span className="block max-w-56 truncate text-xs text-muted-foreground">
          {row.original.prompt}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Umum</span>
      ),
  },
  {
    id: "pic",
    accessorFn: (row) => row.pic?.name ?? "",
    header: "PIC",
    meta: { headerClassName: "whitespace-nowrap" },
    cell: ({ row }) =>
      row.original.pic ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
          <Avatar
            name={row.original.pic.name}
            seed={row.original.pic.id}
            size="xs"
          />
          {row.original.pic.name}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Tanpa PIC</span>
      ),
  },
  {
    id: "priority",
    accessorFn: (row) => row.followUp.priority,
    header: "Prioritas",
    meta: { headerClassName: "whitespace-nowrap" },
    cell: ({ row }) => (
      <ChecklistPriorityBadge priority={row.original.followUp.priority} />
    ),
  },
  {
    id: "due",
    accessorFn: (row) => row.followUp.dueDate ?? "",
    header: "Deadline",
    meta: { headerClassName: "whitespace-nowrap" },
    cell: ({ row }) =>
      row.original.followUp.dueDate ? (
        <div className="flex flex-col gap-1">
          <span className="whitespace-nowrap text-xs font-medium text-muted-foreground tabular-nums">
            {formatDateHuman(dueIso(row.original.followUp.dueDate), "d MMM yyyy")}
          </span>
          {row.original.overdue && <ChecklistOverdueBadge />}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    id: "status",
    accessorFn: (row) => row.followUp.status,
    header: "Status",
    meta: { headerClassName: "whitespace-nowrap" },
    cell: ({ row }) => (
      <ChecklistFollowUpBadge status={row.original.followUp.status} />
    ),
  },
  ...(canEdit
    ? [
        {
          id: "action",
          header: "",
          meta: { headerClassName: "w-24", cellClassName: "text-right" },
          cell: ({ row }) => (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onEdit(row.original)}
              disabled={row.original.followUp.status === "dibatalkan"}
            >
              <Pencil aria-hidden="true" />
              Perbarui
            </Button>
          ),
        } satisfies ColumnDef<DataGridFeatures, ChecklistFollowUpRow>,
      ]
    : []),
];

export function ChecklistFollowUpGrid({
  items,
  total,
  pagination,
  canEdit,
}: {
  items: ChecklistFollowUpRow[];
  total: number;
  pagination: PageRequest;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ChecklistFollowUpRow | null>(null);
  const tableColumns = useMemo(
    () => columns(setSelected, canEdit),
    [canEdit],
  );
  const { onPaginationChange, isPending } = useServerGridPagination(pagination);
  const table = useTable({
    features: dataGridFeatures,
    data: items,
    columns: tableColumns,
    manualPagination: true,
    rowCount: total,
    state: { pagination },
    onPaginationChange,
    getRowId: (row) => row.followUp.id,
  });
  const pageRows = table.getRowModel().rows.map((row) => row.original);

  return (
    <>
      <DataGrid
        table={table}
        recordCount={total}
        isLoading={isPending}
        i18n={gridI18n}
        tableLayout={{ dense: true, width: "auto", headerBorder: true }}
        tableClassNames={{ base: "min-w-[62rem]", headerRow: "bg-muted/40" }}
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
                aria-label="Memuat tindak lanjut"
              >
                <div className="flex items-start justify-between gap-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-3 w-48" />
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ) : (
              pageRows.map((row) => (
                <article
                  key={row.followUp.id}
                  className="group relative flex min-w-0 flex-col gap-2 p-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <Link
                        href={`/checklist/${row.inspection.id}`}
                        className="line-clamp-2 text-sm font-medium text-foreground after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                      >
                        {row.followUp.title}
                      </Link>
                      <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{row.inspection.locationName}</span>
                      </span>
                    </div>
                    <ChecklistFollowUpBadge status={row.followUp.status} />
                  </div>

                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {row.prompt || "Umum"} ({row.inspection.templateName})
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Clock3 className="size-4 shrink-0" aria-hidden="true" />
                      <span className="sr-only">Deadline </span>
                      {row.followUp.dueDate
                        ? formatDateHuman(dueIso(row.followUp.dueDate), "d MMM yyyy")
                        : "Tanpa deadline"}
                    </span>
                    {row.overdue && <ChecklistOverdueBadge />}
                    <span>
                      <span className="sr-only">Prioritas </span>
                      {CHECKLIST_PRIORITY_LABEL[row.followUp.priority]}
                    </span>
                  </div>

                  <div className="flex min-w-0 items-center justify-between gap-3">
                    {row.pic ? (
                      <span className="inline-flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        <Avatar name={row.pic.name} seed={row.pic.id} size="xs" />
                        <span className="truncate">{row.pic.name}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Tanpa PIC</span>
                    )}
                    {canEdit ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="relative z-10"
                        onClick={() => setSelected(row)}
                        disabled={row.followUp.status === "dibatalkan"}
                      >
                        <Pencil aria-hidden="true" />
                        Perbarui
                      </Button>
                    ) : (
                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-2">
            <span className="text-xs text-muted-foreground">
              {total} tindak lanjut sesuai filter
            </span>
            <DataGridPagination sizes={PAGE_SIZES} />
          </div>
        </div>
      </DataGrid>

      <ChecklistFollowUpUpdateDialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        row={selected}
        onUpdated={() => router.refresh()}
      />
    </>
  );
}
