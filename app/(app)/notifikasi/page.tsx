import { redirect } from "next/navigation";
import { NotificationInbox } from "@/components/notifications/notification-inbox";
import { PushActivationButton } from "@/components/notifications/push-activation-button";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getNotificationInbox } from "@/lib/notification-store";

export const metadata = { title: "Notifikasi" };

export default async function NotificationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const inbox = await getNotificationInbox(user.id, { limit: 50 });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Akun"
        title="Notifikasi"
        description="Pekerjaan baru dan catatan untukmu. Pengaturan notifikasi perangkat ada di Profil."
        action={<PushActivationButton />}
        mobileCompact
      />
      <NotificationInbox
        initialItems={inbox.items}
        initialUnreadCount={inbox.unreadCount}
        initialNextCursor={inbox.nextCursor}
      />
    </div>
  );
}
