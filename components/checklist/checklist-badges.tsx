import { Badge } from "@/components/ui";
import {
  CHECKLIST_CONDITION_LABEL,
  CHECKLIST_FOLLOW_UP_LABEL,
  CHECKLIST_PRIORITY_LABEL,
  CHECKLIST_STATUS_LABEL,
  type ChecklistCondition,
  type ChecklistFollowUpStatus,
  type ChecklistInspectionStatus,
  type ChecklistPriority,
} from "@/lib/checklist-types";

const STATUS_VARIANT = {
  belum_dimulai: "outline",
  berlangsung: "warning-light",
  selesai: "success-light",
  dilewati: "info-light",
} as const;

const CONDITION_VARIANT = {
  baik: "success-light",
  perlu_perhatian: "warning-light",
  tidak_baik: "destructive-light",
  tidak_berlaku: "outline",
} as const;

const FOLLOW_UP_VARIANT = {
  terbuka: "info-light",
  diproses: "warning-light",
  tertunda: "warning-outline",
  selesai: "success-light",
  dibatalkan: "outline",
} as const;

const PRIORITY_VARIANT = {
  rendah: "outline",
  sedang: "info-light",
  tinggi: "warning-light",
  mendesak: "destructive-light",
} as const;

export function ChecklistStatusBadge({
  status,
  className,
}: {
  status: ChecklistInspectionStatus;
  className?: string;
}) {
  return (
    <Badge
      variant={STATUS_VARIANT[status]}
      dot={status === "berlangsung"}
      className={className}
    >
      {CHECKLIST_STATUS_LABEL[status]}
    </Badge>
  );
}

export function ChecklistConditionBadge({
  condition,
  className,
}: {
  condition: ChecklistCondition;
  className?: string;
}) {
  return (
    <Badge variant={CONDITION_VARIANT[condition]} className={className}>
      {CHECKLIST_CONDITION_LABEL[condition]}
    </Badge>
  );
}

export function ChecklistFollowUpBadge({
  status,
  className,
}: {
  status: ChecklistFollowUpStatus;
  className?: string;
}) {
  return (
    <Badge variant={FOLLOW_UP_VARIANT[status]} className={className}>
      {CHECKLIST_FOLLOW_UP_LABEL[status]}
    </Badge>
  );
}

export function ChecklistPriorityBadge({
  priority,
  className,
}: {
  priority: ChecklistPriority;
  className?: string;
}) {
  return (
    <Badge variant={PRIORITY_VARIANT[priority]} className={className}>
      {CHECKLIST_PRIORITY_LABEL[priority]}
    </Badge>
  );
}

export function ChecklistOverdueBadge({ className }: { className?: string }) {
  return (
    <Badge variant="destructive-light" dot className={className}>
      Terlambat
    </Badge>
  );
}
