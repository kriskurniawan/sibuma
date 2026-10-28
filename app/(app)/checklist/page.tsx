import { redirect } from "next/navigation";
import { ChecklistView } from "@/components/checklist/checklist-view";
import { getCurrentUser } from "@/lib/auth";
import {
  getChecklistDashboard,
  getChecklistLocations,
} from "@/lib/checklist-queries";
import { pageRequest } from "@/lib/pagination";

export const metadata = { title: "Checklist" };

export default async function ChecklistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const status = first(params.status) ?? "aktif";
  const filters = {
    status,
    locationId: first(params.locationId) ?? "",
    search: first(params.search) ?? "",
  };
  const request = pageRequest(first(params.page), first(params.size));
  const ownerId = user.role === "atasan" ? user.id : user.supervisorId;
  const [data, locations] = await Promise.all([
    getChecklistDashboard(user, filters, request),
    getChecklistLocations(ownerId),
  ]);

  return (
    <ChecklistView
      items={data.items}
      total={data.total}
      pagination={data.pagination ?? request}
      totals={data.totals}
      filters={filters}
      locations={locations}
      canManage={user.role === "atasan"}
    />
  );
}
