"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Copy,
  FolderLock,
  Hammer,
  Inbox,
  KeyRound,
  ListChecks,
  MessageSquare,
  ScrollText,
  Send,
  Settings2,
  ShieldCheck,
  StickyNote,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { DataLoadError } from "@/components/data-load-error";
import { useAuditFilters } from "@/components/audit/audit-filter-context";
import {
  AuditRowsSkeleton,
  AuditStatsSkeleton,
} from "@/components/audit/audit-skeleton";
import type {
  AuditDataPromise,
  AuditDataResult,
} from "@/components/audit/audit-data";
import { FramePanel } from "@/components/reui/frame";
import { IconTile } from "@/components/reui/icon-tile";
import { ListPagination } from "@/components/list-pagination";
import { MobileSummary } from "@/components/mobile-summary";
import { Badge, EmptyState, StatCard } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditLog, NotificationLog } from "@/lib/types";
import { currentTimeZoneLabel, formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

type AuditType = AuditLog["objectType"];
const OBJECT_LABEL: Record<AuditType, string> = {
  spkl: "SPKL",
  absensi: "Absensi",
  karyawan: "Karyawan",
  divisi: "Divisi",
  kebijakan: "Kebijakan",
  autentikasi: "Autentikasi",
  checklist: "Checklist",
  tindak_lanjut: "Tindak lanjut",
  pekerjaan: "Pekerjaan harian",
  dokumen: "Dokumen kerja",
  catatan: "Catatan",
};
const OBJECT_VARIANT = {
  spkl: "info-light",
  absensi: "success-light",
  karyawan: "primary-light",
  divisi: "primary-light",
  kebijakan: "warning-light",
  autentikasi: "outline",
  checklist: "primary-light",
  tindak_lanjut: "info-light",
  pekerjaan: "warning-light",
  dokumen: "info-light",
  catatan: "primary-light",
} as const;
const OBJECT_ICON_TONE = {
  spkl: "text-info",
  absensi: "text-success",
  karyawan: "text-primary",
  divisi: "text-primary",
  kebijakan: "text-warning",
  autentikasi: "text-muted-foreground",
  checklist: "text-primary",
  tindak_lanjut: "text-info",
  pekerjaan: "text-warning",
  dokumen: "text-info",
  catatan: "text-primary",
} as const;
const OBJECT_ICON = {
  spkl: ClipboardList,
  absensi: ShieldCheck,
  karyawan: UserRound,
  divisi: Building2,
  kebijakan: Settings2,
  autentikasi: KeyRound,
  checklist: ClipboardCheck,
  tindak_lanjut: ListChecks,
  pekerjaan: Hammer,
  dokumen: FolderLock,
  catatan: StickyNote,
} as const;
const ACTION_LABEL: Record<string, string> = {
  spkl_dibuat: "SPKL dibuat",
  spkl_diubah: "SPKL diubah",
  spkl_dibatalkan: "SPKL dibatalkan",
  absen_masuk: "Absen masuk",
  absen_pulang: "Absen pulang",
  absensi_dikoreksi: "Absensi dikoreksi",
  absensi_disetujui: "Absensi disetujui",
  karyawan_ditambahkan: "Pekerja ditambahkan",
  karyawan_diubah: "Data pekerja diubah",
  atasan_ditambahkan: "Akun atasan dibuat",
  atasan_diubah: "Akun atasan diubah",
  divisi_dibuat: "Divisi dibuat",
  divisi_diubah: "Divisi diubah",
  kebijakan_diubah: "Kebijakan diubah",
  lokasi_absen_ditambah: "Titik absensi ditambahkan",
  lokasi_absen_diubah: "Titik absensi diubah",
  login_otp: "Login OTP",
  sesi_ditutup_otomatis: "Sesi ditutup otomatis",
  sesi_tanpa_absen_pulang: "Sesi tanpa absen pulang",
  tidak_hadir_dicatat: "Tidak hadir dicatat",
  dokumentasi_diunggah: "Dokumentasi diunggah",
  checklist_lokasi_dibuat: "Lokasi checklist dibuat",
  checklist_lokasi_diubah: "Lokasi checklist diubah",
  checklist_template_dibuat: "Template checklist dibuat",
  checklist_template_diubah: "Template checklist diubah",
  checklist_template_versi: "Versi template diterbitkan",
  checklist_jadwal_dibuat: "Jadwal checklist dibuat",
  checklist_jadwal_diubah: "Jadwal checklist diubah",
  checklist_item_diisi: "Item checklist diisi",
  checklist_butir_diisi: "Item checklist diisi",
  status_checklist_ditambah: "Status checklist ditambahkan",
  status_checklist_diubah: "Status checklist diubah",
  status_checklist_dihapus: "Status checklist dihapus",
  status_checklist_diurutkan: "Urutan status checklist diubah",
  super_admin_dipromosikan: "Super admin dipromosikan",
  checklist_foto_diunggah: "Foto checklist diunggah",
  checklist_foto_dihapus: "Foto checklist dihapus",
  checklist_video_diunggah: "Video checklist diunggah",
  checklist_video_dihapus: "Video checklist dihapus",
  checklist_selesai: "Checklist diselesaikan",
  checklist_dibuka_kembali: "Checklist dibuka kembali",
  checklist_deadline_dibuka: "Kunci deadline dibuka",
  tindak_lanjut_dibuat: "Tindak lanjut dibuat",
  tindak_lanjut_diubah: "Tindak lanjut diperbarui",
  pekerjaan_dibuat: "Pekerjaan harian dibuat",
  pekerjaan_diubah: "Pekerjaan harian diubah",
  pekerjaan_dimulai: "Pekerjaan harian dimulai",
  pekerjaan_diselesaikan: "Pekerjaan harian diselesaikan",
  pekerjaan_dibatalkan: "Pekerjaan harian dibatalkan",
  pekerjaan_dibuka_kembali: "Pekerjaan harian dibuka kembali",
  pekerjaan_bergabung: "Pekerja bergabung",
  pekerjaan_foto_diunggah: "Foto pekerjaan diunggah",
  pekerjaan_foto_dihapus: "Foto pekerjaan dihapus",
  pekerjaan_video_diunggah: "Video pekerjaan diunggah",
  pekerjaan_video_dihapus: "Video pekerjaan dihapus",
  dokumen_diunggah: "Dokumen kerja diunggah",
  dokumen_diubah: "Dokumen kerja diubah",
  dokumen_dipindahkan: "Dokumen kerja dipindahkan",
  dokumen_dipindahkan_ke_sampah: "Dokumen kerja ke sampah",
  dokumen_dipulihkan: "Dokumen kerja dipulihkan",
  dokumen_dihapus_permanen: "Dokumen kerja dihapus permanen",
  dokumen_berbagi_diubah: "Berbagi dokumen diubah",
  folder_dokumen_dibuat: "Folder dokumen dibuat",
  folder_dokumen_diubah: "Folder dokumen diubah",
  folder_dokumen_dihapus: "Folder dokumen dihapus",
  folder_dokumen_berbagi_diubah: "Berbagi folder diubah",
  pengaturan_dokumen_diubah: "Pengaturan dokumen diubah",
  pengaturan_batas_foto_diubah: "Batas foto diubah",
  catatan_dibuat: "Catatan dibuat",
  catatan_diubah: "Catatan diubah",
  catatan_dihapus: "Catatan dihapus",
};
const NOTIFICATION_LABEL: Record<NotificationLog["type"], string> = {
  otp: "Kode OTP",
  spkl_baru: "SPKL baru",
  spkl_diubah: "SPKL diubah",
  spkl_dibatalkan: "SPKL dibatalkan",
  pengingat: "Pengingat",
};
function safeJson(value: unknown) {
  if (value === null || value === undefined) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
function useAuditData(
  dataPromise?: AuditDataPromise,
): AuditDataResult | undefined {
  return dataPromise ? use(dataPromise) : undefined;
}
export function AuditTypeCount({
  dataPromise,
  type,
}: {
  dataPromise?: AuditDataPromise;
  type: "semua" | AuditType;
}) {
  const data = useAuditData(dataPromise);
  if (data === undefined) return <Skeleton className="h-3 w-3" />;
  if (!data) return null;
  return (
    <span className="text-xs font-medium tabular-nums opacity-70">
      {type === "semua"
        ? data.logs.length
        : data.logs.filter((log) => log.objectType === type).length}
    </span>
  );
}
export function AuditTabCount({
  dataPromise,
  tab,
}: {
  dataPromise?: AuditDataPromise;
  tab: "audit" | "notifikasi";
}) {
  const data = useAuditData(dataPromise);
  if (data === undefined) return <Skeleton className="h-4 w-5" />;
  if (!data) return null;
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
      {tab === "audit" ? data.logs.length : data.notifications.length}
    </span>
  );
}
export function AuditStats({
  dataPromise,
}: {
  dataPromise?: AuditDataPromise;
}) {
  const data = useAuditData(dataPromise);
  if (data === undefined) return <AuditStatsSkeleton />;
  // Never substitute failed requests with zero KPIs.
  if (!data) return <DataLoadError message="Ringkasan audit gagal dimuat." />;
  const { logs, notifications } = data;
  const spklLogs = logs.filter((log) => log.objectType === "spkl").length;
  const correctionLogs = logs.filter(
    (log) => log.action === "absensi_dikoreksi",
  ).length;
  const failedNotifications = notifications.filter(
    (item) => item.status === "gagal",
  ).length;
  const waitingNotifications = notifications.filter(
    (item) => item.status === "menunggu" || item.status === "diproses",
  ).length;
  return (
    <>
      <MobileSummary
        className="md:hidden"
        items={[
          { label: "Peristiwa", value: logs.length, tone: "primary" },
          { label: "Perubahan SPKL", value: spklLogs, tone: "info" },
          { label: "Koreksi absensi", value: correctionLogs, tone: "success" },
          {
            label: "Pesan gagal",
            value: failedNotifications,
            tone: failedNotifications > 0 ? "destructive" : "neutral",
          },
        ]}
      />
      <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total peristiwa"
          value={logs.length}
          icon={ScrollText}
          helper="Audit terbaru yang tersimpan"
          tone="primary"
        />
        <StatCard
          label="Perubahan SPKL"
          value={spklLogs}
          icon={ClipboardList}
          helper="Dibuat, diubah, dibatalkan"
          tone="info"
        />
        <StatCard
          label="Koreksi absensi"
          value={correctionLogs}
          icon={ShieldCheck}
          helper="Selalu disertai alasan"
          tone="success"
        />
        <StatCard
          label="Pesan gagal"
          value={failedNotifications}
          icon={AlertTriangle}
          helper={`${waitingNotifications} menunggu · ${failedNotifications} gagal`}
          tone={failedNotifications > 0 ? "destructive" : "neutral"}
        />
      </div>
    </>
  );
}
export function AuditEntries({
  dataPromise,
  notifications = false,
}: {
  dataPromise?: AuditDataPromise;
  notifications?: boolean;
}) {
  const data = useAuditData(dataPromise);
  if (data === undefined) return <AuditRowsSkeleton />;
  if (!data)
    return (
      <FramePanel>
        <DataLoadError message="Log audit dan outbox gagal dimuat." />
      </FramePanel>
    );
  return notifications ? (
    <NotificationEntries notifications={data.notifications} />
  ) : (
    <LogEntries logs={data.logs} />
  );
}
function LogEntries({ logs }: { logs: AuditLog[] }) {
  const { search, typeFilter, setSearch, setTypeFilter } = useAuditFilters();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [previousFilter, setPreviousFilter] = useState({ search, typeFilter });
  if (
    previousFilter.search !== search ||
    previousFilter.typeFilter !== typeFilter
  ) {
    setPreviousFilter({ search, typeFilter });
    setPage(0);
  }
  const query = search.trim().toLowerCase();
  const filtered = logs.filter(
    (log) =>
      (typeFilter === "semua" || log.objectType === typeFilter) &&
      (!query ||
        `${log.actorName} ${log.summary} ${log.action} ${log.objectId} ${OBJECT_LABEL[log.objectType]}`
          .toLowerCase()
          .includes(query)),
  );
  const safePage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / pageSize) - 1),
  );
  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  if (filtered.length === 0)
    return (
      <FramePanel>
        <EmptyState
          icon={Inbox}
          title={
            search || typeFilter !== "semua"
              ? "Tidak ada log yang cocok"
              : "Belum ada log audit"
          }
          description="Aktivitas pembuatan SPKL, absensi, perubahan tim, dan kebijakan akan muncul di sini."
          action={
            search || typeFilter !== "semua" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("semua");
                }}
              >
                Tampilkan semua log
              </Button>
            ) : (
              <Button nativeButton={false} render={<Link href="/" />}>
                Ke beranda
              </Button>
            )
          }
        />
      </FramePanel>
    );
  return (
    <FramePanel>
      <div className="flex flex-col divide-y divide-border/70">
        {filtered
          .slice(safePage * pageSize, (safePage + 1) * pageSize)
          .map((log) => {
            const Icon = OBJECT_ICON[log.objectType];
            const open = expanded.has(log.id);
            return (
              <div key={log.id} className="-mx-4">
                <button
                  type="button"
                  onClick={() => toggle(log.id)}
                  aria-expanded={open}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
                >
                  <IconTile
                    variant="soft"
                    size="sm"
                    className={OBJECT_ICON_TONE[log.objectType]}
                    aria-hidden="true"
                  >
                    <Icon />
                  </IconTile>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium text-foreground">
                        {ACTION_LABEL[log.action] ?? log.action}
                      </span>
                      <Badge variant={OBJECT_VARIANT[log.objectType]}>
                        {OBJECT_LABEL[log.objectType]}
                      </Badge>
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      {log.summary}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{log.actorName}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {formatDateTime(log.createdAt)} {currentTimeZoneLabel()}
                      </span>
                      <span aria-hidden="true" className="hidden md:inline">
                        ·
                      </span>
                      <span className="hidden font-mono md:inline">
                        {log.objectId}
                      </span>
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                      open && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>
                {open && (
                  <div className="border-t border-border/70 bg-muted/20 px-4 py-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      {[
                        { label: "Sebelum", value: log.before },
                        { label: "Sesudah", value: log.after },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex min-w-0 flex-col gap-1"
                        >
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {item.label}
                          </p>
                          <pre className="overflow-x-auto whitespace-pre-wrap break-all bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground">
                            {safeJson(item.value)}
                          </pre>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                      Objek: {log.objectId} · ID log: {log.id}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
      </div>
      <div className="border-t border-border/70 px-4 py-3">
        <ListPagination
          page={safePage}
          pageSize={pageSize}
          total={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
          itemLabel="peristiwa"
        />
      </div>
    </FramePanel>
  );
}
function NotificationEntries({
  notifications,
}: {
  notifications: NotificationLog[];
}) {
  const {
    notificationSearch: search,
    notificationStatus: status,
    setNotificationSearch,
    setNotificationStatus,
    setTab,
  } = useAuditFilters();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [previousFilter, setPreviousFilter] = useState({ search, status });
  if (previousFilter.search !== search || previousFilter.status !== status) {
    setPreviousFilter({ search, status });
    setPage(0);
  }
  const query = search.trim().toLowerCase();
  const filtered = notifications.filter(
    (item) =>
      (status === "semua" ||
        (status === "menunggu"
          ? item.status === "menunggu" || item.status === "diproses"
          : item.status === status)) &&
      (!query ||
        `${item.recipientPhone} ${item.message} ${item.type}`
          .toLowerCase()
          .includes(query)),
  );
  const safePage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / pageSize) - 1),
  );
  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async function copy(message: string) {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Pesan disalin.");
    } catch {
      toast.error("Clipboard tidak tersedia di browser ini.");
    }
  }
  if (filtered.length === 0)
    return (
      <FramePanel>
        <EmptyState
          icon={MessageSquare}
          title="Outbox masih kosong"
          description="Pesan OTP dan notifikasi SPKL yang dikirim melalui Chatery akan terlihat di sini."
          action={
            search || status !== "semua" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setNotificationSearch("");
                  setNotificationStatus("semua");
                }}
              >
                Tampilkan semua pesan
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setTab("audit")}
              >
                Lihat log audit
              </Button>
            )
          }
        />
      </FramePanel>
    );
  return (
    <FramePanel>
      <div className="flex flex-col divide-y divide-border/70">
        {filtered
          .slice(safePage * pageSize, (safePage + 1) * pageSize)
          .map((item) => {
            const open = expanded.has(item.id);
            return (
              <div key={item.id} className="-mx-4">
                <div className="flex items-start gap-2 px-4 py-3 transition-colors hover:bg-muted/50">
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    aria-expanded={open}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
                  >
                    <IconTile
                      variant="soft"
                      size="sm"
                      className={
                        item.type === "otp" ? "text-warning" : "text-info"
                      }
                      aria-hidden="true"
                    >
                      {item.type === "otp" ? <KeyRound /> : <Send />}
                    </IconTile>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-medium text-foreground">
                          {NOTIFICATION_LABEL[item.type]}
                        </span>
                        <Badge
                          variant={
                            item.status === "terkirim"
                              ? "success-light"
                              : item.status === "gagal"
                                ? "destructive-light"
                                : "info-light"
                          }
                          dot
                        >
                          {item.status === "terkirim"
                            ? "Terkirim"
                            : item.status === "gagal"
                              ? "Gagal"
                              : item.status === "diproses"
                                ? "Diproses"
                                : "Menunggu"}
                        </Badge>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.recipientPhone} · {formatDateTime(item.createdAt)}{" "}
                        {currentTimeZoneLabel()}
                      </span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {item.message}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                        open && "rotate-180",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="mt-0.5"
                    onClick={() => copy(item.message)}
                    aria-label="Salin pesan"
                    title="Salin pesan"
                  >
                    <Copy aria-hidden="true" />
                  </Button>
                </div>
                {open && (
                  <div className="border-t border-border/70 bg-muted/20 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Isi pesan
                    </p>
                    <div className="mt-1 whitespace-pre-wrap break-words bg-muted/50 p-3 text-sm leading-relaxed text-foreground">
                      {item.message}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {item.providerMessageId && (
                        <span className="font-mono">
                          ID: {item.providerMessageId}
                        </span>
                      )}
                      {item.error && (
                        <span className="flex items-center gap-1 text-destructive">
                          <AlertTriangle
                            className="size-3"
                            aria-hidden="true"
                          />
                          {item.error}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
      <div className="border-t border-border/70 px-4 py-3">
        <ListPagination
          page={safePage}
          pageSize={pageSize}
          total={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
          itemLabel="pesan"
        />
      </div>
    </FramePanel>
  );
}
