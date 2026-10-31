"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
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
  Search,
  Send,
  Settings2,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { IconTile } from "@/components/reui/icon-tile";
import { ListPagination } from "@/components/list-pagination";
import { MobileSummary } from "@/components/mobile-summary";
import {
  Badge,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type {
  AuditLog,
  NotificationLog,
  NotificationStatus,
} from "@/lib/types";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

type AuditType = AuditLog["objectType"];
type AuditTab = "audit" | "notifikasi";

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
  tindak_lanjut_dibuat: "Tindak lanjut dibuat",
  tindak_lanjut_diubah: "Tindak lanjut diperbarui",
  pekerjaan_dibuat: "Pekerjaan harian dibuat",
  pekerjaan_diubah: "Pekerjaan harian diubah",
  pekerjaan_dimulai: "Pekerjaan harian dimulai",
  pekerjaan_diselesaikan: "Pekerjaan harian diselesaikan",
  pekerjaan_dibatalkan: "Pekerjaan harian dibatalkan",
  pekerjaan_dibuka_kembali: "Pekerjaan harian dibuka kembali",
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
};

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
} as const;

const NOTIFICATION_LABEL: Record<NotificationLog["type"], string> = {
  otp: "Kode OTP",
  spkl_baru: "SPKL baru",
  spkl_diubah: "SPKL diubah",
  spkl_dibatalkan: "SPKL dibatalkan",
  pengingat: "Pengingat",
};

const NOTIFICATION_STATUS_LABEL: Record<NotificationStatus, string> = {
  terkirim: "Terkirim",
  gagal: "Gagal",
};

const NOTIFICATION_VARIANT = {
  terkirim: "success-light",
  gagal: "destructive-light",
} as const;

const AUDIT_FILTERS: Array<{ value: "semua" | AuditType; label: string }> = [
  { value: "semua", label: "Semua" },
  { value: "spkl", label: "SPKL" },
  { value: "absensi", label: "Absensi" },
  { value: "karyawan", label: "Karyawan" },
  { value: "divisi", label: "Divisi" },
  { value: "kebijakan", label: "Kebijakan" },
  { value: "autentikasi", label: "Autentikasi" },
  { value: "checklist", label: "Checklist" },
  { value: "tindak_lanjut", label: "Tindak lanjut" },
  { value: "pekerjaan", label: "Pekerjaan harian" },
  { value: "dokumen", label: "Dokumen kerja" },
];

const NOTIFICATION_FILTERS: Array<{
  value: "semua" | NotificationStatus;
  label: string;
}> = [
  { value: "semua", label: "Semua" },
  { value: "terkirim", label: "Terkirim" },
  { value: "gagal", label: "Gagal" },
];

