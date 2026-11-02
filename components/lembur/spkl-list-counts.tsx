import "server-only";

import { Suspense } from "react";
import { SpklListCount, type SpklListCountSlots, type SpklListFilter } from "@/components/lembur/spkl-list-controls";
import { getSpklListItems } from "@/lib/spkl-list-queries";
import type { SessionUser } from "@/lib/types";

async function Count({ user, filter }: { user: SessionUser; filter: SpklListFilter }) {
  let value: number;
  try {
    const items = await getSpklListItems(user);
    value = filter === "semua" ? items.length : items.filter((item) => item.status === filter).length;
  } catch {
    return <SpklListCount error />;
  }
  return <SpklListCount value={value} />;
}

/** Each number streams in its own slot; cached list reads share one promise. */
export function spklListCountSlots(user: SessionUser): SpklListCountSlots {
  const slot = (filter: SpklListFilter) => (
    <Suspense fallback={<SpklListCount />}>
      <Count user={user} filter={filter} />
    </Suspense>
  );
  return {
    semua: slot("semua"),
    berlangsung: slot("berlangsung"),
    terjadwal: slot("terjadwal"),
    selesai: slot("selesai"),
    dibatalkan: slot("dibatalkan"),
  };
}
