import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ChecklistScheduleView } from "@/components/checklist/schedule-view";
import { ChecklistScheduleShell } from "@/components/checklist/submenu-shells";
import { ChecklistScheduleDataSkeleton, ChecklistSubmenuDataError } from "@/components/checklist/submenu-skeletons";
import { isReadOnly } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { getChecklistSetup } from "@/lib/checklist-queries";

export const metadata = {
  title: "Jadwal Checklist",
};

async function ScheduleData({ ownerId }: { ownerId: string }) {
  try {
    const setup = await getChecklistSetup(ownerId);
    return <ChecklistScheduleView setup={setup} />;
  } catch {
    return <ChecklistSubmenuDataError message="Jadwal checklist gagal dimuat. Coba lagi." />;
  }
}

export default async function ChecklistSchedulePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "atasan") redirect("/checklist");
  if (isReadOnly(user)) redirect("/checklist");

  return (
    <ChecklistScheduleShell>
      <Suspense fallback={<ChecklistScheduleDataSkeleton />}>
        <ScheduleData ownerId={user.id} />
      </Suspense>
    </ChecklistScheduleShell>
  );
}
