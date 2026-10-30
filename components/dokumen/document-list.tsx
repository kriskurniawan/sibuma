"use client";

import Link from "next/link";
import { Clock3, FolderClosed } from "lucide-react";
import { useTable, type ColumnDef } from "@tanstack/react-table";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import {
  DocumentShareBadges,
  DocumentTypeBadge,
} from "@/components/dokumen/document-badges";
import { DocumentFileIcon } from "@/components/dokumen/document-file-icon";
import { Badge } from "@/components/ui";
import type { PageRequest } from "@/lib/pagination";
import { formatDateTime } from "@/lib/time";
import {
  formatDocumentBytes,
  type WorkDocumentRow,
  type WorkDocumentTab,
} from "@/lib/work-document-types";

const columns: ColumnDef<DataGridFeatures, WorkDocumentRow>[] = [
  {
    id: "document",
    accessorFn: (row) => row.title,
    header: "Dokumen",
    meta: { headerClassName: "whitespace-nowrap", cellClassName: "max-w-80" },
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-2.5">
        <DocumentFileIcon extension={row.original.extension} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link
            href={`/dokumen/${row.original.id}`}
            className="block max-w-64 truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            {row.original.title}
          </Link>
          <span className="max-w-64 truncate text-xs text-muted-foreground">
            {row.original.fileName}
          </span>
        </div>
      </div>
    ),
  },
  {
    id: "type",
    accessorFn: (row) => row.extension,
    header: "Jenis",
    meta: { headerClassName: "whitespace-nowrap", cellClassName: "whitespace-nowrap" },
    cell: ({ row }) => (
      <div className="flex flex-col items-start gap-1">
        <DocumentTypeBadge extension={row.original.extension} />
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDocumentBytes(row.original.sizeBytes)}
        </span>
      </div>
    ),
  },
  {
    id: "folder",
    accessorFn: (row) => row.folderName ?? "",
    header: "Folder",
    meta: { headerClassName: "whitespace-nowrap", cellClassName: "max-w-40" },
    cell: ({ row }) => (
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <FolderClosed className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {row.original.folderName ?? "Tanpa folder"}
        </span>
      </span>
    ),
  },
  {
    id: "owner",
    accessorFn: (row) => row.ownerName,
    header: "Pemilik",
    meta: { headerClassName: "whitespace-nowrap", cellClassName: "max-w-44" },
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm text-foreground">
          {row.original.ownerName}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {row.original.ownerDivisionName ?? "Tanpa divisi"}
        </span>
      </div>
    ),
  },
  {
    id: "sharing",
    accessorFn: (row) =>
      row.shares.division ? "divisi" : row.shares.supervisor ? "atasan" : "privat",
    header: "Berbagi",
    meta: { headerClassName: "whitespace-nowrap", cellClassName: "whitespace-nowrap" },
    cell: ({ row }) =>
      row.original.purgeAfter ? (
        <Badge variant="warning-light">Di sampah</Badge>
      ) : (
        <DocumentShareBadges shares={row.original.shares} />
      ),
  },
  {
    id: "updated",
    accessorFn: (row) => row.updatedAt,
    header: "Diperbarui",
    meta: { headerClassName: "whitespace-nowrap", cellClassName: "whitespace-nowrap" },
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatDateTime(row.original.updatedAt, "d MMM yyyy")}
      </span>
    ),
  },
];

export function DocumentList({
  rows,
  total,
  pagination,
  tab,
}: {
  rows: WorkDocumentRow[];
  total: number;
  pagination: PageRequest;
  tab: WorkDocumentTab;
}) {
  const table = useTable({
    features: dataGridFeatures,
    data: rows,
    columns,
    manualPagination: true,
    rowCount: total,
    state: { pagination },
    getRowId: (row) => row.id,
  });

  return (
    <div className="flex w-full flex-col">
      <div className="hidden md:block">
        <DataGrid
          table={table}
          recordCount={total}
          tableLayout={{ dense: true, width: "auto", headerBorder: true }}
          tableClassNames={{
            base: "min-w-[58rem]",
            headerRow: "bg-muted/40",
          }}
        >
          <DataGridContainer>
            <DataGridScrollArea>
              <DataGridTable />
            </DataGridScrollArea>
          </DataGridContainer>
        </DataGrid>
      </div>

      <div className="divide-y divide-border/70 md:hidden">
        {rows.map((row) => (
          <article key={row.id} className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <DocumentFileIcon extension={row.extension} size="default" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Link
                  href={`/dokumen/${row.id}`}
                  className="block truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                >
                  {row.title}
                </Link>
                <span className="truncate text-xs text-muted-foreground">
                  {row.fileName}
                </span>
              </div>
              <DocumentTypeBadge extension={row.extension} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {formatDocumentBytes(row.sizeBytes)}
                </span>
                <span aria-hidden="true">·</span>
                <span>{row.ownerName}</span>
                <span aria-hidden="true">·</span>
                <span className="flex min-w-0 items-center gap-1">
                  <FolderClosed
                    className="size-3 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="max-w-36 truncate">
                    {row.folderName ?? "Tanpa folder"}
                  </span>
                </span>
                {tab === "sampah" && row.purgeAfter ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center gap-1 tabular-nums">
                      <Clock3 className="size-3 shrink-0" aria-hidden="true" />
                      Hapus{" "}
                      {formatDateTime(row.purgeAfter, "d MMM yyyy")}
                    </span>
                  </>
                ) : null}
              </span>
              {tab === "sampah" ? (
                <Badge variant="warning-light">Di sampah</Badge>
              ) : (
                <DocumentShareBadges shares={row.shares} />
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
