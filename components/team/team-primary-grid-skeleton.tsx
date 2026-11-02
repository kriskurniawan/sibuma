"use client";

import { useTable, type ColumnDef } from "@tanstack/react-table";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from "@/components/reui/data-grid/data-grid";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { Skeleton } from "@/components/ui/skeleton";

const headers = {
  pekerja: ["Pekerja", "Divisi", "Kontak", "Sesi", "Durasi", "Bukti", "Status", "Aksi"],
  divisi: ["Nama", "Deskripsi", "Jumlah pekerja", "Status", "Aksi"],
  atasan: ["Atasan", "Kontak", "Anggota tim", "Divisi", "Hak akses", "Status", "Aksi"],
};

export function TeamPrimaryGridSkeleton({ kind }: { kind: keyof typeof headers }) {
  const columns: ColumnDef<DataGridFeatures, Record<string, never>>[] = headers[kind].map((header, index) => ({ id: `loading-${index}`, header, meta: { skeleton: <Skeleton className="h-4 w-24 max-w-full" /> } }));
  const table = useTable({ features: dataGridFeatures, data: [], columns, initialState: { pagination: { pageIndex: 0, pageSize: 6 } } });
  return <div className="hidden md:block"><DataGrid table={table} recordCount={0} isLoading tableLayout={{ dense: true, width: "auto", headerBorder: true }} tableClassNames={{ base: "min-w-[64rem]", headerRow: "bg-muted/40" }}>
    <DataGridContainer><DataGridScrollArea><DataGridTable /></DataGridScrollArea></DataGridContainer>
  </DataGrid></div>;
}
