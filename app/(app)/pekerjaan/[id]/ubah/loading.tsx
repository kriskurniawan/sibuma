import { ManualWorkFormSkeleton } from "@/components/pekerjaan/manual-work-form-skeleton";
import { ManualWorkFormShell } from "@/components/pekerjaan/manual-work-page-shell";

export default function PekerjaanUbahLoading() {
  return <ManualWorkFormShell mode="edit"><ManualWorkFormSkeleton mode="edit" /></ManualWorkFormShell>;
}
