import { notFound, redirect } from "next/navigation";
import { ManualWorkDetailView } from "@/components/pekerjaan/manual-work-detail";
import { getCurrentUser } from "@/lib/auth";
import { getManualWorkDetail } from "@/lib/manual-work-queries";

export const metadata = { title: "Detail Pekerjaan" };

export default async function ManualWorkDetailPage({
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

  return <ManualWorkDetailView detail={detail} />;
}
