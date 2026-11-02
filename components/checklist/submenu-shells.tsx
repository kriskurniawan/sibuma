"use client";

import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { MapPin, Plus, QrCode, ShieldCheck } from "lucide-react";
import { MobileFab } from "@/components/mobile-fab";
import { Alert, AlertDescription } from "@/components/reui/alert";
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { useSessionUser } from "@/components/session-user-provider";
import { BackLink, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ChecklistFollowUpFilters } from "@/components/checklist/follow-up-filters";
import { isReadOnly } from "@/lib/access";

type ShellProps = { children: ReactNode };

function ChecklistSubmenuFab({ hash, label }: { hash: string; label: string }) {
  return (
    <MobileFab
      title={label}
      onClick={() => {
        window.location.hash = hash;
      }}
    >
      <Plus aria-hidden="true" />
      {label}
    </MobileFab>
  );
}

/** Intent triggers stay mounted while the data boundary loads. The existing
 * dialog-intent capture queues a click until its data-backed dialog is ready. */
export function ChecklistTemplateShell({ children }: ShellProps) {
  const user = useSessionUser();
  const canManage = user.role === "atasan" && !isReadOnly(user);

  return (
    <div className="flex min-w-0 flex-col gap-6 lg:gap-8">
      <BackLink href="/checklist">Kembali ke Checklist</BackLink>
      <PageHeader
        mobileCompact
        eyebrow="Pengaturan checklist"
        title="Template & lokasi"
        description="Kelola item pemeriksaan dan lokasi tim."
        descriptionClassName="hidden md:block"
        action={canManage ? (
          <div className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto">
            <div className="max-md:hidden">
              <Button size="sm" nativeButton={false} render={<a href="#template-baru" />} aria-haspopup="dialog" data-dialog-intent="template-new">
                <Plus aria-hidden="true" />
                Template baru
              </Button>
            </div>
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/checklist/qr" />}>
              <QrCode aria-hidden="true" />
              Kelola QR area
            </Button>
            <Button size="sm" variant="outline" nativeButton={false} render={<a href="#lokasi-baru" />} aria-haspopup="dialog" data-dialog-intent="location-new">
              <MapPin aria-hidden="true" />
              Lokasi baru
            </Button>
          </div>
        ) : undefined}
      />
      {children}
      {canManage && (
        <ChecklistSubmenuFab hash="#template-baru" label="Template baru" />
      )}
    </div>
  );
}

export function ChecklistScheduleShell({ children }: ShellProps) {
  const user = useSessionUser();
  const canManage = user.role === "atasan" && !isReadOnly(user);

  return (
    <div className="flex min-w-0 flex-col gap-6 lg:gap-8">
      <BackLink href="/checklist">Kembali ke Checklist</BackLink>
      <PageHeader
        mobileCompact
        eyebrow="Pengaturan checklist"
        title="Jadwal"
        description="Checklist otomatis sesuai kalender dan penugasan tim."
        descriptionClassName="hidden md:block"
        action={canManage ? (
          <div className="max-md:hidden">
            <Button size="sm" nativeButton={false} render={<a href="#jadwal-baru" />} aria-haspopup="dialog" data-dialog-intent="schedule-new">
              <Plus aria-hidden="true" />
              Jadwal baru
            </Button>
          </div>
        ) : undefined}
      />
      {children}
      {canManage && (
        <ChecklistSubmenuFab hash="#jadwal-baru" label="Jadwal baru" />
      )}
    </div>
  );
}

export function ChecklistQrShell({ children }: ShellProps) {
  const user = useSessionUser();
  const readOnly = isReadOnly(user);
  // QR management is also available to read-only supervisors, by design.
  const canManage = user.role === "atasan";

  return (
    <div className="flex min-w-0 flex-col gap-6 lg:gap-8">
      <BackLink href={readOnly ? "/checklist" : "/checklist/template"}>
        {readOnly ? "Kembali ke Checklist" : "Kembali ke Template & lokasi"}
      </BackLink>
      <PageHeader
        mobileCompact
        eyebrow="Akses pengunjung"
        title="QR area."
        description="Kelola tautan QR untuk pengunjung dan petugas."
        descriptionClassName="hidden md:block"
        action={canManage ? (
          <div className="max-md:hidden">
            <Button size="sm" nativeButton={false} render={<a href="#qr-baru" />} aria-haspopup="dialog" data-dialog-intent="qr-new">
              <Plus aria-hidden="true" />
              QR baru
            </Button>
          </div>
        ) : undefined}
      />
      <Alert>
        <ShieldCheck aria-hidden="true" />
        <AlertDescription>
          {readOnly
            ? "QR dari akun pengamat mencakup seluruh area publik perusahaan. Hanya area dan item publik tampil ke pengunjung; data internal tetap privat."
            : "Hanya area dan item publik tampil ke pengunjung. Data internal tetap privat; petugas tetap perlu penugasan untuk mengisi."}
        </AlertDescription>
      </Alert>
      {children}
      {canManage && (
        <ChecklistSubmenuFab hash="#qr-baru" label="QR baru" />
      )}
    </div>
  );
}

export function ChecklistFollowUpShell({
  children,
  summary,
  filters,
}: ShellProps & {
  summary: ReactNode;
  filters?: { status: string; search: string; mine: boolean };
}) {
  return (
    <div className="flex min-w-0 flex-col gap-6 lg:gap-8">
      <BackLink href="/checklist">Kembali ke Checklist</BackLink>
      <div className="hidden md:block">
        <PageHeader eyebrow="Operasional" title="Tindak lanjut" description="Pantau temuan dan progres penanganan PIC." />
      </div>
      <h1 className="sr-only md:hidden">Tindak lanjut</h1>
      {summary}
      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <FrameTitle className="max-md:sr-only">Daftar tindak lanjut</FrameTitle>
        </FrameHeader>
        <FramePanel className="p-0">
          <div className="border-b border-border p-4">
            <Suspense fallback={<p className="text-sm text-muted-foreground" role="status">Memuat filter tindak lanjut…</p>}>
              <ChecklistFollowUpFilters filters={filters} />
            </Suspense>
          </div>
          {children}
        </FramePanel>
      </Frame>
    </div>
  );
}
