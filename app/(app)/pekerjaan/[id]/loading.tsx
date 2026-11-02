import { ManualWorkDetailSkeleton } from "@/components/pekerjaan/manual-work-detail-skeleton";
import { ManualWorkDetailShell } from "@/components/pekerjaan/manual-work-page-shell";

export default function PekerjaanDetailLoading() {
  return <ManualWorkDetailShell><ManualWorkDetailSkeleton /></ManualWorkDetailShell>;
}
