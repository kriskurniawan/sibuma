import { redirect } from "next/navigation";
import { ChecklistScheduleView } from "@/components/checklist/schedule-view";
import { getCurrentUser } from "@/lib/auth";
import { getChecklistSetup } from "@/lib/checklist-queries";

export const metadata = {
  title: "Jadwal Checklist",
};

export default async function ChecklistSchedulePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "atasan") redirect("/checklist");

  const setup = await getChecklistSetup(user.id);

  return <ChecklistScheduleView setup={setup} />;
}
