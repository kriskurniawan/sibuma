import { notFound, redirect } from "next/navigation";
import { ChecklistDetail } from "@/components/checklist/checklist-detail";
import { getCurrentUser } from "@/lib/auth";
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

  const { id } = await params;
  const detail = await getChecklistInspectionDetail(user, id);
  if (!detail) notFound();

  return <ChecklistDetail detail={detail} currentUserId={user.id} />;
}
