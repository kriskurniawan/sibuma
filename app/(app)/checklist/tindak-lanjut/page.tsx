import { cache, Suspense } from "react";
import { redirect } from "next/navigation";
import { ChecklistFollowUpSummary, ChecklistFollowUpView } from "@/components/checklist/follow-up-view";
import { ChecklistFollowUpShell } from "@/components/checklist/submenu-shells";
import { ChecklistFollowUpDataSkeleton, ChecklistFollowUpSummarySkeleton, ChecklistSubmenuDataError } from "@/components/checklist/submenu-skeletons";
import { DataLoadError } from "@/components/data-load-error";
import { isReadOnly } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { getChecklistFollowUps } from "@/lib/checklist-queries";
import { pageRequest, type PageRequest } from "@/lib/pagination";
import type { SessionUser } from "@/lib/types";

export const metadata = {
  title: "Tindak Lanjut Checklist",
};

type FollowUpFilters = { status: string; search: string; mine: boolean };
type DataProps = { user: SessionUser; filters: FollowUpFilters; request: PageRequest };

// Both independently streamed regions share one request-scoped query. It is
// started only when a data region renders, after server authorization.
const loadFollowUps = cache(async (user: SessionUser, filters: FollowUpFilters, request: PageRequest) => {
  try {
    return await getChecklistFollowUps(user, filters, request);
  } catch {
    return null;
  }
});

async function FollowUpSummary({ user, filters, request }: DataProps) {
  const data = await loadFollowUps(user, filters, request);
  if (!data) return <ChecklistSubmenuDataError message="Ringkasan tindak lanjut gagal dimuat. Coba lagi." />;
  return <ChecklistFollowUpSummary totals={data.totals} />;
}

async function FollowUpData({ user, filters, request }: DataProps) {
  const data = await loadFollowUps(user, filters, request);
  if (!data) return <div className="p-4"><DataLoadError message="Daftar tindak lanjut gagal dimuat. Coba lagi." /></div>;
  return (
    <ChecklistFollowUpView
      items={data.items}
      total={data.total}
      pagination={data.pagination ?? request}
      filters={filters}
      canEdit={!isReadOnly(user)}
    />
  );
}

export default async function ChecklistFollowUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "super_admin") redirect("/");

  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const filters = {
    status: first(params.status) ?? "aktif",
    search: first(params.search) ?? "",
    mine: first(params.mine) === "1",
  };
  const request = pageRequest(first(params.page), first(params.size));
  const boundaryKey = JSON.stringify([filters, request]);

  return (
    <ChecklistFollowUpShell
      filters={filters}
      summary={
        <Suspense key={boundaryKey} fallback={<ChecklistFollowUpSummarySkeleton />}>
          <FollowUpSummary user={user} filters={filters} request={request} />
        </Suspense>
      }
    >
      <Suspense key={boundaryKey} fallback={<ChecklistFollowUpDataSkeleton />}>
        <FollowUpData user={user} filters={filters} request={request} />
      </Suspense>
    </ChecklistFollowUpShell>
  );
}
