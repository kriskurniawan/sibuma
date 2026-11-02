import { DataLoadError } from "@/components/data-load-error";
import {
  ManualWorkListContent,
  ManualWorkListDescription,
  ManualWorkListFooter,
  ManualWorkSummary,
  ManualWorkSummaryError,
} from "@/components/pekerjaan/manual-work-list";
import { ManualWorkDynamicFilters } from "@/components/pekerjaan/manual-work-filters";
import { FramePanel } from "@/components/reui/frame";
import {
  getManualWorkFilterOptions,
  getManualWorks,
  getManualWorkTotals,
} from "@/lib/manual-work-queries";
import type { ManualWorkFilters } from "@/lib/manual-work-types";
import type { PageRequest } from "@/lib/pagination";
import { getPhotoLimits } from "@/lib/photo-limits";
import type { SessionUser } from "@/lib/types";

/** Only database work is caught here; authentication stays in the page. */
export async function loadManualWorkList(
  user: SessionUser,
  filters: Required<ManualWorkFilters>,
  request: PageRequest,
) {
  try {
    const [data, photoLimits] = await Promise.all([
      getManualWorks(user, filters, request),
      getPhotoLimits(),
    ]);
    return { data, photoLimit: photoLimits.workPhotos };
  } catch {
    return null;
  }
}

type ListPromise = ReturnType<typeof loadManualWorkList>;

export async function ManualWorkSummaryData({ user }: { user: SessionUser }) {
  let totals;
  try {
    totals = await getManualWorkTotals(user);
  } catch {
    return <ManualWorkSummaryError />;
  }
  return <ManualWorkSummary totals={totals} />;
}

export async function ManualWorkFilterOptionsData({ user }: { user: SessionUser }) {
  let options;
  try {
    options = await getManualWorkFilterOptions(user);
  } catch {
    return <ManualWorkDynamicFilters error user={user} />;
  }
  return <ManualWorkDynamicFilters divisions={options.divisions} workers={options.workers} user={user} />;
}

export async function ManualWorkListDescriptionData({
  result,
  filters,
}: {
  result: ListPromise;
  filters: Required<ManualWorkFilters>;
}) {
  const loaded = await result;
  return loaded ? (
    <ManualWorkListDescription total={loaded.data.total} totals={loaded.data.totals} filters={filters} />
  ) : "Jumlah pekerjaan belum tersedia.";
}

export async function ManualWorkListData({
  result,
  filters,
  user,
}: {
  result: ListPromise;
  filters: Required<ManualWorkFilters>;
  user: SessionUser;
}) {
  const loaded = await result;
  if (!loaded) {
    return <FramePanel><DataLoadError message="Daftar pekerjaan gagal dimuat." /></FramePanel>;
  }
  return <ManualWorkListContent items={loaded.data.items} filters={filters} photoLimit={loaded.photoLimit} user={user} />;
}

export async function ManualWorkListFooterData({ result }: { result: ListPromise }) {
  const loaded = await result;
  return loaded ? <ManualWorkListFooter total={loaded.data.total} pagination={loaded.data.pagination} /> : null;
}
