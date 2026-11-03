"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, CalendarClock, ChevronRight, ClipboardList, FileText, History, Mail, MessageCircle, ScrollText, ShieldCheck, SlidersHorizontal, UsersRound } from "lucide-react";
import { PushSettings } from "@/components/notifications/push-settings";
import { ProfileActions } from "@/components/profile/profile-actions";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { ProfileSection } from "@/components/profile/profile-section";
import { useSessionUser } from "@/components/session-user-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/reui/badge";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { Avatar, DataRow, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isReadOnly } from "@/lib/access";
import { avatarUrl } from "@/lib/avatar-url";
import { OTP_TTL_SECONDS, ROLE_LABEL, SESSION_DAYS } from "@/lib/constants";
import { isCompanyEmail } from "@/lib/email";
import { currentTimeZoneLabel } from "@/lib/time";
import type { SessionUser } from "@/lib/types";

function phoneLabel(phone: string) {
  if (!phone) return "Belum diisi";
  if (phone.startsWith("62")) {
    const local = `0${phone.slice(2)}`;
    return `${local.slice(0, 4)}-${local.slice(4, 8)}-${local.slice(8)}`;
  }
  return phone;
}

export function ProfilePolicySkeleton() {
  return <div aria-busy="true" aria-live="polite" className="flex min-w-0 flex-col">
    <span className="sr-only">Memuat kebijakan lembur…</span>
    {["Batas harian", "Batas mingguan", "Akurasi GPS maksimal", "Toleransi dokumentasi", "Radius default titik", "Dokumentasi"].map((label) => <DataRow key={label} label={label} value={<Skeleton className="h-4 w-20" />} />)}
  </div>;
}

export function ProfileLocationSkeleton() {
  return <div aria-busy="true" aria-live="polite" className="flex min-w-0 flex-col">
    <span className="sr-only">Memuat lokasi kerja…</span>
    <DataRow label="Titik absensi" value={<Skeleton className="h-4 w-32" />} />
    <DataRow label="Zona waktu" value={<Skeleton className="h-4 w-24" />} />
  </div>;
}

export function ProfileServicesSkeleton() {
  return <div aria-busy="true" aria-live="polite" className="flex min-w-0 flex-col gap-4">
    <span className="sr-only">Memuat status layanan…</span>
    {["Chatery WhatsApp", "Resend Email", "Neon Postgres", "Object Storage S3", "PWA & GPS"].map((title) => <div key={title} className="flex min-w-0 flex-col gap-1"><p className="text-sm font-medium">{title}</p><Skeleton className="h-3 w-full" /></div>)}
  </div>;
}

