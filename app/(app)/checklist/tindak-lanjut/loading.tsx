import { ChecklistFollowUpShell } from "@/components/checklist/submenu-shells";
import { ChecklistFollowUpDataSkeleton, ChecklistFollowUpSummarySkeleton } from "@/components/checklist/submenu-skeletons";

export default function ChecklistFollowUpLoading() {
  return (
    <ChecklistFollowUpShell summary={<ChecklistFollowUpSummarySkeleton />}>
      <ChecklistFollowUpDataSkeleton />
    </ChecklistFollowUpShell>
  );
}
