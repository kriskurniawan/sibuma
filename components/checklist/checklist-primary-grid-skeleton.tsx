"use client";

import { useTable, type ColumnDef } from "@tanstack/react-table";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from "@/components/reui/data-grid/data-grid";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { Skeleton } from "@/components/ui/skeleton";

const columns: ColumnDef<DataGridFeatures, Record<string, never>>[] = [
  "Checklist", "Lokasi & tanggal", "Deadline", "Progres", "Tim", "Status", "Temuan", "",
].map((header, index) => ({ id: `loading-${index}`, header, meta: { skeleton: <Skeleton className="h-4 w-24 max-w-full" /> } }));

export function ChecklistPrimaryGridSkeleton() {
  const table = useTable({ features: dataGridFeatures, data: [], columns, initialState: { pagination: { pageIndex: 0, pageSize: 5 } } });
  return <div className="hidden md:block"><DataGrid table={table} recordCount={0} isLoading tableLayout={{ dense: true, width: "auto", headerBorder: true }} tableClassNames={{ base: "min-w-[64rem]", headerRow: "bg-muted/40" }}>
    <DataGridContainer><DataGridScrollArea><DataGridTable /></DataGridScrollArea></DataGridContainer>
  </DataGrid></div>;
}
