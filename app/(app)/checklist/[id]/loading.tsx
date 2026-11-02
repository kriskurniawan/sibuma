import { ChecklistDetailShell } from "@/components/checklist/checklist-detail-shell";
import { ChecklistDetailSkeleton } from "@/components/checklist/checklist-detail-skeleton";

export default function ChecklistDetailLoading() {
  return <ChecklistDetailShell><ChecklistDetailSkeleton /></ChecklistDetailShell>;
}
