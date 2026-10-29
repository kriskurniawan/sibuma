import { redirect } from "next/navigation";
import { ManualWorkForm } from "@/components/pekerjaan/manual-work-form";
import { isReadOnly } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { getManualWorkFormData } from "@/lib/manual-work-queries";
import { todayLocal } from "@/lib/time";

export const metadata = { title: "Catat Pekerjaan Harian" };

export default async function NewManualWorkPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "super_admin") redirect("/");
  if (isReadOnly(user)) redirect("/pekerjaan");

  const data = await getManualWorkFormData(user);

  return (
    <ManualWorkForm
      mode="create"
      team={data.team}
      followUps={data.followUps}
      locations={data.locations}
      defaultDate={todayLocal()}
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
