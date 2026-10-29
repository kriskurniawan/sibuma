import { notFound, redirect } from "next/navigation";
import { ManualWorkForm } from "@/components/pekerjaan/manual-work-form";
import { getCurrentUser } from "@/lib/auth";
import {
  getManualWorkDetail,
  getManualWorkFormData,
} from "@/lib/manual-work-queries";
import { todayLocal } from "@/lib/time";

export const metadata = { title: "Ubah Pekerjaan Harian" };

export default async function EditManualWorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "super_admin") redirect("/");

  const { id } = await params;
  const detail = await getManualWorkDetail(user, id);
  if (!detail) notFound();
  if (!detail.canEdit) redirect(`/pekerjaan/${id}`);

  const data = await getManualWorkFormData(user, id);

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
