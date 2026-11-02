import { HistorySummary } from "@/components/history/history-summary";
import { HistoryPageShell, HistoryRows, HistoryView } from "@/components/history/history-view";

export default function RiwayatLoading() {
  return (
    <HistoryPageShell summary={<HistorySummary />}>
      <HistoryView>
        <HistoryRows />
      </HistoryView>
    </HistoryPageShell>
  );
}
