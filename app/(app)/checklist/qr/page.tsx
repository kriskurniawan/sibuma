import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ChecklistQrView } from "@/components/checklist/qr-view";
import { ChecklistQrShell } from "@/components/checklist/submenu-shells";
import { ChecklistQrDataSkeleton, ChecklistSubmenuDataError } from "@/components/checklist/submenu-skeletons";
import { getCurrentUser } from "@/lib/auth";
import { getChecklistQrSetup } from "@/lib/checklist-qr";
import type { SessionUser } from "@/lib/types";

export const metadata = {
  title: "QR Area",
};

async function QrData({ user }: { user: SessionUser }) {
  try {
    const setup = await getChecklistQrSetup(user);
    return <ChecklistQrView setup={setup} />;
  } catch {
    return <ChecklistSubmenuDataError message="QR area gagal dimuat. Coba lagi." />;
  }
}

export default async function ChecklistQrPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fchecklist%2Fqr");
  if (user.role !== "atasan") redirect("/checklist");

  // QR area tetap tersedia bagi atasan pengamat. Query menerapkan cakupan
  // seluruh area publik perusahaan untuk akun tersebut.
  return (
    <ChecklistQrShell>
      <Suspense fallback={<ChecklistQrDataSkeleton />}>
        <QrData user={user} />
      </Suspense>
    </ChecklistQrShell>
  );
}
