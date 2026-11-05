import { ChecklistEquipmentDetailShell } from "@/components/checklist/checklist-detail-shell";
import { ChecklistEquipmentDetailSkeleton } from "@/components/checklist/equipment-skeletons";

export default function ChecklistEquipmentDetailLoading() {
  return (
    <ChecklistEquipmentDetailShell>
      <ChecklistEquipmentDetailSkeleton />
    </ChecklistEquipmentDetailShell>
  );
}
