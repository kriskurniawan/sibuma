"use client";

import { usePathname } from "next/navigation";
import { OperationalDashboardShell, OrganizationDashboardShell } from "@/components/dashboard/dashboard-shell";
import { useSessionUser } from "@/components/session-user-provider";
import { Frame, FramePanel } from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  const pathname = usePathname();
  const user = useSessionUser();

  // This boundary is inherited by nested routes until their scoped loading UI
  // arrives. Never show a dashboard while navigating to another page.
  if (pathname !== "/") {
    return (
      <div role="status" aria-busy="true" className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">Memuat halaman…</p>
        <Frame>
          <FramePanel className="flex flex-col gap-4">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </FramePanel>
        </Frame>
      </div>
    );
  }

  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat data beranda…</span>
      {user.role === "super_admin"
        ? <OrganizationDashboardShell user={user} />
        : <OperationalDashboardShell user={user} />}
    </div>
  );
}
