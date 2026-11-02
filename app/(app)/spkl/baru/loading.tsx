import { SpklFormShell } from "@/components/spkl/spkl-route-shell";
import { SpklFormDataSkeleton } from "@/components/spkl/spkl-route-skeletons";

export default function CreateSpklLoading() {
  return <SpklFormShell mode="create"><SpklFormDataSkeleton /></SpklFormShell>;
}
