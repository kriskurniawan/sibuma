import { ChecklistScheduleShell } from "@/components/checklist/submenu-shells";
import { ChecklistScheduleDataSkeleton } from "@/components/checklist/submenu-skeletons";

export default function ChecklistScheduleLoading() {
  return (
    <ChecklistScheduleShell>
      <ChecklistScheduleDataSkeleton />
    </ChecklistScheduleShell>
  );
}
