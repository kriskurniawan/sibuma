import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { DataLoadError } from "@/components/data-load-error";
import { ManualWorkDetailView } from "@/components/pekerjaan/manual-work-detail";
import { ManualWorkDetailSkeleton } from "@/components/pekerjaan/manual-work-detail-skeleton";
import { ManualWorkDetailShell } from "@/components/pekerjaan/manual-work-page-shell";
import { getCurrentUser } from "@/lib/auth";
import { getManualWorkDetail } from "@/lib/manual-work-queries";
import { getPhotoLimits } from "@/lib/photo-limits";

export const metadata = { title: "Detail Pekerjaan" };

type PageProps = { params: Promise<{ id: string }> };

export default function ManualWorkDetailPage({ params }: PageProps) {
  return (
    <ManualWorkDetailShell>
      <Suspense fallback={<ManualWorkDetailSkeleton />}>
        <ManualWorkDetailData params={params} />
      </Suspense>
    </ManualWorkDetailShell>
  );
}

async function ManualWorkDetailData({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "super_admin") redirect("/");

  const { id } = await params;
  let result;
  try {
    result = await Promise.all([getManualWorkDetail(user, id), getPhotoLimits()]);
  } catch {
    return <DataLoadError message="Detail pekerjaan gagal dimuat. Coba lagi." />;
  }
  const [detail, photoLimits] = result;
  if (!detail) notFound();

  return (
    <ManualWorkDetailView
      detail={detail}
      photoLimit={photoLimits.workPhotos}
      videoLimit={photoLimits.workVideos}
      videoMaxBytes={photoLimits.maxVideoBytes}
      videoEnabled={photoLimits.videoEnabled}
    />
  );
}
