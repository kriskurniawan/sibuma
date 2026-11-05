import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ChecklistEquipmentShell } from "@/components/checklist/submenu-shells";
import { ChecklistSubmenuDataError } from "@/components/checklist/submenu-skeletons";
import { ChecklistEquipmentSkeleton } from "@/components/checklist/equipment-skeletons";
import { ChecklistEquipmentView } from "@/components/checklist/equipment-view";
import { getCurrentUser } from "@/lib/auth";
import { getChecklistEquipmentSetup } from "@/lib/checklist-equipment";

export const metadata = {
  title: "Peralatan",
};

async function EquipmentData({ ownerId }: { ownerId: string }) {
  try {
    const setup = await getChecklistEquipmentSetup(ownerId);
    return <ChecklistEquipmentView setup={setup} />;
  } catch {
    return (
      <ChecklistSubmenuDataError message="Peralatan gagal dimuat. Coba lagi." />
    );
  }
}

export default async function ChecklistEquipmentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "atasan") redirect("/checklist");

  return (
    <ChecklistEquipmentShell>
      <Suspense fallback={<ChecklistEquipmentSkeleton />}>
        <EquipmentData ownerId={user.id} />
      </Suspense>
    </ChecklistEquipmentShell>
  );
}
