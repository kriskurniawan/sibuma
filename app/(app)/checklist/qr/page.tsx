import { redirect } from "next/navigation";
import { ChecklistQrView } from "@/components/checklist/qr-view";
import { isReadOnly } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { getChecklistQrSetup } from "@/lib/checklist-qr";

export const metadata = {
  title: "QR Area",
};

export default async function ChecklistQrPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fchecklist%2Fqr");
  if (user.role !== "atasan") redirect("/checklist");

  // QR area satu-satunya aksi tulis yang tetap tersedia bagi atasan pengamat;
  // QR yang dibuatnya mencakup seluruh area publik perusahaan.
  const setup = await getChecklistQrSetup(user);
  return <ChecklistQrView setup={setup} readOnly={isReadOnly(user)} />;
}
