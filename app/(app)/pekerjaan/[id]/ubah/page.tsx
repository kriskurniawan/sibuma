import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { DataLoadError } from "@/components/data-load-error";
import { ManualWorkForm } from "@/components/pekerjaan/manual-work-form";
import { ManualWorkFormSkeleton } from "@/components/pekerjaan/manual-work-form-skeleton";
import { ManualWorkFormShell } from "@/components/pekerjaan/manual-work-page-shell";
import { getCurrentUser } from "@/lib/auth";
import { getManualWorkDetail, getManualWorkFormData } from "@/lib/manual-work-queries";
import { todayLocal } from "@/lib/time";

export const metadata = { title: "Ubah Pekerjaan Harian" };

type PageProps = { params: Promise<{ id: string }> };

export default function EditManualWorkPage({ params }: PageProps) {
  return (
    <ManualWorkFormShell mode="edit">
      <Suspense fallback={<ManualWorkFormSkeleton mode="edit" />}>
        <EditManualWorkData params={params} />
      </Suspense>
    </ManualWorkFormShell>
  );
}

async function EditManualWorkData({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "super_admin") redirect("/");

  const { id } = await params;
  let detail;
  try {
    detail = await getManualWorkDetail(user, id);
  } catch {
    return <DataLoadError message="Detail pekerjaan gagal dimuat. Coba lagi." />;
  }
  if (!detail) notFound();
  if (!detail.canEdit) redirect(`/pekerjaan/${id}`);

  let data;
  try {
    data = await getManualWorkFormData(user, id);
  } catch {
    return <DataLoadError message="Formulir pekerjaan gagal dimuat. Coba lagi." />;
  }

  return (
    <ManualWorkForm
      mode="edit"
      team={data.team}
      followUps={data.followUps}
      locations={data.locations}
      defaultDate={todayLocal()}
      initial={detail.work}
      initialAssigneeIds={detail.assignees.map((person) => person.id)}
      canAssign={user.role === "atasan"}
      self={{
        id: user.id,
        name: user.name,
        nik: user.nik,
        supervisorName: user.supervisorName,
      }}
    />
  );
}
