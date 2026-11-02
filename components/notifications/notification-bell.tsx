"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/reui/badge";
import { Button } from "@/components/ui/button";
import { NOTIFICATION_CHANGED_EVENT } from "@/lib/notification-types";

export function NotificationBell({
  initialUnreadCount,
}: {
  initialUnreadCount: number;
}) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/notifikasi?count=1", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { unreadCount?: number };
        if (!cancelled && typeof data.unreadCount === "number") {
          setUnreadCount(data.unreadCount);
        }
      } catch {
        // Lencana bukan data kritis; pertahankan angka terakhir.
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible") void load();
    }

    function onChanged() {
      void load();
    }

    function onWorkerMessage(event: MessageEvent) {
      if (event.data?.type === "NOTIFICATIONS_CHANGED") void load();
    }

    void load();
    const timer = window.setInterval(load, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(NOTIFICATION_CHANGED_EVENT, onChanged);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onWorkerMessage);
    }

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(NOTIFICATION_CHANGED_EVENT, onChanged);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onWorkerMessage);
      }
    };
  }, [pathname]);

  const label =
    unreadCount > 0
      ? `Notifikasi, ${unreadCount} belum dibaca`
      : "Notifikasi";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="relative"
      aria-label={label}
      title={label}
      nativeButton={false}
      render={<Link href="/notifikasi" />}
    >
      <Bell aria-hidden="true" />
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -right-1 -top-1 tabular-nums"
          aria-hidden="true"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </Badge>
      )}
    </Button>
  );
}
