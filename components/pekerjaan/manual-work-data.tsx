import {
  ManualWorkListFrame,
  ManualWorkSummary,
} from "@/components/pekerjaan/manual-work-list";
import {
  getManualWorkFilterOptions,
  getManualWorks,
  getManualWorkTotals,
} from "@/lib/manual-work-queries";
import type { ManualWorkFilters } from "@/lib/manual-work-types";
import type { PageRequest } from "@/lib/pagination";
import { getPhotoLimits } from "@/lib/photo-limits";
import type { SessionUser } from "@/lib/types";

export async function ManualWorkSummaryData({ user }: { user: SessionUser }) {
  const totals = await getManualWorkTotals(user);
  return <ManualWorkSummary totals={totals} />;
}

export async function ManualWorkListData({
  user,
  filters,
  request,
  canManage,
  canAssign,
  readOnly,
}: {
  user: SessionUser;
  filters: Required<ManualWorkFilters>;
  request: PageRequest;
  canManage: boolean;
  canAssign: boolean;
  readOnly: boolean;
}) {
  const [data, filterOptions, photoLimits] = await Promise.all([
    getManualWorks(user, filters, request),
    getManualWorkFilterOptions(user),
    getPhotoLimits(),
  ]);

  return (
    <ManualWorkListFrame
      items={data.items}
      total={data.total}
      totals={data.totals}
      pagination={data.pagination}
      filters={filters}
      filterOptions={filterOptions}
      canManage={canManage}
      canAssign={canAssign}
      readOnly={readOnly}
      photoLimit={photoLimits.workPhotos}
    />
  );
}
