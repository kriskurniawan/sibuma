import { ChecklistQrShell } from "@/components/checklist/submenu-shells";
import { ChecklistQrDataSkeleton } from "@/components/checklist/submenu-skeletons";

export default function ChecklistQrLoading() {
  return (
    <ChecklistQrShell>
      <ChecklistQrDataSkeleton />
    </ChecklistQrShell>
  );
}