export function ProfilePageShell({ user: snapshot, teamDescription, policy, locations, services, serverTime }: { user?: SessionUser; teamDescription?: ReactNode; policy?: ReactNode; locations?: ReactNode; services?: ReactNode; serverTime?: string }) {
  const sessionUser = useSessionUser();
  const user = snapshot ?? sessionUser;
  const isAdmin = user.role === "super_admin";
  const readOnly = isReadOnly(user);
  const quickLinks = isAdmin ? [
    { href: "/tim", icon: UsersRound, title: "Akun atasan", description: "Akun dan akses organisasi" },
    { href: "/laporan", icon: BarChart3, title: "Laporan & rekap", description: "Kehadiran dan ekspor seluruh tim" },
    { href: "/audit", icon: ScrollText, title: "Log audit", description: "Perubahan lintas tim" },
    { href: "/pengaturan", icon: SlidersHorizontal, title: "Pengaturan", description: "Kebijakan lembur dan checklist" },
  ] : user.role === "atasan" ? [
    { href: "/tim", icon: UsersRound, title: readOnly ? "Lihat tim" : "Tim", description: teamDescription ?? <Skeleton className="h-3 w-20" /> },
    { href: "/laporan-harian", icon: FileText, title: "Laporan harian", description: "Teks dan kolase foto siap WhatsApp" },
    { href: "/laporan", icon: BarChart3, title: "Laporan & rekap", description: "Kehadiran dan ekspor tim" },
    { href: "/lembur", icon: CalendarClock, title: "Lembur", description: "SPKL dan dokumentasi tim" },
    { href: "/audit", icon: ScrollText, title: "Log audit", description: "Perubahan data tim" },
  ] : [
    { href: "/riwayat", icon: History, title: "Lembur", description: "SPKL dan bukti pekerjaan" },
    { href: "/laporan-harian", icon: FileText, title: "Laporan harian", description: "Teks dan kolase foto siap WhatsApp" },
    { href: "/", icon: ClipboardList, title: "Beranda", description: "Checklist dan tindak lanjut" },
  ];

  return <div className="flex min-w-0 flex-col gap-6">
    <PageHeader mobileCompact title="Profil" />
    <Frame spacing="default">
      <FramePanel className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={user.name} seed={user.id} src={avatarUrl(user.id, user.avatarKey)} size="xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="break-words text-lg font-semibold tracking-tight text-foreground">{user.name}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{ROLE_LABEL[user.role]}</span>
              <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
              <span>NIK {user.nik}</span>
              {readOnly && <Badge variant="outline">Hanya lihat</Badge>}
            </div>
          </div>
        </div>
        <div className="grid min-w-0 gap-2 text-sm text-muted-foreground sm:grid-cols-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-2"><MessageCircle className="size-4 shrink-0" aria-hidden="true" /><span className="break-all"><span className="sr-only">WhatsApp: </span>{phoneLabel(user.phone)}</span></div>
          <div className="flex min-w-0 flex-wrap items-center gap-2"><Mail className="size-4 shrink-0" aria-hidden="true" /><span className="break-all"><span className="sr-only">Email: </span>{user.email ?? "Email belum diisi"}</span>{isCompanyEmail(user.email) && <Badge variant="warning-light">Wajib diganti</Badge>}</div>
        </div>
        {!user.email && user.role === "pekerja" && <p className="text-xs text-muted-foreground">Hubungi atasan untuk menambahkan email OTP cadangan.</p>}
        {readOnly ? <p className="text-xs text-muted-foreground">Nama, foto, NIK, dan kontak dikelola super admin.</p> : <ProfileEditor user={user} />}
      </FramePanel>
    </Frame>
    <Frame id="tampilan" spacing="default">
      <FrameHeader><FrameTitle>Tampilan</FrameTitle></FrameHeader>
      <FramePanel className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5"><p className="text-sm font-medium">Tema aplikasi</p><p className="text-xs text-muted-foreground">Pilihan tersimpan di perangkat ini. Pilih Sistem agar tampilan mengikuti pengaturan perangkat dan berubah otomatis.</p></div>
        <ThemeToggle />
      </FramePanel>
    </Frame>
    <PushSettings />
    <div className="grid min-w-0 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="flex min-w-0 flex-col gap-6">
        <Frame spacing="default">
          <FrameHeader><FrameTitle>Ruang kerja</FrameTitle></FrameHeader>
          <FramePanel><nav aria-label="Akses cepat profil" className="divide-y divide-border">{quickLinks.map((link) => <QuickLink key={link.href} {...link} />)}</nav></FramePanel>
        </Frame>
        <Frame spacing="default">
          <FrameHeader><FrameTitle>Keamanan akun</FrameTitle></FrameHeader>
          <FramePanel className="flex min-w-0 flex-col gap-4">
            <p className="flex items-start gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 shrink-0" aria-hidden="true" /><span>OTP dikirim ke WhatsApp atau email terdaftar. Jangan bagikan kodenya.</span></p>
            {isAdmin && <div className="flex min-w-0 flex-col">
              <DataRow label="Masa sesi" value={`${SESSION_DAYS} hari`} />
              <DataRow label="OTP 6 digit" value={`${OTP_TTL_SECONDS / 60} menit`} />
              <DataRow label="Waktu server" value={serverTime ? `${serverTime} ${currentTimeZoneLabel()}` : <Skeleton className="h-4 w-40" />} />
              <p className="text-xs text-muted-foreground">Cookie httpOnly bertanda tangan HMAC; OTP disimpan sebagai hash.</p>
            </div>}
            <p className="text-xs text-muted-foreground">Keluar mengakhiri sesi di perangkat ini. Perlu OTP baru untuk masuk kembali.</p>
            <ProfileActions />
          </FramePanel>
        </Frame>
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <ProfileSection title="Kebijakan lembur">
          {policy ?? <ProfilePolicySkeleton />}
          {isAdmin && <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/pengaturan" />} className="self-start">Pengaturan<ArrowRight aria-hidden="true" /></Button>}
        </ProfileSection>
        <ProfileSection title="Bantuan & lokasi">
          {user.role === "pekerja" && <DataRow label="Atasan" value={user.supervisorName ?? "Tidak ada"} />}
          {locations ?? <ProfileLocationSkeleton />}
          <p className="text-xs text-muted-foreground">Absensi memakai waktu server dan GPS. Radius mengikuti titik absensi yang dipilih saat membuat SPKL.</p>
          {!readOnly && <p className="text-xs text-muted-foreground">{isAdmin ? "NIK dan kontak akun atasan dikelola melalui menu Tim." : user.role === "pekerja" ? "Untuk perubahan NIK dan kontak, hubungi atasan." : "NIK dan kontak tidak dapat diubah dari halaman ini."}</p>}
        </ProfileSection>
        {isAdmin && <ProfileSection title="Status layanan">{services ?? <ProfileServicesSkeleton />}</ProfileSection>}
      </div>
    </div>
  </div>;
}

function QuickLink({ href, icon: Icon, title, description }: { href: string; icon: typeof ArrowRight; title: string; description: ReactNode }) {
  return <Link href={href} className="group flex min-w-0 items-center gap-3 py-3 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    <span className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="text-sm font-medium">{title}</span><span className="hidden text-xs text-muted-foreground sm:block">{description}</span></span>
    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
  </Link>;
}
