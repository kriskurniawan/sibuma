import { notFound, redirect } from "next/navigation";
import { ChecklistTemplateDetailView } from "@/components/checklist/template-detail-view";
import { getCurrentUser } from "@/lib/auth";
import { getChecklistTemplateDetail } from "@/lib/checklist-queries";

export const metadata = {
  title: "Detail Template Checklist",
};

export default async function ChecklistTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "atasan") redirect("/checklist");

  const { id } = await params;
  const detail = await getChecklistTemplateDetail(user.id, id);
  if (!detail) notFound();

  return (
    <ChecklistTemplateDetailView
      template={detail.template}
      versions={detail.versions}
    />
  );
}
