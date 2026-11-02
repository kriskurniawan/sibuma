import type { ReactNode } from "react";
import { PushActivationButton } from "@/components/notifications/push-activation-button";
import { PageHeader } from "@/components/ui";

export function NotificationPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Akun"
        title="Notifikasi"
        description="Pekerjaan baru dan catatan untukmu. Pengaturan notifikasi perangkat ada di Profil."
        action={<PushActivationButton />}
        mobileCompact
      />
      {children}
    </div>
  );
}
