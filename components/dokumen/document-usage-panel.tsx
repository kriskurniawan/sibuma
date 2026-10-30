import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Badge, ProgressBar } from "@/components/ui";
import {
  formatDocumentBytes,
  type WorkDocumentUsage,
} from "@/lib/work-document-types";

export function DocumentUsagePanel({ usage }: { usage: WorkDocumentUsage }) {
  const percent =
    usage.quotaBytes <= 0
      ? 0
      : Math.min(100, Math.round((usage.usedBytes / usage.quotaBytes) * 100));
  const tone = percent >= 90 ? "destructive" : percent >= 70 ? "warning" : "primary";
  const variant =
    percent >= 90
      ? "destructive-light"
      : percent >= 70
        ? "warning-light"
        : "primary-light";

  return (
    <Frame stacked spacing="sm">
      <FrameHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <FrameTitle>Kuota dokumen</FrameTitle>
          <FrameDescription className="text-xs">
            Termasuk berkas di sampah sampai dihapus permanen.
          </FrameDescription>
        </div>
        <Badge variant={variant} className="tabular-nums">
          {percent}% terpakai
        </Badge>
      </FrameHeader>
      <FramePanel className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
          <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {formatDocumentBytes(usage.usedBytes)}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            dari {formatDocumentBytes(usage.quotaBytes)} · maks{" "}
            {formatDocumentBytes(usage.maxFileBytes)} per berkas
          </span>
        </div>
        <ProgressBar value={usage.usedBytes} max={usage.quotaBytes} tone={tone} />
        <div className="grid grid-cols-3 gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Dokumen aktif</span>
            <span className="text-sm font-medium text-foreground tabular-nums">
              {usage.activeCount}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Dibagikan</span>
            <span className="text-sm font-medium text-foreground tabular-nums">
              {usage.sharedCount}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Sampah</span>
            <span className="text-sm font-medium text-foreground tabular-nums">
              {usage.trashCount} · {formatDocumentBytes(usage.trashBytes)}
            </span>
          </div>
        </div>
      </FramePanel>
    </Frame>
  );
}
