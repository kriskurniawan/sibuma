import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { DataLoadError } from "@/components/data-load-error";
import { SpklDesktopStatus, SpklDetailView } from "@/components/spkl/spkl-detail-view";
import { SpklBackLink, SpklDetailStatusSkeleton } from "@/components/spkl/spkl-route-shell";
import { SpklDetailDataSkeleton } from "@/components/spkl/spkl-route-skeletons";
import { Frame, FramePanel } from "@/components/reui/frame";
import { getCurrentUser } from "@/lib/auth";
import { getPhotoLimits } from "@/lib/photo-limits";
import { getPolicy, getSpklDetail } from "@/lib/queries";
import type { SessionUser } from "@/lib/types";

export const metadata = { title: "Detail SPKL" };

/** One finalized detail read shared by status and content within this render. */
async function loadDetail(user: SessionUser, params: Promise<{ id: string }>) {
  const { id } = await params;
  try {
    return { ok: true as const, data: await Promise.all([getSpklDetail(id, user), getPolicy(), getPhotoLimits()]) };
  } catch {
    return { ok: false as const };
  }
}
type DetailRequest = ReturnType<typeof loadDetail>;

export default async function SpklDetailPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const result = loadDetail(user, params);
  return (
    <div className="flex flex-col gap-5">
      <SpklBackLink>
        <Suspense fallback={<SpklDetailStatusSkeleton />}><SpklStatusData result={result} /></Suspense>
      </SpklBackLink>
      <Suspense fallback={<SpklDetailDataSkeleton />}>
        <SpklDetailData user={user} result={result} />
      </Suspense>
    </div>
  );
}

async function SpklStatusData({ result }: { result: DetailRequest }) {
  const loaded = await result;
  if (!loaded.ok || !loaded.data[0]) return null;
  return <SpklDesktopStatus detail={loaded.data[0]} />;
}

async function SpklDetailData({ user, result }: {
  user: SessionUser;
  result: DetailRequest;
}) {
  const loaded = await result;
  if (!loaded.ok) {
    return <Frame><FramePanel><DataLoadError message="Detail SPKL gagal dimuat." /></FramePanel></Frame>;
  }
  const [detail, policy, photoLimits] = loaded.data;
  if (!detail) notFound();
  return (
    <SpklDetailView
      hideDesktopHeader
      user={user}
      detail={detail}
      photoLimit={photoLimits.spklPhotos}
      videoLimit={photoLimits.spklVideos}
      videoMaxBytes={photoLimits.maxVideoBytes}
      videoEnabled={photoLimits.videoEnabled}
      policy={{ maxGpsAccuracyMeters: policy.maxGpsAccuracyMeters, docGraceMinutes: policy.docGraceMinutes }}
    />
  );
}
