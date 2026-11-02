import { Suspense } from "react";
import { redirect } from "next/navigation";
import { HistorySummary } from "@/components/history/history-summary";
import { HistoryPageShell, HistoryRows, HistoryView } from "@/components/history/history-view";
import { spklListCountSlots } from "@/components/lembur/spkl-list-counts";
import { getCurrentUser } from "@/lib/auth";
import {
  getSpklListItems,
  getWorkerHistorySummary,
  type WorkerHistorySummary,
} from "@/lib/spkl-list-queries";
import type { SessionUser, SpklListItem } from "@/lib/types";

export const metadata = {
  title: "Lembur",
};

async function HistoryList({ user }: { user: SessionUser }) {
  let items: SpklListItem[];
  try {
    items = await getSpklListItems(user);
  } catch {
    return <HistoryRows error />;
  }
  return <HistoryRows items={items} />;
}

async function Summary({ user }: { user: SessionUser }) {
  let summary: WorkerHistorySummary;
  try {
    summary = await getWorkerHistorySummary(user);
  } catch {
    return <HistorySummary error />;
  }
  return <HistorySummary summary={summary} />;
}

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "pekerja") redirect("/laporan");

  return (
    <HistoryPageShell
      summary={<Suspense fallback={<HistorySummary />}><Summary user={user} /></Suspense>}
    >
      <HistoryView counts={spklListCountSlots(user)}>
        <Suspense fallback={<HistoryRows />}>
          <HistoryList user={user} />
        </Suspense>
      </HistoryView>
    </HistoryPageShell>
  );
}
