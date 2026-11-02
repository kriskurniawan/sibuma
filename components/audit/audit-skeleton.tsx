import {
  AlertTriangle,
  ClipboardList,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { FramePanel } from "@/components/reui/frame";
import { StatCard } from "@/components/ui";
import { MobileSummary } from "@/components/mobile-summary";
import { Skeleton } from "@/components/ui/skeleton";

export function AuditStatsSkeleton() {
  return (
    <div role="status" aria-label="Memuat ringkasan audit">
      <MobileSummary
        className="md:hidden"
        items={[
          "Peristiwa",
          "Perubahan SPKL",
          "Koreksi absensi",
          "Pesan gagal",
        ].map((label) => ({
          label,
          value: <Skeleton className="h-7 w-10" />,
          tone: "neutral" as const,
        }))}
      />
      <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total peristiwa", icon: ScrollText },
          { label: "Perubahan SPKL", icon: ClipboardList },
          { label: "Koreksi absensi", icon: ShieldCheck },
          { label: "Pesan gagal", icon: AlertTriangle },
        ].map(({ label, icon }) => (
          <StatCard
            key={label}
            label={label}
            icon={icon}
            value={<Skeleton className="h-8 w-16" />}
            helper={<Skeleton className="h-3 w-36" />}
            tone="neutral"
          />
        ))}
      </div>
    </div>
  );
}

export function AuditRowsSkeleton() {
  return (
    <FramePanel>
      <div
        role="status"
        aria-label="Memuat catatan audit"
        className="flex flex-col gap-4"
      >
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-start gap-3">
            <Skeleton className="size-8 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-48" />
        </div>
      </div>
    </FramePanel>
  );
}
