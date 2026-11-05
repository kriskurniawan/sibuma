import { Badge } from "@/components/ui";
import {
  CHECKLIST_EQUIPMENT_ACTIVITY_LABEL,
  type ChecklistEquipmentActivity,
} from "@/lib/checklist-types";

const ACTIVITY_VARIANT = {
  penggantian: "info-light",
  perbaikan: "warning-light",
  pengisian: "success-light",
  servis: "outline",
} as const;

export function EquipmentActivityBadge({
  activity,
  className,
}: {
  activity: ChecklistEquipmentActivity;
  className?: string;
}) {
  return (
    <Badge variant={ACTIVITY_VARIANT[activity]} className={className}>
      {CHECKLIST_EQUIPMENT_ACTIVITY_LABEL[activity]}
    </Badge>
  );
}
