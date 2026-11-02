import { ManualWorkPageSkeleton } from "@/components/pekerjaan/manual-work-skeletons";

/** Keep the real role-aware shell; only database-backed regions are pending. */
export default function PekerjaanLoading() {
  return <ManualWorkPageSkeleton />;
}
