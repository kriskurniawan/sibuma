import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { DataLoadError } from "@/components/data-load-error";
import { ChecklistTemplateDetailShell } from "@/components/checklist/checklist-detail-shell";
import { ChecklistTemplateDetailSkeleton } from "@/components/checklist/checklist-detail-skeleton";
import { ChecklistTemplateDetailView } from "@/components/checklist/template-detail-view";
import { isReadOnly } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { getChecklistTemplateDetail } from "@/lib/checklist-queries";

export const metadata = {
  title: "Detail Template Checklist",
};

type PageProps = { params: Promise<{ id: string }> };

export default function ChecklistTemplateDetailPage({ params }: PageProps) {
  return (
    <ChecklistTemplateDetailShell>
      <Suspense fallback={<ChecklistTemplateDetailSkeleton />}>
        <ChecklistTemplateDetailData params={params} />
      </Suspense>
    </ChecklistTemplateDetailShell>
  );
}

async function ChecklistTemplateDetailData({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "atasan") redirect("/checklist");
  if (isReadOnly(user)) redirect("/checklist");

  const { id } = await params;
  let detail;
  try {
    detail = await getChecklistTemplateDetail(user.id, id);
  } catch {
    return <DataLoadError message="Template checklist gagal dimuat. Coba lagi." />;
  }
  if (!detail) notFound();

  return (
    <ChecklistTemplateDetailView
      template={detail.template}
      usage={detail.usage}
      versions={detail.versions}
      locations={detail.locations}
    />
  );
}
