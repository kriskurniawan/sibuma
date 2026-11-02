"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellOff, Hammer, RefreshCw, StickyNote } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { IconTile } from "@/components/reui/icon-tile";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  NOTIFICATION_CHANGED_EVENT,
  type AppNotificationItem,
} from "@/lib/notification-types";
import { currentTimeZoneLabel, formatDateTime } from "@/lib/time";

function notifyChanged() {
  window.dispatchEvent(new Event(NOTIFICATION_CHANGED_EVENT));
}

export function NotificationInbox({
  initialItems,
  initialUnreadCount,
  initialNextCursor,
}: {
  initialItems: AppNotificationItem[];
  initialUnreadCount: number;
  initialNextCursor: string | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [markingAll, setMarkingAll] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Data server berubah setelah router.refresh(); samakan state klien tanpa
  // menghapus item yang baru dimuat lewat "Muat lebih banyak".
  useEffect(() => {
    setItems(initialItems);
    setUnreadCount(initialUnreadCount);
    setNextCursor(initialNextCursor);
  }, [initialItems, initialUnreadCount, initialNextCursor]);

  useEffect(() => {
    function refresh() {
      router.refresh();
    }
    function onVisible() {
      if (document.visibilityState === "visible") refresh();
    }
    function onWorkerMessage(event: MessageEvent) {
      if (event.data?.type === "NOTIFICATIONS_CHANGED") refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onWorkerMessage);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onWorkerMessage);
      }
    };
  }, [router]);

  function applyRead(ids: string[]) {
    const unread = items.filter(
      (item) => ids.includes(item.id) && !item.readAt,
    ).length;
    if (unread === 0) return;
    const now = new Date().toISOString();
    setItems((current) =>
      current.map((item) =>
        ids.includes(item.id) && !item.readAt
          ? { ...item, readAt: now }
          : item,
      ),
    );
    setUnreadCount((current) => Math.max(0, current - unread));
    notifyChanged();
  }

  function openItem(item: AppNotificationItem) {
    if (item.readAt) return;
    applyRead([item.id]);
    void fetch("/api/notifikasi/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [item.id] }),
      keepalive: true,
    }).catch(() => undefined);
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      const response = await fetch("/api/notifikasi/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!response.ok) throw new Error("Gagal menandai notifikasi.");
      const now = new Date().toISOString();
      setItems((current) =>
        current.map((item) =>
          item.readAt ? item : { ...item, readAt: now },
        ),
      );
      setUnreadCount(0);
      notifyChanged();
      toast.success("Semua notifikasi ditandai sudah dibaca.");
    } catch {
      toast.error("Notifikasi belum dapat ditandai. Coba lagi.");
    } finally {
      setMarkingAll(false);
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const response = await fetch(
        `/api/notifikasi?limit=50&cursor=${encodeURIComponent(nextCursor)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Gagal memuat notifikasi.");
      const data = (await response.json()) as {
        items?: AppNotificationItem[];
        unreadCount?: number;
        nextCursor?: string | null;
      };
      const incoming = data.items ?? [];
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [
          ...current,
          ...incoming.filter((item) => !seen.has(item.id)),
        ];
      });
      setUnreadCount(
        typeof data.unreadCount === "number" ? data.unreadCount : unreadCount,
      );
      setNextCursor(data.nextCursor ?? null);
    } catch {
      setLoadError("Notifikasi berikutnya gagal dimuat.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <NotificationInboxFrame
      description={unreadCount > 0 ? `${unreadCount} pemberitahuan belum dibaca` : "Semua pemberitahuan sudah dibaca"}
      action={unreadCount > 0 ? (
        <Button type="button" size="sm" variant="outline" disabled={markingAll} onClick={markAllRead}>
          {markingAll ? <Spinner /> : null}
          Tandai semua dibaca
        </Button>
      ) : undefined}
    >
      {items.length === 0 ? (
        <FramePanel>
          <EmptyState
            icon={BellOff}
            title="Belum ada notifikasi"
            action={
              <Button nativeButton={false} render={<Link href="/" />}>
                Ke beranda
              </Button>
            }
          />
        </FramePanel>
      ) : (
        <FramePanel>
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const Icon = item.kind === "pekerjaan_baru" ? Hammer : StickyNote;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => openItem(item)}
                    className={`flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/60 ${
                      item.readAt ? "" : "bg-primary/5"
                    }`}
                  >
                    <IconTile
                      variant="soft"
                      size="sm"
                      className={
                        item.kind === "pekerjaan_baru"
                          ? "text-primary"
                          : "text-muted-foreground"
                      }
                      aria-hidden="true"
                    >
                      <Icon />
                    </IconTile>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-start gap-2">
                        <span
                          className={`min-w-0 flex-1 text-sm ${
                            item.readAt ? "font-medium" : "font-semibold"
                          }`}
                        >
                          {item.title}
                        </span>
                        {!item.readAt && (
                          <>
                            <span
                              className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                              aria-hidden="true"
                            />
                            <span className="sr-only">Belum dibaca</span>
                          </>
                        )}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {item.body}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(item.createdAt)} ·{" "}
                        {currentTimeZoneLabel()}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {loadError && (
            <div
              className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between"
              role="status"
              aria-live="polite"
            >
              <p className="text-sm text-destructive">{loadError}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loadingMore}
                onClick={loadMore}
              >
                {loadingMore ? <Spinner /> : <RefreshCw aria-hidden="true" />}
                Coba lagi
              </Button>
            </div>
          )}

          {nextCursor && !loadError && (
            <div className="flex justify-center pt-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loadingMore}
                onClick={loadMore}
              >
                {loadingMore ? <Spinner /> : null}
                Muat lebih banyak
              </Button>
            </div>
          )}
        </FramePanel>
      )}
    </NotificationInboxFrame>
  );
}

export function NotificationInboxFrame({ description, action, children }: { description?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <Frame spacing="sm">
      <FrameHeader className="gap-3">
        <div className="flex flex-col gap-1">
          <FrameTitle>Kotak masuk</FrameTitle>
          <FrameDescription className="text-xs">{description ?? <Skeleton className="h-3 w-48" />}</FrameDescription>
        </div>
        {action}
      </FrameHeader>
      {children}
    </Frame>
  );
}

export function NotificationInboxSkeleton() {
  return (
    <NotificationInboxFrame action={<Button type="button" size="sm" variant="outline" disabled title="Menunggu jumlah notifikasi belum dibaca">Tandai semua dibaca</Button>}>
      <FramePanel aria-busy="true" aria-live="polite">
        <span className="sr-only">Memuat notifikasi…</span>
        <div className="flex flex-col gap-1">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-start gap-3 p-2">
              <Skeleton className="size-8 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </FramePanel>
    </NotificationInboxFrame>
  );
}
