import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { DataLoadError } from "@/components/data-load-error";
import { ChecklistEquipmentDetailShell } from "@/components/checklist/checklist-detail-shell";
import { ChecklistEquipmentDetailSkeleton } from "@/components/checklist/equipment-skeletons";
import { ChecklistEquipmentDetailView } from "@/components/checklist/equipment-detail-view";
import { getCurrentUser } from "@/lib/auth";
import { checklistReadOwner } from "@/lib/checklist-access";
import { getChecklistEquipmentDetail } from "@/lib/checklist-equipment";

export const metadata = {
  title: "Detail Peralatan",
};

type PageProps = { params: Promise<{ id: string }> };

export default function ChecklistEquipmentDetailPage({ params }: PageProps) {
  return (
    <ChecklistEquipmentDetailShell>
      <Suspense fallback={<ChecklistEquipmentDetailSkeleton />}>
        <EquipmentDetailData params={params} />
      </Suspense>
    </ChecklistEquipmentDetailShell>
  );
}

async function EquipmentDetailData({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "pekerja" && user.role !== "atasan") {
    redirect("/checklist");
  }
  const ownerId = checklistReadOwner(user);
  // Pekerja tanpa atasan tidak punya cakupan tim; jangan jatuh ke "semua data".
  if (user.role === "pekerja" && !ownerId) redirect("/checklist");

  const { id } = await params;
  let detail;
  try {
    detail = await getChecklistEquipmentDetail(ownerId, id);
  } catch {
    return (
      <DataLoadError message="Detail peralatan gagal dimuat. Coba lagi." />
    );
  }
  if (!detail) notFound();

  return <ChecklistEquipmentDetailView detail={detail} />;
}
