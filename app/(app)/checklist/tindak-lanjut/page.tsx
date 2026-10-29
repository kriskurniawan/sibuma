import { redirect } from "next/navigation";
import { ChecklistFollowUpView } from "@/components/checklist/follow-up-view";
import { getCurrentUser } from "@/lib/auth";
import { getChecklistFollowUps } from "@/lib/checklist-queries";
import { pageRequest } from "@/lib/pagination";

export const metadata = {
  title: "Tindak Lanjut Checklist",
};

export default async function ChecklistFollowUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "super_admin") redirect("/");

  const params = await searchParams;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const filters = {
    status: first(params.status) ?? "aktif",
    search: first(params.search) ?? "",
    mine: first(params.mine) === "1",
  };
  const request = pageRequest(first(params.page), first(params.size));
  const data = await getChecklistFollowUps(user, filters, request);

  return (
    <ChecklistFollowUpView
      items={data.items}
      total={data.total}
      pagination={data.pagination ?? request}
      totals={data.totals}
      filters={filters}
    />
  );
}
