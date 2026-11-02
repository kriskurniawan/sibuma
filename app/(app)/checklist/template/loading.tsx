import { ChecklistTemplateShell } from "@/components/checklist/submenu-shells";
import { ChecklistTemplateDataSkeleton } from "@/components/checklist/submenu-skeletons";

export default function ChecklistTemplateLoading() {
  return (
    <ChecklistTemplateShell>
      <ChecklistTemplateDataSkeleton />
    </ChecklistTemplateShell>
  );
}
