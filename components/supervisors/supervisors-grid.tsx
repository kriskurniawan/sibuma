"use client";

import { useMemo } from "react";
import { PencilLine, UsersRound } from "lucide-react";
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
import { teamGridI18n } from "@/components/team/team-grid-shared";
import { Avatar, Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { avatarUrl } from "@/lib/avatar-url";
import { ACCESS_MODE_LABEL } from "@/lib/constants";
import type { SupervisorRow } from "@/lib/supervisor-queries";

const PAGE_SIZES = [10, 25, 50];

const TABLE_CLASSES = {
  base: "min-w-[56rem]",
  headerRow: "bg-muted/40",
};

export function SupervisorsGrid({
  rows,
  onEdit,
}: {
  rows: SupervisorRow[];
  onEdit: (row: SupervisorRow) => void;
}) {
  const columns = useMemo<ColumnDef<DataGridFeatures, SupervisorRow>[]>(
    () => [
      {
        id: "supervisor",
        accessorFn: (row) => `${row.employee.name} ${row.employee.nik}`,
        header: "Atasan",
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
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-foreground">
                  {employee.name}
                </span>
                <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                  NIK {employee.nik}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: "contact",
        accessorFn: (row) =>
          `${row.employee.phone} ${row.employee.email ?? ""}`,
        header: "Kontak",
        meta: {
          headerClassName: "whitespace-nowrap",
          cellClassName: "whitespace-nowrap",
        },
        cell: ({ row }) => (
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="tabular-nums">{row.original.employee.phone}</span>
            <span>{row.original.employee.email ?? "Email belum diisi"}</span>
          </div>
        ),
      },
      {
        id: "team",
        accessorFn: (row) => row.teamCount,
        header: "Anggota tim",
        meta: {
          headerClassName: "whitespace-nowrap text-end [&>div]:justify-end",
          cellClassName: "whitespace-nowrap text-end tabular-nums",
        },
        cell: ({ row }) => (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-sm font-medium text-foreground">
              {row.original.teamCount}
            </span>
            <span className="text-xs text-muted-foreground">
              {row.original.activeTeamCount} aktif
            </span>
          </div>
        ),
      },
      {
        id: "divisions",
        accessorFn: (row) => row.divisionCount,
        header: "Divisi",
        meta: {
          headerClassName: "whitespace-nowrap text-end [&>div]:justify-end",
          cellClassName: "whitespace-nowrap text-end tabular-nums",
        },
        cell: ({ row }) => (
          <span className="text-sm text-foreground">
            {row.original.divisionCount}
          </span>
        ),
      },
      {
        id: "accessMode",
        accessorFn: (row) => row.employee.accessMode,
        header: "Hak akses",
        meta: {
          headerClassName: "whitespace-nowrap",
          cellClassName: "whitespace-nowrap",
        },
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.employee.accessMode === "read_only"
                ? "warning-light"
                : "success-light"
            }
          >
            {ACCESS_MODE_LABEL[row.original.employee.accessMode]}
          </Badge>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => (row.employee.active ? "Aktif" : "Nonaktif"),
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
            {row.original.employee.active ? "Aktif" : "Nonaktif"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Aksi",
        meta: {
          headerClassName: "whitespace-nowrap text-end [&>div]:justify-end",
          cellClassName: "whitespace-nowrap text-end",
        },
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(row.original)}
          >
            <PencilLine aria-hidden="true" />
            Ubah
          </Button>
        ),
      },
    ],
    [onEdit],
  );

  const table = useTable({
    features: dataGridFeatures,
    data: rows,
    columns,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
    getRowId: (row) => row.employee.id,
  });

  return (
    <DataGrid
      table={table}
      recordCount={rows.length}
      i18n={teamGridI18n}
      emptyMessage={
        rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <UsersRound
              className="size-6 text-muted-foreground"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-foreground">
              Tidak ada atasan yang cocok
            </p>
            <p className="text-xs text-muted-foreground">
              Ubah kata kunci pencarian atau tambahkan akun atasan baru.
            </p>
          </div>
        ) : undefined
      }
      tableLayout={{ dense: true, width: "auto", headerBorder: true }}
      tableClassNames={TABLE_CLASSES}
    >
      <DataGridContainer>
        <DataGridScrollArea>
          <DataGridTable />
        </DataGridScrollArea>
      </DataGridContainer>
      <div className="border-t border-border/70 px-4 py-2">
        <DataGridPagination sizes={PAGE_SIZES} />
      </div>
    </DataGrid>
  );
}
