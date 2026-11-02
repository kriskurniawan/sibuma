import { MobileSummary } from "@/components/mobile-summary";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardFocusSkeleton({ supervisor = false }: { supervisor?: boolean }) {
  if (supervisor) {
    return (
      <div role="status" aria-label="Memuat fokus checklist" className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Skeleton className="size-10 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">Perlu perhatian</p>
            <Skeleton className="h-4 w-44 max-w-full" />
            <Skeleton className="h-3 w-32 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  return (
    <div role="status" aria-label="Memuat fokus checklist" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-10" />
        </div>
        <Skeleton className="h-1.5 w-full" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-9 w-full sm:w-40" />
      </div>
    </div>
  );
}

function SummaryIconSkeleton() {
  return <Skeleton className="size-3.5" />;
}

export function DashboardSummarySkeleton({
  labels = ["Checklist aktif", "Terlambat", "Selesai bulan ini", "Tindak lanjut saya"],
}: {
  labels?: string[];
}) {
  return (
    <div role="status" aria-label="Memuat ringkasan">
      <MobileSummary items={labels.map((label) => ({
        label,
        icon: SummaryIconSkeleton,
        value: <Skeleton className="h-7 w-12" />,
      }))} />
    </div>
  );
}

export function DashboardStatsSkeleton({
  labels = ["Checklist aktif", "Terlambat", "Selesai bulan ini", "Tindak lanjut saya"],
}: {
  labels?: string[];
}) {
  return labels.map((label) => (
    <Card key={label} size="sm" role="status" aria-label={`Memuat ${label}`}>
      <CardHeader>
        <CardDescription className="text-xs font-medium">{label}</CardDescription>
        <CardAction><Skeleton className="size-8" /></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-4 w-32" />
      </CardContent>
    </Card>
  ));
}

export function DashboardRowsSkeleton({
  kind,
  count = 3,
}: {
  kind: "checklist" | "follow-up" | "overtime" | "manual-work" | "team" | "activity";
  count?: number;
}) {
  return (
    <div role="status" aria-label="Memuat data" className="flex min-w-0 flex-col divide-y divide-border/70">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={kind === "checklist" || kind === "follow-up"
          ? "flex min-w-0 flex-col gap-2 py-3"
          : "flex min-w-0 flex-col gap-2 py-3 first:pt-0 last:pb-0"}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3 w-36 max-w-full" />
            </div>
            <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
          </div>
          {(kind === "checklist" || kind === "follow-up" || kind === "manual-work" || kind === "activity") && (
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          )}
          {kind === "checklist" && <Skeleton className="h-1.5 w-full" />}
          {kind === "follow-up" && <Skeleton className="h-6 w-28" />}
        </div>
      ))}
    </div>
  );
}
