import { notFound, redirect } from "next/navigation";
import { ChecklistDetail } from "@/components/checklist/checklist-detail";
import { getCurrentUser } from "@/lib/auth";
import { listChecklistConditions } from "@/lib/checklist-conditions";
import { getChecklistInspectionDetail } from "@/lib/checklist-queries";

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
  const [detail, conditions] = await Promise.all([
    getChecklistInspectionDetail(user, id),
    listChecklistConditions({ includeInactive: true }),
  ]);
  if (!detail) notFound();

  return (
    <ChecklistDetail
      detail={detail}
      currentUserId={user.id}
      conditions={conditions}
    />
  );
}
