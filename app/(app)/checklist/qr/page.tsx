import { redirect } from "next/navigation";
import { ChecklistQrView } from "@/components/checklist/qr-view";
import { getCurrentUser } from "@/lib/auth";
import { getChecklistQrSetup } from "@/lib/checklist-qr";

export const metadata = {
  title: "QR Area",
};

export default async function ChecklistQrPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fchecklist%2Fqr");
  if (user.role !== "atasan") redirect("/checklist");

  const setup = await getChecklistQrSetup(user.id);
  return <ChecklistQrView setup={setup} />;
}
