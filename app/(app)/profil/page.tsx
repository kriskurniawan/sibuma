import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Cloud,
  Database,
  History,
  Info,
  KeyRound,
  LayoutGrid,
  MapPin,
  Mail,
  MessageCircle,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  UsersRound,
} from "lucide-react";
import { ProfileActions } from "@/components/profile/profile-actions";
import { ProfileEditor } from "@/components/profile/profile-editor";
import {
  Avatar,
  Badge,
  DataRow,
  InfoBanner,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { IconTile } from "@/components/reui/icon-tile";
import { getCurrentUser } from "@/lib/auth";
import { avatarUrl } from "@/lib/avatar-url";
import {
  APP_TIMEZONE,
  OTP_TTL_SECONDS,
  ROLE_LABEL,
  SESSION_DAYS,
} from "@/lib/constants";
import { isNeonBackend } from "@/lib/db-state";
import { getPolicy, getTeam } from "@/lib/queries";
import { isS3Configured } from "@/lib/storage-config";
import { durationLabel, formatDateTime } from "@/lib/time";

export const metadata = {
  title: "Profil",
};

const SECURITY_NOTES_ADMIN = [
  "Masuk dengan OTP 6 digit yang berlaku 5 menit.",
  "Sesi disimpan pada cookie httpOnly bertanda tangan HMAC.",
  "Kode OTP disimpan sebagai hash, bukan teks biasa.",
  "Absensi memakai waktu server dan koordinat GPS.",
];

const SECURITY_NOTES_USER = [
  "Masuk dengan kode OTP 6 digit yang dikirim ke WhatsApp atau email terdaftar.",
  "Jangan bagikan kode OTP kepada siapa pun.",
  "Absensi memakai waktu server dan koordinat GPS.",
  "Keluar akan mengakhiri sesi pada perangkat ini.",
];

const INTEGRATION_STYLES = {
  success: { badge: "success-light", icon: "text-success", tile: "soft" },
  warning: { badge: "warning-light", icon: "text-warning", tile: "soft" },
  neutral: {
    badge: "outline",
    icon: "text-muted-foreground",
    tile: "outline",
  },
} as const;

type IntegrationTone = keyof typeof INTEGRATION_STYLES;

function phoneLabel(phone: string) {
  if (!phone) return "—";
  if (phone.startsWith("62")) {
    const local = `0${phone.slice(2)}`;
    return `${local.slice(0, 4)}-${local.slice(4, 8)}-${local.slice(8)}`;
  }
  return phone;
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Status integrasi, konfigurasi sesi, dan detail build adalah informasi
  // teknis untuk super admin. Atasan dan pekerja hanya melihat hal yang
  // berkaitan dengan pekerjaan mereka.
  const isAdmin = user.role === "super_admin";
  const neonDatabase = isNeonBackend();
  const neonStorage = isS3Configured();
  const [team, policy] = await Promise.all([
    user.role === "atasan" ? getTeam(user.id) : Promise.resolve([]),
    getPolicy(),
  ]);
  const chateryConfigured = Boolean(
    process.env.CHATERY_API_URL &&
      process.env.CHATERY_API_KEY &&
      process.env.CHATERY_SESSION_ID,
  );
  const resendConfigured = Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());
  const now = new Date().toISOString();
  const serverTime = formatDateTime(now, "d MMM yyyy, HH:mm");
  const footerDate = formatDateTime(now, "d MMM yyyy");
  const pageDescription = isAdmin
    ? "Identitas akun, akses cepat, dan status integrasi. Nama dan foto profil dapat kamu ubah sendiri; NIK dan kontak dikelola super admin."
    : user.role === "pekerja"
      ? "Identitas akun dan akses cepat. Nama dan foto profil dapat kamu ubah sendiri; NIK dan kontak dikelola atasan."
      : "Identitas akun dan akses cepat. Nama dan foto profil dapat kamu ubah sendiri; NIK dan kontak tidak dapat diubah dari sini.";

  const quickLinks =
    user.role === "super_admin"
      ? [
          {
            href: "/tim",
            icon: UsersRound,
            title: "Akun atasan",
            description: "Buat dan perbarui akun atasan organisasi.",
          },
          {
            href: "/laporan",
            icon: BarChart3,
            title: "Laporan & rekap",
            description: "Kehadiran, durasi, dan ekspor CSV seluruh tim.",
          },
          {
            href: "/audit",
            icon: ScrollText,
            title: "Log audit",
            description: "Jejak perubahan lintas tim.",
          },
          {
            href: "/pengaturan",
            icon: SlidersHorizontal,
            title: "Pengaturan",
            description: "Kebijakan lembur dan status checklist global.",
          },
        ]
      : user.role === "atasan"
      ? [
          {
            href: "/laporan",
            icon: BarChart3,
            title: "Laporan & rekap",
            description: "Kehadiran, durasi, dan ekspor CSV tim.",
          },
          {
            href: "/lembur",
            icon: CalendarClock,
            title: "Lembur",
            description: "SPKL, kehadiran, dan dokumentasi tim.",
          },
          {
            href: "/tim",
            icon: UsersRound,
            title: "Tim",
            description: "Kelola pekerja dan divisi.",
          },
          {
            href: "/audit",
            icon: ScrollText,
            title: "Log audit",
            description: "Jejak perubahan data tim.",
          },
        ]
      : [
          {
            href: "/riwayat",
            icon: History,
            title: "Riwayat lembur",
            description: "Semua SPKL dan bukti pekerjaanmu.",
          },
          {
            href: "/",
            icon: ClipboardList,
            title: "Beranda",
            description: "Checklist aktif dan tindak lanjutmu.",
          },
        ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Akun & preferensi"
        title="Profil & akun."
        description={pageDescription}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{ROLE_LABEL[user.role]}</Badge>
            {isAdmin && (
              <Badge variant="success-light" dot>
                Produksi
              </Badge>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar
              name={user.name}
              seed={user.id}
              src={avatarUrl(user.id, user.avatarKey)}
              size="xl"
            />
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                {user.name}
              </h2>
              <p className="truncate text-sm text-muted-foreground">
                {user.nik} · {phoneLabel(user.phone)}
              </p>
              <p className="break-all text-sm text-muted-foreground">
                {user.email ??
                  (user.role === "pekerja"
                    ? "Email belum diisi — hubungi atasan untuk OTP cadangan."
                    : "Email belum diisi.")}
              </p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {user.supervisorName ? (
                  <span>Atasan: {user.supervisorName}</span>
                ) : user.role === "pekerja" ? (
                  <span>Atasan: Tidak ada</span>
                ) : null}
                {user.supervisorName && user.role === "atasan" && (
                  <span
                    aria-hidden="true"
                    className="size-1 shrink-0 rounded-full bg-muted-foreground/40"
                  />
                )}
              </div>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <ProfileEditor user={user} />
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <Link
                  href={
                    user.role === "atasan"
                      ? "/tim"
                      : user.role === "super_admin"
                        ? "/tim"
                        : "/riwayat"
                  }
                />
              }
              className="w-full sm:w-auto"
            >
              {user.role === "atasan"
                ? "Kelola tim"
                : user.role === "super_admin"
                  ? "Kelola atasan"
                  : "Riwayat lembur"}
              <ArrowRight />
            </Button>
          </div>
        </CardContent>
      </Card>

      {isAdmin ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Sesi aman"
            value={SESSION_DAYS}
            suffix="hari"
            icon={ShieldCheck}
            helper="Cookie httpOnly bertanda tangan HMAC"
          />
          <StatCard
            label="Kode OTP"
            value={OTP_TTL_SECONDS / 60}
            suffix="menit"
            icon={KeyRound}
            helper="Melalui WhatsApp atau email terdaftar"
            tone="info"
          />
          <StatCard
            label="Zona waktu"
            value="WIB"
            icon={CalendarClock}
            helper={APP_TIMEZONE}
            tone="success"
          />
        </div>
      ) : user.role === "atasan" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Pekerja"
            value={team.length}
            suffix="orang"
            icon={UsersRound}
            helper="Anggota tim di bawahmu"
          />
          <StatCard
            label="Batas harian"
            value={durationLabel(policy.dailyLimitMinutes)}
            icon={CalendarClock}
            helper="Berlaku untuk setiap SPKL"
            tone="info"
          />
          <StatCard
            label="Batas mingguan"
            value={durationLabel(policy.weeklyLimitMinutes)}
            icon={CalendarClock}
            helper="Akumulasi per minggu"
            tone="success"
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Frame>
            <SectionHeader
              icon={ShieldCheck}
              title="Keamanan & akses"
              description="Perlindungan akun dan sesi di perangkat ini."
            />
            <FramePanel className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2.5">
                {(isAdmin ? SECURITY_NOTES_ADMIN : SECURITY_NOTES_USER).map(
                  (item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground"
                    >
                      <CheckCircle2
                        className="mt-0.5 size-4 shrink-0 text-success"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ),
                )}
              </ul>

              <Separator />

              <div className="flex flex-col">
                {isAdmin ? (
                  <>
                    <DataRow
                      label="Masa berlaku sesi"
                      value={`${SESSION_DAYS} hari`}
                    />
                    <DataRow
                      label="Waktu server"
                      value={`${serverTime} WIB`}
                    />
                    <DataRow
                      label="Verifikasi masuk"
                      value="OTP WhatsApp / email 6 digit"
                    />
                  </>
                ) : (
                  <>
                    <DataRow
                      label="Waktu sekarang"
                      value={`${serverTime} WIB`}
                    />
                    <DataRow
                      label="Verifikasi masuk"
                      value="OTP WhatsApp / email"
                    />
                  </>
                )}
              </div>

              <InfoBanner tone="info" icon={Info}>
                Jangan bagikan kode OTP kepada siapa pun.
              </InfoBanner>

              <p className="text-xs leading-relaxed text-muted-foreground">
                {isAdmin
                  ? "Keluar akan menghapus cookie sesi pada perangkat ini. Kamu perlu OTP baru untuk masuk kembali."
                  : "Keluar akan mengakhiri sesi di perangkat ini. Kamu perlu OTP baru untuk masuk kembali."}
              </p>

              <ProfileActions />
            </FramePanel>
          </Frame>

          <Frame>
            <SectionHeader
              icon={CalendarClock}
              title="Kebijakan lembur"
              description="Ringkasan aturan yang berlaku untuk seluruh sesi lembur."
            />
            <FramePanel>
              <div className="flex flex-col">
                <DataRow
                  label="Pembulatan durasi"
                  value={`${policy.roundingMinutes} menit`}
                />
                <DataRow
                  label="Batas harian"
                  value={durationLabel(policy.dailyLimitMinutes)}
                />
                <DataRow
                  label="Batas mingguan"
                  value={durationLabel(policy.weeklyLimitMinutes)}
                />
                <DataRow
                  label="Akurasi GPS maksimal"
                  value={`${policy.maxGpsAccuracyMeters} m`}
                />
                <DataRow
                  label="Toleransi dokumentasi"
                  value={`${policy.docGraceMinutes} menit`}
                />
                <DataRow
                  label="Radius default"
                  value={`${policy.defaultRadiusMeters} m`}
                />
                <DataRow
                  label="Dokumentasi"
                  value={
                    <Badge
                      variant={
                        policy.requireDocumentation ? "info-light" : "outline"
                      }
                    >
                      {policy.requireDocumentation ? "Wajib" : "Opsional"}
                    </Badge>
                  }
                />
              </div>
            </FramePanel>
            <FrameFooter className="flex-row flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {isAdmin
                  ? "Perubahan kebijakan tercatat di log audit."
                  : "Kebijakan ini berlaku untuk seluruh tim."}
              </p>
              {isAdmin ? (
                <Link
                  href="/pengaturan"
                  className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/70"
                >
                  Ubah di Pengaturan
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              ) : null}
            </FrameFooter>
          </Frame>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Frame>
            <SectionHeader
              icon={LayoutGrid}
              title="Ruang kerja"
              description="Akses cepat ke halaman yang sering kamu pakai."
            />
            <FramePanel className="flex flex-col gap-1">
              {quickLinks.map((link) => (
                <QuickLink key={link.href} {...link} />
              ))}
            </FramePanel>
          </Frame>

          {isAdmin && (
            <Frame>
              <SectionHeader
                icon={Cloud}
                title="Status layanan"
                description="Integrasi yang tersedia pada build ini."
              />
              <FramePanel className="flex flex-col gap-4">
                <IntegrationRow
                  icon={MessageCircle}
                  title="Chatery WhatsApp"
                  description={
                    chateryConfigured
                      ? "Pesan OTP dan notifikasi dikirim melalui API Chatery."
                      : "OTP beralih ke email terdaftar jika Resend tersedia. Notifikasi SPKL dicatat gagal sampai Chatery dikonfigurasi."
                  }
                  status={chateryConfigured ? "Dikonfigurasi" : "Belum dikonfigurasi"}
                  tone={chateryConfigured ? "success" : "warning"}
                />
                <IntegrationRow
                  icon={Mail}
                  title="Resend Email"
                  description={resendConfigured ? "Untuk login email dan OTP cadangan saat WhatsApp gagal. Status penerimaan perlu diuji." : "RESEND_API_KEY dan RESEND_FROM_EMAIL belum dikonfigurasi."}
                  status={resendConfigured ? "Dikonfigurasi" : "Belum dikonfigurasi"}
                  tone={resendConfigured ? "success" : "warning"}
                />
                <IntegrationRow
                  icon={Database}
                  title="Neon Postgres"
                  description={
                    neonDatabase
                      ? "State aplikasi tersimpan di Neon Postgres dengan kontrol versi."
                      : "DATABASE_URL belum dikonfigurasi. Penyimpanan lokal tidak tersedia."
                  }
                  status={neonDatabase ? "Terhubung" : "Belum dikonfigurasi"}
                  tone={neonDatabase ? "success" : "warning"}
                />
                <IntegrationRow
                  icon={Cloud}
                  title="Neon Object Storage"
                  description={
                    neonStorage
                      ? "Dokumentasi tersimpan di bucket privat dan diakses lewat proxy aplikasi."
                      : "Object storage belum dikonfigurasi. Unggahan tidak dapat disimpan."
                  }
                  status={neonStorage ? "Dikonfigurasi" : "Belum dikonfigurasi"}
                  tone={neonStorage ? "success" : "warning"}
                />
                <IntegrationRow
                  icon={Smartphone}
                  title="PWA & GPS"
                  description="Pasang aplikasi ke layar utama. GPS memerlukan HTTPS atau localhost."
                  status="Siap"
                  tone="success"
                />
              </FramePanel>
            </Frame>
          )}

          <Frame>
            <SectionHeader
              icon={MessageCircle}
              title="Bantuan"
              description="Kontak dan lokasi kerja yang terdaftar."
            />
            <FramePanel className="flex flex-col gap-4">
              <div className="flex flex-col">
                {user.role === "pekerja" && (
                  <DataRow
                    label="Atasan langsung"
                    value={user.supervisorName ?? "Tidak ada"}
                  />
                )}
                <DataRow
                  label="Lokasi absen kantor"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      {policy.defaultLocation.address ??
                        "Menara Sentraya, Jakarta Selatan"}
                    </span>
                  }
                />
                <DataRow
                  label="Zona waktu"
                  value={isAdmin ? `${APP_TIMEZONE} (WIB)` : "WIB"}
                />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Setiap SPKL dapat memakai titik dan radius yang berbeda.
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Nama dan foto dapat diubah dari tombol Ubah profil.{" "}
                {isAdmin
                  ? "NIK dan kontak akun atasan dikelola lewat menu Tim."
                  : user.role === "pekerja"
                    ? "NIK dan kontak dikelola atasan."
                    : "NIK dan kontak tidak dapat diubah dari halaman ini."}
              </p>
            </FramePanel>
          </Frame>
        </div>
      </div>

      <p className="px-1 text-center text-xs text-muted-foreground">
        SIBUMA{isAdmin ? " v0.1" : ""} · Sistem Building Management ·{" "}
        {footerDate}
      </p>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ArrowRight;
  title: string;
  description: string;
}) {
  return (
    <FrameHeader>
      <div className="flex items-start gap-3">
        <IconTile
          variant="soft"
          size="sm"
          className="text-primary"
          aria-hidden="true"
        >
          <Icon />
        </IconTile>
        <div className="flex min-w-0 flex-col gap-0.5">
          <FrameTitle>{title}</FrameTitle>
          <FrameDescription>{description}</FrameDescription>
        </div>
      </div>
    </FrameHeader>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof ArrowRight;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 py-2 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <IconTile
        variant="soft"
        size="sm"
        className="text-primary"
        aria-hidden="true"
      >
        <Icon />
      </IconTile>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground group-hover:text-primary">
            {title}
          </span>
          <ArrowRight
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transform-none"
            aria-hidden="true"
          />
        </span>
        <span className="block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
    </Link>
  );
}

function IntegrationRow({
  icon: Icon,
  title,
  description,
  status,
  tone,
}: {
  icon: typeof ArrowRight;
  title: string;
  description: string;
  status: string;
  tone: IntegrationTone;
}) {
  const style = INTEGRATION_STYLES[tone];

  return (
    <div className="flex items-start gap-3">
      <IconTile
        variant={style.tile}
        size="sm"
        className={style.icon}
        aria-hidden="true"
      >
        <Icon />
      </IconTile>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <Badge variant={style.badge} dot={tone !== "neutral"}>
            {status}
          </Badge>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
