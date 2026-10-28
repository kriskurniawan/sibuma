import type { Division, Employee } from "@/lib/types";

export interface TeamWorkerRow {
  employee: Employee;
  monthlyMinutes: number;
  sessions: number;
  documentationCount: number;
}

export interface TeamDivisionRow {
  division: Division;
  workerCount: number;
  activeWorkerCount: number;
}

export const TEAM_PAGE_SIZES = [10, 25, 50, 100];

export const teamGridI18n = {
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
