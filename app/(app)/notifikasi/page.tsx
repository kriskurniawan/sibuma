import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DataLoadError } from "@/components/data-load-error";
import { NotificationInbox, NotificationInboxFrame, NotificationInboxSkeleton } from "@/components/notifications/notification-inbox";
import { NotificationPageShell } from "@/components/notifications/notification-page-shell";
import { FramePanel } from "@/components/reui/frame";
import { getCurrentUser } from "@/lib/auth";
import { getNotificationInbox } from "@/lib/notification-store";

export const metadata = { title: "Notifikasi" };

async function InboxRegion({ userId }: { userId: string }) {
  let inbox;
  try { inbox = await getNotificationInbox(userId, { limit: 50 }); }
  catch {
    return <NotificationInboxFrame description="Notifikasi belum tersedia."><FramePanel><DataLoadError message="Kotak masuk belum dapat dimuat." /></FramePanel></NotificationInboxFrame>;
  }
  return <NotificationInbox initialItems={inbox.items} initialUnreadCount={inbox.unreadCount} initialNextCursor={inbox.nextCursor} />;
}

export default async function NotificationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <NotificationPageShell><Suspense fallback={<NotificationInboxSkeleton />}><InboxRegion userId={user.id} /></Suspense></NotificationPageShell>;
}
