"use client";

import type { ReactNode } from "react";
import { useSessionUser } from "@/components/session-user-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert";
import { CalendarDays, CheckCircle2, ClipboardList, MapPin, Save, Send, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { IconTile } from "@/components/reui/icon-tile";
import { SpklFormPendingActions } from "@/components/spkl/spkl-route-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CHECKOUT_GRACE_MINUTES } from "@/lib/constants";
import { currentTimeZoneLabel } from "@/lib/time";

function FieldSkeleton({ label, multiline = false }: { label: string; multiline?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium">{label}</p>
      <Skeleton className={multiline ? "h-24 w-full" : "h-9 w-full"} />
    </div>
  );
}

function FormSection({ title, icon, description, children }: {
  title: string;
  icon: ReactNode;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Frame>
      <FrameHeader className="flex-row items-center gap-3">
        <IconTile variant="soft" size="sm" className="text-primary" aria-hidden="true">{icon}</IconTile>
        <div className="flex min-w-0 flex-col">
          <FrameTitle>{title}</FrameTitle>
          {description && <FrameDescription className="text-xs">{description}</FrameDescription>}
        </div>
      </FrameHeader>
      <FramePanel className="flex flex-col gap-4">{children}</FramePanel>
    </Frame>
  );
}

export function SpklFormDataSkeleton({ mode = "create" }: { mode?: "create" | "edit" }) {
  return (
    <>
      <div className="grid gap-5 pb-24 xl:grid-cols-[1.45fr_0.55fr] xl:pb-0" aria-busy="true">
        <span className="sr-only" role="status">Memuat pilihan dan data SPKL…</span>
        <div className="flex min-w-0 flex-col gap-5">
          <FormSection title="Detail pekerjaan" icon={<ClipboardList />} description="Terlihat oleh pekerja yang ditugaskan.">
            <FieldSkeleton label="Nama pekerjaan *" />
            <FieldSkeleton label="Deskripsi & target pekerjaan *" multiline />
          </FormSection>
          <FormSection title="Jadwal lembur" icon={<CalendarDays />}>
            <div className="grid gap-3 sm:grid-cols-[1.2fr_0.9fr_0.9fr]">
              <FieldSkeleton label="Tanggal *" />
              <FieldSkeleton label="Jam mulai *" />
              <FieldSkeleton label="Jam selesai *" />
            </div>
            <Skeleton className="h-9 w-full" />
          </FormSection>
          <FormSection title="Lokasi & radius absen" icon={<MapPin />} description="Pilih titik yang sudah disetujui admin, lalu atur toleransi jarak absensi.">
            <FieldSkeleton label="Titik absensi *" />
            <p className="text-xs text-muted-foreground">Titik absensi dikelola super admin. Atasan tidak dapat menentukan koordinat sendiri.</p>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-[240px] w-full" />
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
            <div className="sm:max-w-44"><FieldSkeleton label="Radius absen" /></div>
          </FormSection>
          <FormSection title="Pekerja yang ditugaskan" icon={<UsersRound />}>
            <Skeleton className="h-4 w-48" />
            <FieldSkeleton label="Divisi" />
            <Skeleton className="h-24 w-full" />
          </FormSection>
        </div>
        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
          <Frame>
            <FrameHeader className="gap-2">
              <p className="text-xs font-medium text-muted-foreground">Ringkasan SPKL</p>
              <Skeleton className="h-6 w-full" />
              <div className="flex flex-col gap-1.5">
                {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-4 w-3/4" />)}
              </div>
            </FrameHeader>
            <FramePanel className="grid grid-cols-3 gap-2">
              {["Pekerja", "Durasi", "Radius"].map((label) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <Skeleton className="h-5 w-14" />
                </div>
              ))}
            </FramePanel>
            <FrameFooter className="hidden xl:flex">
              <Button type="button" disabled className="w-full">
                {mode === "create" ? <Send aria-hidden="true" /> : <Save aria-hidden="true" />}
                {mode === "create" ? "Buat & kirim notifikasi" : "Simpan perubahan"}
              </Button>
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                {mode === "create"
                  ? "SPKL langsung berlaku sesuai jadwal. Pekerja menerima notifikasi WhatsApp."
                  : "Perubahan jadwal dan lokasi langsung berlaku untuk semua pekerja."}
              </p>
            </FrameFooter>
          </Frame>
          <Frame spacing="sm">
            <FrameHeader className="flex-row items-center gap-2">
              <Sparkles className="size-3.5 text-warning" aria-hidden="true" />
              <FrameTitle>Sebelum menekan simpan</FrameTitle>
            </FrameHeader>
            <FramePanel>
              <ul className="flex flex-col gap-2">
                {[
                  "Jam selesai masih di masa depan (SPKL boleh mulai hari ini).",
                  "Titik absen dipilih dari daftar lokasi resmi admin.",
                  "Pekerja sudah dikonfirmasi ketersediaannya.",
                  "Target dokumentasi pekerjaan jelas.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-success" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </FramePanel>
          </Frame>
          <Frame spacing="sm">
            <FramePanel className="flex flex-col gap-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />Batas waktu per hari & minggu
              </p>
              <Skeleton className="h-12 w-full" />
            </FramePanel>
          </Frame>
        </aside>
      </div>
      <SpklFormPendingActions mode={mode} />
    </>
  );
}

function AttendanceStatusSkeleton() {
  return (
    <Frame spacing="sm">
      <FrameHeader>
        <FrameTitle>Status kehadiran</FrameTitle>
        <FrameDescription className="text-xs">Absensiku pada SPKL ini</FrameDescription>
      </FrameHeader>
      <FramePanel className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-9 w-full" />
      </FramePanel>
    </Frame>
  );
}

export function SpklDetailDataSkeleton() {
  const user = useSessionUser();
  const isWorker = user.role === "pekerja";
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <span className="sr-only" role="status">Memuat detail SPKL…</span>
      <Frame>
        <FrameHeader className="gap-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-72 max-w-full" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </FrameHeader>
        <FramePanel className="flex flex-col gap-4">
          <Skeleton className="h-9 w-48" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {["Durasi", "Kehadiran", "Dokumentasi", "Radius absen"].map((label) => (
              <div key={label} className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">{label}</p>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </FramePanel>
      </Frame>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="flex min-w-0 flex-col gap-5">
          {isWorker && <div className="md:hidden"><AttendanceStatusSkeleton /></div>}
          <Frame>
            <FrameHeader>
              <div className="flex min-w-0 flex-col gap-1">
                <FrameTitle>Titik absen & radius</FrameTitle>
                <Skeleton className="h-4 w-56 max-w-full" />
              </div>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              <Skeleton className="h-[250px] w-full sm:h-[330px]" />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span>Titik absen SPKL</span>
                <span>Posisi absen anggota</span>
                <span className="ml-auto flex items-center gap-1.5">Akurasi GPS maks. <Skeleton className="h-4 w-10" /> m</span>
              </div>
            </FramePanel>
          </Frame>
          <Frame>
            <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <FrameTitle>Dokumentasi pekerjaan</FrameTitle>
                <FrameDescription className="flex flex-wrap items-center gap-1 text-xs">
                  <Skeleton className="h-4 w-14" /> · terlihat oleh anggota dan atasan SPKL
                </FrameDescription>
              </div>
              <Skeleton className="h-6 w-32" />
            </FrameHeader>
            <FramePanel><Skeleton className="h-36 w-full" /></FramePanel>
          </Frame>
          <Frame>
            <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <FrameTitle>Daftar pekerja</FrameTitle>
                <FrameDescription className="flex flex-wrap items-center gap-1 text-xs">
                  Kehadiran, bukti, dan koreksi <Skeleton className="h-4 w-8" /> pekerja pada SPKL ini.
                </FrameDescription>
              </div>
              <Skeleton className="h-6 w-24" />
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              {[0, 1, 2].map((index) => <Skeleton key={index} className="h-12 w-full" />)}
            </FramePanel>
          </Frame>
        </div>
        <aside className="flex min-w-0 flex-col gap-4">
          {isWorker && <div className="hidden md:block"><AttendanceStatusSkeleton /></div>}
          <Frame spacing="sm">
            <FrameHeader>
              <FrameTitle>Informasi penugasan</FrameTitle>
              <FrameDescription className="text-xs">Rincian SPKL dan pekerja terhubung</FrameDescription>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              {["Nomor", "Tanggal", "Jam", "Lokasi", "Radius", "Divisi", "Pembuat", "Dokumentasi", "Pekerja"].map((label) => (
                <div key={label} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{label}</span><Skeleton className="h-4 w-24" />
                </div>
              ))}
            </FramePanel>
          </Frame>
          <Alert variant="warning">
            <ShieldCheck aria-hidden="true" />
            <AlertTitle>Ketentuan absensi</AlertTitle>
            <AlertDescription>
              <ul className="flex flex-col gap-1.5">
                <li>Absen masuk bisa dilakukan sejak 00:00 {currentTimeZoneLabel()} pada tanggal SPKL hingga jam selesai, dalam radius <Skeleton className="inline-block h-3 w-8 align-middle" /> m dari titik.</li>
                <li>Absen lebih awal diperbolehkan; durasi lembur tetap dihitung sejak jam mulai SPKL.</li>
                <li>Absen pulang wajib dilakukan di dalam radius <Skeleton className="inline-block h-3 w-8 align-middle" /> m. Checkout setelah jam selesai masih dapat dilakukan dalam toleransi {CHECKOUT_GRACE_MINUTES} menit; durasi tetap dibatasi sampai jam selesai.</li>
                <li>Waktu absensi memakai jam server, bukan jam perangkat.</li>
                <li><Skeleton className="h-8 w-full" /></li>
                <li>Durasi dihitung per menit aktual. Jika absen pulang tidak tercatat, durasi tidak dihitung dan atasan dapat mengoreksi. Dokumentasi ditutup <Skeleton className="inline-block h-3 w-8 align-middle" /> menit setelah SPKL berakhir.</li>
              </ul>
            </AlertDescription>
          </Alert>
          {!isWorker && (
            <Frame spacing="sm">
              <FrameHeader>
                <FrameTitle>Progres kehadiran</FrameTitle>
                <FrameDescription className="text-xs">Ringkasan tim pada SPKL ini</FrameDescription>
              </FrameHeader>
              <FramePanel className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">Sudah absen masuk</p>
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-24 w-full" />
              </FramePanel>
            </Frame>
          )}
        </aside>
      </div>
    </div>
  );
}
