import { redirect } from "next/navigation";
import { ManualWorkListView } from "@/components/pekerjaan/manual-work-list";
import { isReadOnly } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import {
  getManualWorkFilterOptions,
  getManualWorks,
} from "@/lib/manual-work-queries";
import { pageRequest } from "@/lib/pagination";
import { getPhotoLimits } from "@/lib/photo-limits";

export const metadata = { title: "Pekerjaan Harian" };

const STATUS_VALUES = new Set([
  "aktif",
  "terlambat",
  "belum_mulai",
  "terbuka",
  "dikerjakan",
  "selesai",
  "dibatalkan",
  "semua",
]);

export default async function ManualWorkPage({
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
  const requestedStatus = first(params.status);
  const requestedDivision = first(params.divisionId);
  const requestedEmployee = first(params.employeeId);
  const filters = {
    status:
      requestedStatus && STATUS_VALUES.has(requestedStatus)
        ? requestedStatus
        : "aktif",
    search: first(params.search) ?? "",
    divisionId:
      requestedDivision && requestedDivision !== "semua"
        ? requestedDivision
        : "",
    employeeId:
      requestedEmployee && requestedEmployee !== "semua"
        ? requestedEmployee
        : "",
  };
  const request = pageRequest(first(params.page), first(params.size));
  const [data, filterOptions, photoLimits] = await Promise.all([
    getManualWorks(user, filters, request),
    getManualWorkFilterOptions(user),
    getPhotoLimits(),
  ]);

  return (
    <ManualWorkListView
      items={data.items}
      total={data.total}
      totals={data.totals}
      pagination={data.pagination}
      filters={filters}
      filterOptions={filterOptions}
      canManage={!isReadOnly(user)}
      canAssign={user.role === "atasan"}
      readOnly={isReadOnly(user)}
      photoLimit={photoLimits.workPhotos}
    />
  );
}
