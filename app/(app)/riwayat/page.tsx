import { redirect } from "next/navigation";
import { HistoryView } from "@/components/history/history-view";
import { getCurrentUser } from "@/lib/auth";
import { getWorkerOverview } from "@/lib/queries";

export const metadata = {
  title: "Riwayat lembur",
};

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "pekerja") redirect("/laporan");

  const overview = await getWorkerOverview(user);
  return <HistoryView overview={overview} />;
}
