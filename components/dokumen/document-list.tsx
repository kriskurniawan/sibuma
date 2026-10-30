"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock3,
  FolderClosed,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridSelectionBar } from "@/components/reui/data-grid/data-grid-cell-selection";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import {
  DataGridTable,
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "@/components/reui/data-grid/data-grid-table";
import {
  DocumentShareBadges,
  DocumentTypeBadge,
} from "@/components/dokumen/document-badges";
import { DocumentFileIcon } from "@/components/dokumen/document-file-icon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { PageRequest } from "@/lib/pagination";
import { formatDateTime } from "@/lib/time";
import {
  formatDocumentBytes,
  type WorkDocumentRow,
  type WorkDocumentTab,
} from "@/lib/work-document-types";

type BulkAction = "trash" | "restore" | "purge";

const BULK_ACTIONS: Record<
  WorkDocumentTab,
  ReadonlyArray<{ value: BulkAction; label: string }>
> = {
  saya: [{ value: "trash", label: "Pindahkan ke sampah" }],
  dibagikan: [],
  sampah: [
    { value: "restore", label: "Pulihkan" },
    { value: "purge", label: "Hapus permanen" },
  ],
};

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

const selectionColumn: ColumnDef<DataGridFeatures, WorkDocumentRow> = {
  id: "select",
  header: () => <DataGridTableRowSelectAll />,
  cell: ({ row }) => <DataGridTableRowSelect row={row} />,
  enableSorting: false,
  enableHiding: false,
  size: 36,
  meta: {
    headerClassName: "w-9",
    cellClassName: "w-9",
  },
};

const gridLabels = {
  selectRow: "Pilih dokumen",
  selectAll: "Pilih semua dokumen di halaman ini",
};

function bulkActionConfirmation(
  action: BulkAction,
  count: number,
  trashRetentionDays: number,
) {
  if (action === "trash") {
    return {
      title: `Pindahkan ${count} dokumen ke sampah?`,
      description: `Dokumen yang dipilih akan dipindahkan ke sampah dan dihapus permanen setelah ${trashRetentionDays} hari. Berbagi otomatis ditutup.`,
      confirmLabel: "Pindahkan",
      destructive: false,
    };
  }
  if (action === "restore") {
    return {
      title: `Pulihkan ${count} dokumen?`,
      description:
        "Dokumen yang dipilih akan kembali aktif dan dapat dibagikan lagi.",
      confirmLabel: "Pulihkan",
      destructive: false,
    };
  }
  return {
    title: `Hapus permanen ${count} dokumen?`,
    description:
      "Dokumen yang dipilih beserta berkasnya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.",
    confirmLabel: "Hapus permanen",
    destructive: true,
  };
}

export function DocumentList({
  rows,
  total,
  pagination,
  tab,
  readOnly,
  trashRetentionDays,
}: {
  rows: WorkDocumentRow[];
  total: number;
  pagination: PageRequest;
  tab: WorkDocumentTab;
  readOnly: boolean;
  trashRetentionDays: number;
}) {
  const router = useRouter();
  const actionOptions = BULK_ACTIONS[tab];
  const selectable = !readOnly && actionOptions.length > 0;
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkAction, setBulkAction] = useState<BulkAction | "">("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const tableColumns = useMemo(
    () => (selectable ? [selectionColumn, ...columns] : columns),
    [selectable],
  );

  const table = useTable({
    features: dataGridFeatures,
    data: rows,
    columns: tableColumns,
    manualPagination: true,
    rowCount: total,
    state: { pagination, rowSelection },
    enableRowSelection: selectable,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const currentAction = actionOptions.find(
    (option) => option.value === bulkAction,
  );
  const confirmation =
    currentAction && selectedCount > 0
      ? bulkActionConfirmation(
          currentAction.value,
          selectedCount,
          trashRetentionDays,
        )
      : null;

  // Pilihan lama tidak boleh menempel saat pindah tab atau halaman.
  useEffect(() => {
    setRowSelection({});
    setBulkAction("");
  }, [tab, pagination.pageIndex, pagination.pageSize]);

  // Setelah refresh, buang ID yang sudah tidak ada di halaman ini.
  useEffect(() => {
    setRowSelection((current) => {
      const visible = new Set(rows.map((row) => row.id));
      const entries = Object.entries(current).filter(([id, selected]) => {
        return selected && visible.has(id);
      });
      if (entries.length === Object.keys(current).length) return current;
      return Object.fromEntries(entries);
    });
  }, [rows]);

  async function runBulkAction() {
    if (!currentAction || busy || selectedCount === 0) return;
    const ids = selectedRows.map((row) => row.id);
    setBusy(true);
    try {
      const response = await fetch("/api/dokumen/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: currentAction.value, ids }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        results?: Array<{ id: string; ok: boolean; message?: string }>;
        succeeded?: number;
        failed?: number;
      } | null;
      if (!response.ok) {
        throw new Error(
          payload?.message ?? "Aksi massal gagal dijalankan.",
        );
      }

      const results = payload?.results ?? [];
      const failedIds = results
        .filter((result) => !result.ok)
        .map((result) => result.id);
      const succeeded =
        payload?.succeeded ?? results.filter((result) => result.ok).length;
      const failed = payload?.failed ?? failedIds.length;

      setConfirmOpen(false);
      setRowSelection(
        Object.fromEntries(failedIds.map((id) => [id, true])),
      );

      if (failed === 0) {
        toast.success(
          currentAction.value === "trash"
            ? `${succeeded} dokumen dipindahkan ke sampah.`
            : currentAction.value === "restore"
              ? `${succeeded} dokumen dipulihkan dari sampah.`
              : `${succeeded} dokumen dihapus permanen.`,
        );
        setBulkAction("");
      } else {
        const firstError = results.find((result) => !result.ok)?.message;
        toast.error(
          `${failed} dari ${ids.length} dokumen gagal diproses.`,
          firstError ? { description: firstError } : undefined,
        );
      }
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Aksi massal gagal dijalankan.",
      );
    } finally {
      setBusy(false);
    }
  }

  const bulkControls = (
    <>
      <Select
        value={bulkAction}
        onValueChange={(value) => setBulkAction(value as BulkAction)}
        items={actionOptions}
        disabled={busy}
      >
        <SelectTrigger size="sm" className="w-44" aria-label="Aksi massal">
          <SelectValue placeholder="Pilih aksi" />
        </SelectTrigger>
        <SelectContent>
          {actionOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.value === "restore" ? (
                <RotateCcw aria-hidden="true" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant={currentAction?.value === "purge" ? "destructive" : "default"}
        disabled={!currentAction || selectedCount === 0 || busy}
        onClick={() => setConfirmOpen(true)}
      >
        {busy ? <Spinner /> : null}
        {busy ? "Memproses…" : "Terapkan"}
      </Button>
    </>
  );

  return (
    <>
      <DataGrid
        table={table}
        recordCount={total}
        tableLayout={{ dense: true, width: "auto", headerBorder: true }}
        tableClassNames={{
          base: "min-w-[58rem]",
          headerRow: "bg-muted/40",
        }}
        i18n={{ labels: gridLabels }}
      >
        <DataGridContainer className="hidden md:block">
          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>
        </DataGridContainer>

        <div className="divide-y divide-border/70 md:hidden">
          {rows.map((row) => {
            const tableRow = table.getRow(row.id);
            const selected = Boolean(rowSelection[row.id]);
            return (
              <article
                key={row.id}
                className={cn(
                  "flex flex-col gap-3 p-4",
                  selected && "bg-muted/50",
                )}
              >
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
                  <div className="flex shrink-0 items-center gap-2">
                    <DocumentTypeBadge extension={row.extension} />
                    {selectable && tableRow ? (
                      <DataGridTableRowSelect row={tableRow} />
                    ) : null}
                  </div>
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
            );
          })}
        </div>

        <div className="above-mobile-nav pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4 md:hidden">
          <DataGridSelectionBar
            className="pointer-events-auto"
            label={(count) => `${count} dokumen dipilih`}
            clearLabel="Bersihkan"
            onClear={() => setBulkAction("")}
          >
            {bulkControls}
          </DataGridSelectionBar>
        </div>
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 hidden justify-center px-4 md:flex">
          <DataGridSelectionBar
            className="pointer-events-auto"
            label={(count) => `${count} dokumen dipilih`}
            clearLabel="Bersihkan"
            onClear={() => setBulkAction("")}
          >
            {bulkControls}
          </DataGridSelectionBar>
        </div>
      </DataGrid>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant={confirmation?.destructive ? "destructive" : "default"}
              disabled={busy}
              onClick={() => {
                void runBulkAction();
              }}
            >
              {busy && <Spinner />}
              {busy ? "Memproses…" : confirmation?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
