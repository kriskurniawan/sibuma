import { redirect } from "next/navigation";
import { LemburView } from "@/components/lembur/lembur-view";
import { isReadOnly } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { getSupervisorOverview } from "@/lib/queries";

export const metadata = {
  title: "Lembur",
};

export default async function LemburPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "atasan") redirect("/");

  const overview = await getSupervisorOverview(user);
  return <LemburView items={overview.items} readOnly={isReadOnly(user)} />;
}
