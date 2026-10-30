import { notFound, redirect } from "next/navigation";
import { SpklDetailView } from "@/components/spkl/spkl-detail-view";
import { getCurrentUser } from "@/lib/auth";
import { getPhotoLimits } from "@/lib/photo-limits";
import { getPolicy, getSpklDetail } from "@/lib/queries";

export const metadata = {
  title: "Detail SPKL",
};

export default async function SpklDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const [detail, policy, photoLimits] = await Promise.all([
    getSpklDetail(id, user),
    getPolicy(),
    getPhotoLimits(),
  ]);
  if (!detail) notFound();

  return (
    <SpklDetailView
      user={user}
      detail={detail}
      photoLimit={photoLimits.spklPhotos}
      videoLimit={photoLimits.spklVideos}
      videoMaxBytes={photoLimits.maxVideoBytes}
      videoEnabled={photoLimits.videoEnabled}
      policy={{
        maxGpsAccuracyMeters: policy.maxGpsAccuracyMeters,
        docGraceMinutes: policy.docGraceMinutes,
        roundingMinutes: policy.roundingMinutes,
      }}
    />
  );
}
