import { SpklBackLink, SpklDetailStatusSkeleton } from "@/components/spkl/spkl-route-shell";
import { SpklDetailDataSkeleton } from "@/components/spkl/spkl-route-skeletons";

export default function SpklDetailLoading() {
  return (
    <div className="flex flex-col gap-5">
      <SpklBackLink><SpklDetailStatusSkeleton /></SpklBackLink>
      <SpklDetailDataSkeleton />
    </div>
  );
}
