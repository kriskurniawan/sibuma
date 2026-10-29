import { AlertTriangle, UserRound } from "lucide-react";
import { Badge } from "@/components/ui";
import {
  MANUAL_WORK_STATUS_LABEL,
  type ManualWorkStatus,
} from "@/lib/manual-work-types";

const STATUS_VARIANT = {
  terbuka: "info-light",
  dikerjakan: "warning-light",
  selesai: "success-light",
  dibatalkan: "outline",
} as const;

export function ManualWorkStatusBadge({
  status,
  className,
}: {
  status: ManualWorkStatus;
  className?: string;
}) {
  return (
    <Badge
      variant={STATUS_VARIANT[status]}
      dot={status === "dikerjakan"}
      className={className}
    >
      {MANUAL_WORK_STATUS_LABEL[status]}
    </Badge>
  );
}

export function ManualWorkOverdueBadge({ className }: { className?: string }) {
  return (
    <Badge variant="destructive-light" className={className}>
      <AlertTriangle aria-hidden="true" />
      Terlambat
    </Badge>
  );
}

export function ManualWorkSelfReportedBadge({
  className,
}: {
  className?: string;
}) {
  return (
    <Badge variant="primary-outline" className={className}>
      <UserRound aria-hidden="true" />
      Dilaporkan pekerja
    </Badge>
  );
}
