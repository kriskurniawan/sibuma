import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { MobileFab } from "@/components/mobile-fab";
import {
  ManualWorkListData,
  ManualWorkSummaryData,
} from "@/components/pekerjaan/manual-work-data";
import {
  ManualWorkListSkeleton,
  ManualWorkSummarySkeleton,
} from "@/components/pekerjaan/manual-work-skeletons";
import { PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { isReadOnly } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { pageRequest } from "@/lib/pagination";

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
        : "semua",
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
  const readOnly = isReadOnly(user);
  const canManage = !readOnly;
  const canAssign = user.role === "atasan";

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader
        mobileCompact
        eyebrow="Pekerjaan harian"
        title="Pekerjaan Harian"
        description={
          canAssign
            ? "Pekerjaan harian dengan dokumentasi foto dan video. Satu pekerjaan boleh berlangsung beberapa hari."
            : "Pekerjaan lintas divisi dengan dokumentasi foto dan video. Pekerjaan yang kamu catat langsung aktif."
        }
        action={
          canManage ? (
            <div className="hidden md:block">
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href="/pekerjaan/baru" />}
              >
                <Plus aria-hidden="true" />
                {canAssign ? "Buat pekerjaan" : "Catat pekerjaan"}
              </Button>
            </div>
          ) : undefined
        }
      />

      <Suspense fallback={<ManualWorkSummarySkeleton />}>
        <ManualWorkSummaryData user={user} />
      </Suspense>

      <Suspense fallback={<ManualWorkListSkeleton />}>
        <ManualWorkListData
          user={user}
          filters={filters}
          request={request}
          canManage={canManage}
          canAssign={canAssign}
          readOnly={readOnly}
        />
      </Suspense>

      {canManage && (
        <MobileFab href="/pekerjaan/baru">
          <Plus aria-hidden="true" />
          {canAssign ? "Buat pekerjaan" : "Catat pekerjaan"}
        </MobileFab>
      )}
    </div>
  );
}
