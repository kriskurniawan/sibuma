import { notFound, redirect } from "next/navigation";
import { ChecklistDetail } from "@/components/checklist/checklist-detail";
import { getCurrentUser } from "@/lib/auth";
import { listChecklistConditions } from "@/lib/checklist-conditions";
import { getChecklistInspectionDetail } from "@/lib/checklist-queries";
import { getPhotoLimits } from "@/lib/photo-limits";

export const metadata = {
  title: "Detail Checklist",
};

export default async function ChecklistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "super_admin") redirect("/");

  const { id } = await params;
  const [detail, conditions, photoLimits] = await Promise.all([
    getChecklistInspectionDetail(user, id),
    listChecklistConditions({ includeInactive: true }),
    getPhotoLimits(),
  ]);
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
