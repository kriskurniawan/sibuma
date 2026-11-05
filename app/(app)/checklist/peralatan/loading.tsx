import { ChecklistEquipmentShell } from "@/components/checklist/submenu-shells";
import { ChecklistEquipmentSkeleton } from "@/components/checklist/equipment-skeletons";

export default function ChecklistEquipmentLoading() {
  return (
    <ChecklistEquipmentShell>
      <ChecklistEquipmentSkeleton />
    </ChecklistEquipmentShell>
  );
}
