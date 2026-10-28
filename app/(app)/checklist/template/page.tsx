import { redirect } from "next/navigation";
import { ChecklistTemplateView } from "@/components/checklist/template-view";
import { getCurrentUser } from "@/lib/auth";
import { getChecklistSetup } from "@/lib/checklist-queries";

export const metadata = {
  title: "Template Checklist",
};

export default async function ChecklistTemplatePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "atasan") redirect("/checklist");

  const setup = await getChecklistSetup(user.id);

  return <ChecklistTemplateView setup={setup} />;
}