function safeJson(value: unknown) {
  if (value === null || value === undefined) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function AuditView({
  logs,
  notifications,
}: {
  logs: AuditLog[];
  notifications: NotificationLog[];
}) {
  const [tab, setTab] = useState<AuditTab>("audit");
  const [typeFilter, setTypeFilter] = useState<"semua" | AuditType>("semua");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [notificationSearch, setNotificationSearch] = useState("");
  const [notificationStatus, setNotificationStatus] = useState<
    "semua" | NotificationStatus
  >("semua");
  const [logPage, setLogPage] = useState(0);
  const [logPageSize, setLogPageSize] = useState(10);
  const [notificationPage, setNotificationPage] = useState(0);
  const [notificationPageSize, setNotificationPageSize] = useState(10);

  const counts = useMemo(() => {
    const map: Record<string, number> = { semua: logs.length };
    for (const log of logs) {
      map[log.objectType] = (map[log.objectType] ?? 0) + 1;
    }
    return map;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (typeFilter !== "semua" && log.objectType !== typeFilter) return false;
      if (!query) return true;
      return `${log.actorName} ${log.summary} ${log.action} ${log.objectId} ${OBJECT_LABEL[log.objectType]}`
        .toLowerCase()
        .includes(query);
    });
  }, [logs, search, typeFilter]);

  const filteredNotifications = useMemo(() => {
    const query = notificationSearch.trim().toLowerCase();
    return notifications.filter((notification) => {
      if (
        notificationStatus !== "semua" &&
        notification.status !== notificationStatus
      ) {
        return false;
      }
      if (!query) return true;
      return `${notification.recipientPhone} ${notification.message} ${notification.type}`
        .toLowerCase()
        .includes(query);
    });
  }, [notificationSearch, notificationStatus, notifications]);

  const logPageCount = Math.max(1, Math.ceil(filteredLogs.length / logPageSize));
  const safeLogPage = Math.min(logPage, logPageCount - 1);
  const pagedLogs = filteredLogs.slice(
    safeLogPage * logPageSize,
    (safeLogPage + 1) * logPageSize,
  );

  const notificationPageCount = Math.max(
    1,
    Math.ceil(filteredNotifications.length / notificationPageSize),
  );
  const safeNotificationPage = Math.min(
    notificationPage,
    notificationPageCount - 1,
  );
  const pagedNotifications = filteredNotifications.slice(
    safeNotificationPage * notificationPageSize,
    (safeNotificationPage + 1) * notificationPageSize,
  );

  const failedNotifications = notifications.filter(
    (item) => item.status === "gagal",
  ).length;
  const correctionLogs = logs.filter(
    (item) => item.action === "absensi_dikoreksi",
  ).length;
  const spklLogs = logs.filter((item) => item.objectType === "spkl").length;

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyMessage(message: string) {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Pesan disalin.");
    } catch {
      toast.error("Clipboard tidak tersedia di browser ini.");
    }
  }

  function resetLogFilters() {
    setSearch("");
    setTypeFilter("semua");
    setLogPage(0);
  }

  function resetNotificationFilters() {
    setNotificationSearch("");
    setNotificationStatus("semua");
    setNotificationPage(0);
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        eyebrow="Transparansi & jejak"
        title="Log audit."
        description="Riwayat perubahan dan pengiriman notifikasi WhatsApp."
        descriptionClassName="hidden md:block"
      />

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
          helper={`${notifications.length} pesan di outbox`}
          tone={failedNotifications > 0 ? "destructive" : "neutral"}
        />
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as AuditTab)}
        className="min-w-0 gap-6"
      >
        <TabsList className="w-full">
          <TabsTrigger value="audit">
            <ScrollText />
            Log audit
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {logs.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="notifikasi">
            <Bell />
            Outbox
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {notifications.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit">
          <Frame spacing="default" className="min-w-0">
            <FrameHeader className="gap-3">
              <div className="flex flex-col gap-1">
                <FrameTitle>Log audit</FrameTitle>
                <FrameDescription className="text-xs">
                  {filteredLogs.length} peristiwa
                </FrameDescription>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 max-w-full items-center gap-1.5 overflow-x-auto lg:flex-wrap">
                  {AUDIT_FILTERS.map((item) => {
                    const count = counts[item.value] ?? 0;
                    const active = typeFilter === item.value;
                    return (
                      <Button
                        key={item.value}
                        type="button"
                        size="sm"
                        variant={active ? "default" : "outline"}
                        aria-pressed={active}
                        onClick={() => {
                          setTypeFilter(item.value);
                          setLogPage(0);
                        }}
                      >
                        {item.label}
                        <span className="text-xs font-medium tabular-nums opacity-70">
                          {count}
                        </span>
                      </Button>
                    );
                  })}
                </div>

                <InputGroup className="w-full lg:w-64">
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setLogPage(0);
                    }}
                    placeholder="Cari aktor, ringkasan, objek…"
                    aria-label="Cari log audit"
                  />
                  {search && (
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        size="icon-xs"
                        onClick={() => {
                          setSearch("");
                          setLogPage(0);
                        }}
                        aria-label="Hapus pencarian"
                      >
                        <X />
                      </InputGroupButton>
                    </InputGroupAddon>
                  )}
                </InputGroup>
              </div>
            </FrameHeader>

            {filteredLogs.length === 0 ? (
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
                        onClick={resetLogFilters}
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
            ) : (
              <FramePanel>
                <div className="flex flex-col divide-y divide-border/70">
                  {pagedLogs.map((log) => {
                    const Icon = OBJECT_ICON[log.objectType];
                    const open = expanded.has(log.id);
                    return (
                      <div key={log.id} className="-mx-4">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(log.id)}
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
                                {formatDateTime(log.createdAt)} WIB
                              </span>
                              <span aria-hidden="true" className="hidden md:inline">·</span>
                              <span className="hidden font-mono md:inline">{log.objectId}</span>
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
                              <div className="flex min-w-0 flex-col gap-1">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Sebelum
                                </p>
                                <pre className="overflow-x-auto whitespace-pre-wrap break-all bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground">
                                  {safeJson(log.before)}
                                </pre>
                              </div>
                              <div className="flex min-w-0 flex-col gap-1">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Sesudah
                                </p>
                                <pre className="overflow-x-auto whitespace-pre-wrap break-all bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground">
                                  {safeJson(log.after)}
                                </pre>
                              </div>
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
                    page={safeLogPage}
                    pageSize={logPageSize}
                    total={filteredLogs.length}
                    onPageChange={setLogPage}
                    onPageSizeChange={(size) => {
                      setLogPageSize(size);
                      setLogPage(0);
                    }}
                    itemLabel="peristiwa"
                  />
                </div>
              </FramePanel>
            )}

            <FrameFooter className="hidden flex-row items-start gap-2 text-xs text-muted-foreground md:flex">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              Log audit tidak dapat diubah atau dihapus dari aplikasi.
            </FrameFooter>
          </Frame>
        </TabsContent>

        <TabsContent value="notifikasi" className="flex flex-col gap-6">
          <Frame spacing="default" className="min-w-0">
            <FrameHeader className="gap-3">
              <div className="flex flex-col gap-1">
                <FrameTitle>Outbox WhatsApp</FrameTitle>
                <FrameDescription className="text-xs">
                  {filteredNotifications.length} pesan
                </FrameDescription>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 max-w-full items-center gap-1.5 overflow-x-auto lg:flex-wrap">
                  {NOTIFICATION_FILTERS.map((item) => {
                    const active = notificationStatus === item.value;
                    return (
                      <Button
                        key={item.value}
                        type="button"
                        size="sm"
                        variant={active ? "default" : "outline"}
                        aria-pressed={active}
                        onClick={() => {
                          setNotificationStatus(item.value);
                          setNotificationPage(0);
                        }}
                      >
                        {item.label}
                      </Button>
                    );
                  })}
                </div>

                <InputGroup className="w-full lg:w-64">
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={notificationSearch}
                    onChange={(event) => {
                      setNotificationSearch(event.target.value);
                      setNotificationPage(0);
                    }}
                    placeholder="Cari nomor atau isi pesan…"
                    aria-label="Cari outbox WhatsApp"
                  />
                  {notificationSearch && (
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        size="icon-xs"
                        onClick={() => {
                          setNotificationSearch("");
                          setNotificationPage(0);
                        }}
                        aria-label="Hapus pencarian"
                      >
                        <X />
                      </InputGroupButton>
                    </InputGroupAddon>
                  )}
                </InputGroup>
              </div>
            </FrameHeader>

            {filteredNotifications.length === 0 ? (
              <FramePanel>
                <EmptyState
                  icon={MessageSquare}
                  title="Outbox masih kosong"
                  description="Pesan OTP dan notifikasi SPKL yang dikirim melalui Chatery akan terlihat di sini."
                  action={
                    notificationSearch || notificationStatus !== "semua" ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetNotificationFilters}
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
            ) : (
              <FramePanel>
                <div className="flex flex-col divide-y divide-border/70">
                  {pagedNotifications.map((notification) => {
                    const open = expanded.has(notification.id);
                    return (
                      <div key={notification.id} className="-mx-4">
                        <div className="flex items-start gap-2 px-4 py-3 transition-colors hover:bg-muted/50">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(notification.id)}
                            aria-expanded={open}
                            className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
                          >
                            <IconTile
                              variant="soft"
                              size="sm"
                              className={
                                notification.type === "otp"
                                  ? "text-warning"
                                  : "text-info"
                              }
                              aria-hidden="true"
                            >
                              {notification.type === "otp" ? (
                                <KeyRound />
                              ) : (
                                <Send />
                              )}
                            </IconTile>
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="text-sm font-medium text-foreground">
                                  {NOTIFICATION_LABEL[notification.type]}
                                </span>
                                <Badge
                                  variant={
                                    NOTIFICATION_VARIANT[notification.status]
                                  }
                                  dot
                                >
                                  {
                                    NOTIFICATION_STATUS_LABEL[
                                      notification.status
                                    ]
                                  }
                                </Badge>
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {notification.recipientPhone} ·{" "}
                                {formatDateTime(notification.createdAt)} WIB
                              </span>
                              <span className="line-clamp-1 text-xs text-muted-foreground">
                                {notification.message}
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
                            onClick={() => copyMessage(notification.message)}
                            aria-label="Salin pesan"
                            title="Salin pesan"
                          >
                            <Copy />
                          </Button>
                        </div>

                        {open && (
                          <div className="border-t border-border/70 bg-muted/20 px-4 py-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Isi pesan
                            </p>
                            <div className="mt-1 whitespace-pre-wrap break-words bg-muted/50 p-3 text-sm leading-relaxed text-foreground">
                              {notification.message}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              {notification.providerMessageId && (
                                <span className="font-mono">
                                  ID: {notification.providerMessageId}
                                </span>
                              )}
                              {notification.error && (
                                <span className="flex items-center gap-1 text-destructive">
                                  <AlertTriangle className="size-3" />
                                  {notification.error}
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
                    page={safeNotificationPage}
                    pageSize={notificationPageSize}
                    total={filteredNotifications.length}
                    onPageChange={setNotificationPage}
                    onPageSizeChange={(size) => {
                      setNotificationPageSize(size);
                      setNotificationPage(0);
                    }}
                    itemLabel="pesan"
                  />
                </div>
              </FramePanel>
            )}
          </Frame>
        </TabsContent>
      </Tabs>
    </div>
  );
}
