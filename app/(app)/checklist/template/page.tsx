import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ChecklistTemplateShell } from "@/components/checklist/submenu-shells";
import { ChecklistSubmenuDataError, ChecklistTemplateDataSkeleton } from "@/components/checklist/submenu-skeletons";
import { ChecklistTemplateView } from "@/components/checklist/template-view";
import { isReadOnly } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { getChecklistSetup } from "@/lib/checklist-queries";

export const metadata = {
  title: "Template Checklist",
};

async function TemplateData({ ownerId }: { ownerId: string }) {
  try {
    const setup = await getChecklistSetup(ownerId);
    return <ChecklistTemplateView setup={setup} />;
  } catch {
    return <ChecklistSubmenuDataError message="Template dan lokasi gagal dimuat. Coba lagi." />;
  }
}

export default async function ChecklistTemplatePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "atasan") redirect("/checklist");
  if (isReadOnly(user)) redirect("/checklist");

  return (
    <ChecklistTemplateShell>
      <Suspense fallback={<ChecklistTemplateDataSkeleton />}>
        <TemplateData ownerId={user.id} />
      </Suspense>
    </ChecklistTemplateShell>
  );
}
