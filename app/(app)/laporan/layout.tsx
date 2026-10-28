import { Suspense } from "react";
import { ReportTabs } from "@/components/reports/report-tabs";

export default function LaporanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={null}>
        <ReportTabs />
      </Suspense>
      {children}
    </div>
  );
}
