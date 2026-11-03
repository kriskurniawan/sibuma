import { redirect } from "next/navigation";
import { DailyReportView } from "@/components/reports/daily-report-view";
import { getCurrentUser } from "@/lib/auth";
import {
  getDailyReport,
  normalizeReportDate,
  normalizeReportSeed,
} from "@/lib/daily-report";

export const metadata = { title: "Laporan harian" };

export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "super_admin") redirect("/laporan");

  const params = await searchParams;
  const date = normalizeReportDate(params.tanggal);
  const seed = normalizeReportSeed(params.seed);
  const data = await getDailyReport(user, date, seed);

  return (
    <DailyReportView
      key={`${data.date}:${data.seed}`}
      data={data}
    />
  );
}
