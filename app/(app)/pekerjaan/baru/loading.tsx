import { ManualWorkFormSkeleton } from "@/components/pekerjaan/manual-work-form-skeleton";
import { ManualWorkFormShell } from "@/components/pekerjaan/manual-work-page-shell";

export default function PekerjaanBaruLoading() {
  return <ManualWorkFormShell mode="create"><ManualWorkFormSkeleton /></ManualWorkFormShell>;
}
