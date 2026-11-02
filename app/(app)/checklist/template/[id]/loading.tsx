import { ChecklistTemplateDetailShell } from "@/components/checklist/checklist-detail-shell";
import { ChecklistTemplateDetailSkeleton } from "@/components/checklist/checklist-detail-skeleton";

export default function ChecklistTemplateDetailLoading() {
  return <ChecklistTemplateDetailShell><ChecklistTemplateDetailSkeleton /></ChecklistTemplateDetailShell>;
}
