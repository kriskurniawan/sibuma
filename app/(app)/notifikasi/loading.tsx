import { NotificationInboxSkeleton } from "@/components/notifications/notification-inbox";
import { NotificationPageShell } from "@/components/notifications/notification-page-shell";

export default function NotificationLoading() {
  return <NotificationPageShell><NotificationInboxSkeleton /></NotificationPageShell>;
}
