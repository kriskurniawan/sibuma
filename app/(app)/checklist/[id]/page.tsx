import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { DataLoadError } from "@/components/data-load-error";
import { ChecklistDetailShell } from "@/components/checklist/checklist-detail-shell";
import { ChecklistDetailSkeleton } from "@/components/checklist/checklist-detail-skeleton";
import { ChecklistDetail } from "@/components/checklist/checklist-detail";
import { getCurrentUser } from "@/lib/auth";
import { listChecklistConditions } from "@/lib/checklist-conditions";
import { getChecklistInspectionDetail } from "@/lib/checklist-queries";
import { getPhotoLimits } from "@/lib/photo-limits";

export const metadata = {
  title: "Detail Checklist",
};

type PageProps = { params: Promise<{ id: string }> };

export default function ChecklistDetailPage({ params }: PageProps) {
  return (
    <ChecklistDetailShell>
      <Suspense fallback={<ChecklistDetailSkeleton />}>
        <ChecklistDetailData params={params} />
      </Suspense>
    </ChecklistDetailShell>
  );
}

async function ChecklistDetailData({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "super_admin") redirect("/");

  const { id } = await params;
  let result;
  try {
    result = await Promise.all([
      getChecklistInspectionDetail(user, id),
      listChecklistConditions({ includeInactive: true }),
      getPhotoLimits(),
    ]);
  } catch {
    return <DataLoadError message="Checklist gagal dimuat. Coba lagi." />;
  }
  const [detail, conditions, photoLimits] = result;
  if (!detail) notFound();

  return (
    <ChecklistDetail
      detail={detail}
      currentUserId={user.id}
      conditions={conditions}
      photoLimit={photoLimits.checklistPhotos}
      videoLimit={photoLimits.checklistVideos}
      videoMaxBytes={photoLimits.maxVideoBytes}
      videoEnabled={photoLimits.videoEnabled}
    />
  );
}
