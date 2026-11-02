import { SpklFormShell } from "@/components/spkl/spkl-route-shell";
import { SpklFormDataSkeleton } from "@/components/spkl/spkl-route-skeletons";

export default function EditSpklLoading() {
  return <SpklFormShell mode="edit"><SpklFormDataSkeleton mode="edit" /></SpklFormShell>;
}
