"use client";

import { useTable, type ColumnDef } from "@tanstack/react-table";
import { CalendarClock, MapPin } from "lucide-react";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportTab } from "@/components/reports/report-shell";

// Loading-only columns mirror the headers, order, and minimum width of each report grid.
// No fabricated report records or counts are rendered: DataGrid owns loading rows.
const HEADINGS: Record<ReportTab, string[]> = {
  checklist: [
    "Pemeriksaan",
    "Lokasi",
    "Status",
    "Progres",
    "Tindak lanjut",
    "Petugas",
  ],
  "tindak-lanjut": [
    "Tindak lanjut",
    "Status",
    "Prioritas",
    "Deadline",
    "PIC",
    "Area",
    "Dibuat",
  ],
  pekerjaan: [
    "Pekerjaan",
    "Lokasi",
    "Status",
    "Jadwal",
    "Pekerja",
    "Petugas safety",
    "Dokumentasi",
    "Pelapor",
  ],
  lembur: [
    "Tanggal",
    "SPKL",
    "Pekerja",
    "Status",
    "Masuk",
    "Pulang",
    "Durasi",
    "Bukti",
    "Lokasi",
  ],
};
const MOBILE_FIELDS: Record<ReportTab, string[]> = {
  checklist: ["Progres", "Temuan", "Tindak lanjut", "Jatuh tempo"],
  "tindak-lanjut": ["Deadline", "PIC"],
  pekerjaan: ["Mulai", "Target", "Pekerja", "Dokumentasi"],
  lembur: ["Masuk", "Pulang", "Bukti"],
};
const MIN_WIDTH: Record<ReportTab, string> = {
  checklist: "min-w-[64rem]",
  "tindak-lanjut": "min-w-[68rem]",
  pekerjaan: "min-w-[76rem]",
  lembur: "min-w-[64rem]",
};
const LOADING_COLUMNS = Object.fromEntries(
  Object.entries(HEADINGS).map(([tab, headings]) => [
    tab,
    headings.map((header) => ({
      id: header,
      header,
      meta: {
        headerClassName: "whitespace-nowrap",
        skeleton: <Skeleton className="h-4 w-20" />,
      },
    })),
  ]),
) as Record<ReportTab, ColumnDef<DataGridFeatures, Record<string, never>>[]>;
const NO_ROWS: Record<string, never>[] = [];

export function ReportGridSkeleton({ tab }: { tab: ReportTab }) {
  const table = useTable({
    features: dataGridFeatures,
    columns: LOADING_COLUMNS[tab],
    data: NO_ROWS,
    initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
  });
  return (
    <DataGrid
      table={table}
      recordCount={0}
      isLoading
      tableLayout={{ dense: true, width: "auto", headerBorder: true }}
      tableClassNames={{ base: MIN_WIDTH[tab], headerRow: "bg-muted/40" }}
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
          {Array.from({ length: 5 }, (_, index) => (
            <article key={index} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Skeleton className="h-5 w-48 max-w-full" />
                  <Skeleton className="h-3 w-36 max-w-full" />
                  {tab === "checklist" && <Skeleton className="h-3 w-24" />}
                </div>
                <Skeleton className="h-5 w-20 shrink-0" />
              </div>
              {tab === "lembur" && (
                <div className="flex items-center gap-2">
                  <Skeleton className="size-6 shrink-0 rounded-full" />
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="ml-auto h-3 w-16" />
                </div>
              )}
              <div
                className={`grid gap-2 bg-muted/50 px-3 py-2.5 ${tab === "lembur" ? "grid-cols-3" : "grid-cols-2"}`}
              >
                {MOBILE_FIELDS[tab].map((label) => (
                  <div key={label} className="flex min-w-0 flex-col gap-1">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <Skeleton className="h-4 w-16 max-w-full" />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3 shrink-0" aria-hidden="true" />
                <Skeleton className="h-3 w-40 max-w-full" />
              </div>
              {tab === "tindak-lanjut" && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock
                    className="size-3 shrink-0"
                    aria-hidden="true"
                  />
                  Dibuat <Skeleton className="h-3 w-24" />
                </div>
              )}
              {tab === "pekerjaan" && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Pelapor: <Skeleton className="h-3 w-28" />
                </div>
              )}
            </article>
          ))}
        </div>
        <div className="border-t border-border/70 px-4 py-2">
          <DataGridPagination
            sizes={[10, 25, 50, 100]}
            sizesSkeleton={
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                Baris per halaman
                <Skeleton className="h-7 w-16" />
              </div>
            }
            infoSkeleton={
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Skeleton className="h-4 w-6" />–
                <Skeleton className="h-4 w-6" /> dari
                <Skeleton className="h-4 w-8" />
              </div>
            }
          />
        </div>
      </div>
    </DataGrid>
  );
}
