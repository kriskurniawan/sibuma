import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileBarChart2,
  Hammer,
  Timer,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { StatCard } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportGridSkeleton } from "@/components/reports/report-grid-skeleton";
import type { ReportTab } from "@/components/reports/report-shell";

const KPI_ITEMS = {
  checklist: [
    {
      label: "Total pemeriksaan",
      icon: ClipboardCheck,
      suffix: undefined,
      helper: (
        <>
          <PendingNumber /> belum selesai · <PendingNumber /> terlambat
        </>
      ),
    },
    {
      label: "Selesai",
      icon: CheckCircle2,
      suffix: "pemeriksaan",
      helper: (
        <>
          <PendingNumber /> tepat waktu · <PendingNumber /> terlambat
        </>
      ),
    },
    {
      label: "Temuan",
      icon: TriangleAlert,
      suffix: "item",
      helper: "Perlu perhatian atau tidak baik",
    },
    {
      label: "Tindak lanjut",
      icon: FileBarChart2,
      suffix: "terbuka",
      helper: "Belum selesai atau dibatalkan",
    },
  ],
  "tindak-lanjut": [
    {
      label: "Total tindak lanjut",
      icon: ClipboardCheck,
      suffix: undefined,
      helper: (
        <>
          <PendingNumber /> belum selesai
        </>
      ),
    },
    {
      label: "Belum selesai",
      icon: Timer,
      suffix: "tindak lanjut",
      helper: (
        <>
          <PendingNumber /> sedang diproses
        </>
      ),
    },
    {
      label: "Terlambat",
      icon: TriangleAlert,
      suffix: "tindak lanjut",
      helper: "Melewati deadline",
    },
    {
      label: "Selesai",
      icon: CheckCircle2,
      suffix: "tindak lanjut",
      helper: (
        <>
          <PendingNumber /> dibatalkan
        </>
      ),
    },
  ],
  pekerjaan: [
    {
      label: "Total pekerjaan",
      icon: Hammer,
      suffix: "pekerjaan",
      helper: (
        <>
          <PendingNumber /> selesai · <PendingNumber /> dibatalkan
        </>
      ),
    },
    {
      label: "Masih aktif",
      icon: Clock3,
      suffix: "pekerjaan",
      helper: (
        <>
          <PendingNumber /> belum mulai · <PendingNumber /> dikerjakan
        </>
      ),
    },
    {
      label: "Terlambat",
      icon: TriangleAlert,
      suffix: "pekerjaan",
      helper: "Melewati target selesai",
    },
    {
      label: "Dokumentasi",
      icon: Camera,
      suffix: "foto",
      helper: (
        <>
          <PendingNumber /> pekerja terlibat
        </>
      ),
    },
  ],
  lembur: [
    {
      label: "Total sesi",
      icon: UsersRound,
      suffix: undefined,
      helper: (
        <>
          <PendingNumber /> pekerja
        </>
      ),
    },
    {
      label: "Total jam",
      icon: Clock3,
      suffix: undefined,
      helper: "Setelah pembulatan kebijakan",
    },
    {
      label: "Dokumentasi",
      icon: Camera,
      suffix: "foto",
      helper: "Bukti kerja terlampir",
    },
    {
      label: "Tingkat kehadiran",
      icon: CheckCircle2,
      suffix: undefined,
      helper: (
        <>
          <PendingNumber /> hadir · <PendingNumber /> tidak hadir
        </>
      ),
    },
  ],
};

function PendingNumber() {
  return <Skeleton className="inline-block h-3 w-6 align-middle" />;
}

function ReportFooterSkeleton({ tab }: { tab: ReportTab }) {
  return (
    <FrameFooter className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      {tab === "lembur" ? (
        <>
          <span className="flex items-center gap-1.5">
            <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
            Durasi memakai pembulatan kebijakan
          </span>
          <span className="flex items-center gap-1.5">
            <UsersRound className="size-3.5 shrink-0" aria-hidden="true" />
            <PendingNumber /> pekerja · <PendingNumber /> sesi
          </span>
        </>
      ) : tab === "checklist" ? (
        <>
          <span className="flex items-center gap-1.5">
            <ClipboardCheck className="size-3.5 shrink-0" aria-hidden="true" />
            <PendingNumber /> pemeriksaan · <PendingNumber /> temuan
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
            <PendingNumber /> selesai · <PendingNumber /> belum selesai
          </span>
        </>
      ) : tab === "tindak-lanjut" ? (
        <>
          <span className="flex items-center gap-1.5">
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
            <PendingNumber /> melewati deadline
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
            <PendingNumber /> selesai · <PendingNumber /> belum selesai
          </span>
        </>
      ) : (
        <>
          <span className="flex items-center gap-1.5">
            <Hammer className="size-3.5 shrink-0" aria-hidden="true" />
            <PendingNumber /> aktif · <PendingNumber /> terlambat
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
            <PendingNumber /> selesai · <PendingNumber /> foto
          </span>
        </>
      )}
    </FrameFooter>
  );
}

export function ReportDataSkeleton({ tab }: { tab: ReportTab }) {
  const title =
    tab === "checklist"
      ? "Rincian pemeriksaan"
      : tab === "tindak-lanjut"
        ? "Rincian tindak lanjut"
        : tab === "pekerjaan"
          ? "Rincian pekerjaan harian"
          : "Rincian absensi";
  return (
    <div
      role="status"
      aria-label="Memuat data laporan"
      className="flex min-w-0 flex-col gap-6"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_ITEMS[tab].map(({ label, icon, suffix, helper }) => (
          <StatCard
            key={label}
            label={label}
            icon={icon}
            suffix={suffix}
            value={<Skeleton className="h-8 w-20" />}
            helper={helper}
            tone="neutral"
          />
        ))}
      </div>
      {tab === "lembur" && (
        <Frame>
          <FrameHeader>
            <FrameTitle>Beban lembur tim</FrameTitle>
            <FrameDescription className="text-xs">
              20 pekerja dengan durasi tertinggi · total mengikuti seluruh
              filter
            </FrameDescription>
          </FrameHeader>
          <FramePanel className="flex flex-col gap-4">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </FramePanel>
        </Frame>
      )}
      <Frame>
        <FrameHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <FrameTitle
                className={tab === "lembur" ? undefined : "max-md:sr-only"}
              >
                {title}
              </FrameTitle>
              <FrameDescription className="text-xs">
                <PendingNumber /> baris data
                {tab === "checklist"
                  ? " berdasarkan periode jatuh tempo."
                  : tab === "tindak-lanjut"
                    ? " dari pemeriksaan pada periode ini."
                    : tab === "pekerjaan"
                      ? " berdasarkan tanggal mulai."
                      : ""}
              </FrameDescription>
            </div>
            {tab === "lembur" ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                Koreksi ditandai dan tercatat di audit log
              </p>
            ) : (
              <Skeleton className="h-5 w-40 max-w-full rounded-full" />
            )}
          </div>
        </FrameHeader>
        <FramePanel className="p-0">
          <ReportGridSkeleton tab={tab} />
        </FramePanel>
        <ReportFooterSkeleton tab={tab} />
      </Frame>
    </div>
  );
}
