import "server-only";

import { Suspense, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { DataLoadError } from "@/components/data-load-error";
import type { getChecklistDashboard, getChecklistFollowUps } from "@/lib/checklist-queries";
import type { getManualWorkDashboard } from "@/lib/manual-work-queries";

export type DashboardResult<T> = { ok: true; data: T } | { ok: false };
export type DashboardRequest<T> = Promise<DashboardResult<T>>;
export type DashboardChecklists = Awaited<ReturnType<typeof getChecklistDashboard>>;
export type DashboardFollowUps = Awaited<ReturnType<typeof getChecklistFollowUps>>;
export type DashboardManualWorks = Awaited<ReturnType<typeof getManualWorkDashboard>>;

/** Start each query once, then share its settled result across dashboard regions. */
export async function dashboardQuery<T>(query: () => Promise<T>): DashboardRequest<T> {
  try {
    return { ok: true, data: await query() };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Dashboard data could not be loaded", error);
    return { ok: false };
  }
}

async function DashboardData<T>({
  data,
  children,
  message,
}: {
  data: DashboardRequest<T>;
  children: (value: T) => ReactNode;
  message?: string;
}) {
  const result = await data;
  if (!result.ok) {
    return <div className="col-span-full"><DataLoadError message={message} /></div>;
  }
  return children(result.data);
}

export function DashboardRegion<T>({
  data,
  fallback,
  children,
  message,
}: {
  data: DashboardRequest<T>;
  fallback: ReactNode;
  children: (value: T) => ReactNode;
  message?: string;
}) {
  return (
    <Suspense fallback={fallback}>
      <DashboardData data={data} message={message}>{children}</DashboardData>
    </Suspense>
  );
}

async function DashboardValueData<T>({
  data,
  children,
  unavailable,
}: {
  data: DashboardRequest<T>;
  children: (value: T) => ReactNode;
  unavailable: ReactNode;
}) {
  const result = await data;
  return result.ok ? children(result.data) : unavailable;
}

/** Secondary counts never hold the panel title or its main content behind data. */
export function DashboardValue<T>({
  data,
  children,
  fallback,
  unavailable = "Ringkasan belum tersedia",
}: {
  data: DashboardRequest<T>;
  children: (value: T) => ReactNode;
  fallback: ReactNode;
  unavailable?: ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      <DashboardValueData data={data} unavailable={unavailable}>{children}</DashboardValueData>
    </Suspense>
  );
}
