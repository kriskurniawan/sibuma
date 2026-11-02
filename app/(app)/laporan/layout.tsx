import { Suspense } from "react";
import {
  ReportTabs,
  ReportTabsFallback,
} from "@/components/reports/report-tabs";

export default function LaporanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<ReportTabsFallback />}>
        <ReportTabs />
      </Suspense>
      {children}
    </div>
  );
}
