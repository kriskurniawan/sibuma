import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DataLoadError } from "@/components/data-load-error";
import { ManualWorkForm } from "@/components/pekerjaan/manual-work-form";
import { ManualWorkFormSkeleton } from "@/components/pekerjaan/manual-work-form-skeleton";
import { ManualWorkFormShell } from "@/components/pekerjaan/manual-work-page-shell";
import { isReadOnly } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { getManualWorkFormData } from "@/lib/manual-work-queries";
import { todayLocal } from "@/lib/time";

export const metadata = { title: "Catat Pekerjaan Harian" };

export default function NewManualWorkPage() {
  return (
    <ManualWorkFormShell mode="create">
      <Suspense fallback={<ManualWorkFormSkeleton />}>
        <NewManualWorkData />
      </Suspense>
    </ManualWorkFormShell>
  );
}

async function NewManualWorkData() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "super_admin") redirect("/");
  if (isReadOnly(user)) redirect("/pekerjaan");

  let data;
  try {
    data = await getManualWorkFormData(user);
  } catch {
    return <DataLoadError message="Formulir pekerjaan gagal dimuat. Coba lagi." />;
  }

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
