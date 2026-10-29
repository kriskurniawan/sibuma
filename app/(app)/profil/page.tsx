import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Cloud,
  Database,
  History,
  Mail,
  MapPin,
  MessageCircle,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  UsersRound,
} from "lucide-react";
import { ProfileActions } from "@/components/profile/profile-actions";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { ProfileSection } from "@/components/profile/profile-section";
import { Badge } from "@/components/reui/badge";
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Avatar, DataRow, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { isReadOnly } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { avatarUrl } from "@/lib/avatar-url";
import {
  APP_TIMEZONE,
  OTP_TTL_SECONDS,
  ROLE_LABEL,
  SESSION_DAYS,
} from "@/lib/constants";
import { listWorkLocations } from "@/lib/work-locations";
import { isNeonBackend } from "@/lib/db-state";
import { getPolicy, getTeam } from "@/lib/queries";
import { isS3Configured } from "@/lib/storage-config";
import { durationLabel, formatDateTime } from "@/lib/time";

export const metadata = { title: "Profil" };

function phoneLabel(phone: string) {
  if (!phone) return "Belum diisi";
  if (phone.startsWith("62")) {
    const local = `0${phone.slice(2)}`;
    return `${local.slice(0, 4)}-${local.slice(4, 8)}-${local.slice(8)}`;
  }
  return phone;
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin = user.role === "super_admin";
  const readOnly = isReadOnly(user);
  const [team, policy, locations] = await Promise.all([
    user.role === "atasan" ? getTeam(user.id) : Promise.resolve([]),
    getPolicy(),
    listWorkLocations(),
  ]);
  const primaryLocation = locations[0];
  const chateryConfigured = Boolean(
    process.env.CHATERY_API_URL &&
      process.env.CHATERY_API_KEY &&
      process.env.CHATERY_SESSION_ID,
  );
  const resendConfigured = Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim(),
  );
  const neonDatabase = isNeonBackend();
  const neonStorage = isS3Configured();
  const serverTime = formatDateTime(new Date().toISOString(), "d MMM yyyy, HH:mm");

  const quickLinks = isAdmin
    ? [
        {
          href: "/tim",
          icon: UsersRound,
          title: "Akun atasan",
          description: "Akun dan akses organisasi",
        },
        {
          href: "/laporan",
          icon: BarChart3,
          title: "Laporan & rekap",
          description: "Kehadiran dan ekspor seluruh tim",
        },
        {
          href: "/audit",
          icon: ScrollText,
          title: "Log audit",
          description: "Perubahan lintas tim",
        },
        {
          href: "/pengaturan",
          icon: SlidersHorizontal,
          title: "Pengaturan",
          description: "Kebijakan lembur dan checklist",
        },
      ]
    : user.role === "atasan"
      ? [
          {
            href: "/tim",
            icon: UsersRound,
            title: readOnly ? "Lihat tim" : "Tim",
            description: `${team.length} pekerja`,
          },
          {
            href: "/laporan",
            icon: BarChart3,
            title: "Laporan & rekap",
            description: "Kehadiran dan ekspor tim",
          },
          {
            href: "/lembur",
            icon: CalendarClock,
            title: "Lembur",
            description: "SPKL dan dokumentasi tim",
          },
          {
            href: "/audit",
            icon: ScrollText,
            title: "Log audit",
            description: "Perubahan data tim",
          },
        ]
      : [
          {
            href: "/riwayat",
            icon: History,
            title: "Riwayat lembur",
            description: "SPKL dan bukti pekerjaan",
          },
          {
            href: "/",
            icon: ClipboardList,
            title: "Beranda",
            description: "Checklist dan tindak lanjut",
          },
        ];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title="Profil" />

      <Frame spacing="default">
        <FramePanel className="flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              name={user.name}
              seed={user.id}
              src={avatarUrl(user.id, user.avatarKey)}
              size="xl"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 className="break-words text-lg font-semibold tracking-tight text-foreground">
                {user.name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{ROLE_LABEL[user.role]}</span>
                <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
                <span>NIK {user.nik}</span>
                {readOnly && <Badge variant="outline">Hanya lihat</Badge>}
              </div>
            </div>
          </div>

          <div className="grid min-w-0 gap-2 text-sm text-muted-foreground sm:grid-cols-2 sm:gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <MessageCircle className="size-4 shrink-0" aria-hidden="true" />
              <span className="break-all"><span className="sr-only">WhatsApp: </span>{phoneLabel(user.phone)}</span>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <Mail className="size-4 shrink-0" aria-hidden="true" />
              <span className="break-all"><span className="sr-only">Email: </span>{user.email ?? "Email belum diisi"}</span>
            </div>
          </div>

          {!user.email && user.role === "pekerja" && (
            <p className="text-xs text-muted-foreground">
              Hubungi atasan untuk menambahkan email OTP cadangan.
            </p>
          )}
          {readOnly ? (
            <p className="text-xs text-muted-foreground">
              Nama, foto, NIK, dan kontak dikelola super admin.
            </p>
          ) : (
            <ProfileEditor user={user} />
          )}
        </FramePanel>
      </Frame>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Frame spacing="default">
            <FrameHeader>
              <FrameTitle>Ruang kerja</FrameTitle>
            </FrameHeader>
            <FramePanel>
              <nav aria-label="Akses cepat profil" className="divide-y divide-border">
                {quickLinks.map((link) => <QuickLink key={link.href} {...link} />)}
              </nav>
            </FramePanel>
          </Frame>

          <Frame spacing="default">
            <FrameHeader>
              <FrameTitle>Keamanan akun</FrameTitle>
            </FrameHeader>
            <FramePanel className="flex min-w-0 flex-col gap-4">
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
                <span>OTP dikirim ke WhatsApp atau email terdaftar. Jangan bagikan kodenya.</span>
              </p>
              {isAdmin && (
                <div className="flex min-w-0 flex-col">
                  <DataRow label="Masa sesi" value={`${SESSION_DAYS} hari`} />
                  <DataRow label="OTP 6 digit" value={`${OTP_TTL_SECONDS / 60} menit`} />
                  <DataRow label="Waktu server" value={`${serverTime} WIB`} />
                  <p className="text-xs text-muted-foreground">
                    Cookie httpOnly bertanda tangan HMAC; OTP disimpan sebagai hash.
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Keluar mengakhiri sesi di perangkat ini. Perlu OTP baru untuk masuk kembali.
              </p>
              <ProfileActions />
            </FramePanel>
          </Frame>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <ProfileSection title="Kebijakan lembur">
            <div className="flex min-w-0 flex-col">
              <DataRow label="Batas harian" value={durationLabel(policy.dailyLimitMinutes)} />
              <DataRow label="Batas mingguan" value={durationLabel(policy.weeklyLimitMinutes)} />
              <DataRow label="Pembulatan" value={`${policy.roundingMinutes} menit`} />
              <DataRow label="Akurasi GPS maksimal" value={`${policy.maxGpsAccuracyMeters} m`} />
              <DataRow label="Toleransi dokumentasi" value={`${policy.docGraceMinutes} menit`} />
              <DataRow label="Radius default titik" value={`${policy.defaultRadiusMeters} m`} />
              <DataRow
                label="Dokumentasi"
                value={
                  <Badge variant={policy.requireDocumentation ? "info-light" : "outline"}>
                    {policy.requireDocumentation ? "Wajib" : "Opsional"}
                  </Badge>
                }
              />
            </div>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href="/pengaturan" />}
                className="self-start"
              >
                Pengaturan
                <ArrowRight aria-hidden="true" />
              </Button>
            )}
          </ProfileSection>

          <ProfileSection title="Bantuan & lokasi">
            <div className="flex min-w-0 flex-col">
              {user.role === "pekerja" && (
                <DataRow label="Atasan" value={user.supervisorName ?? "Tidak ada"} />
              )}
              <DataRow
                label="Titik absensi"
                value={
                  <span className="inline-flex items-start gap-2">
                    <MapPin className="size-4 shrink-0" aria-hidden="true" />
                    <span>
                      {primaryLocation
                        ? `${primaryLocation.name}${
                            locations.length > 1
                              ? ` +${locations.length - 1} titik lain`
                              : ""
                          }`
                        : "Belum diatur"}
                    </span>
                  </span>
                }
              />
              <DataRow label="Zona waktu" value={isAdmin ? `${APP_TIMEZONE} (WIB)` : "WIB"} />
            </div>
            <p className="text-xs text-muted-foreground">
              Absensi memakai waktu server dan GPS. Radius mengikuti titik absensi
              yang dipilih saat membuat SPKL.
            </p>
            {!readOnly && (
              <p className="text-xs text-muted-foreground">
                {isAdmin
                  ? "NIK dan kontak akun atasan dikelola melalui menu Tim."
                  : user.role === "pekerja"
                    ? "Untuk perubahan NIK dan kontak, hubungi atasan."
                    : "NIK dan kontak tidak dapat diubah dari halaman ini."}
              </p>
            )}
          </ProfileSection>

          {isAdmin && (
            <ProfileSection title="Status layanan">
              <IntegrationRow
                icon={MessageCircle}
                title="Chatery WhatsApp"
                description={chateryConfigured
                  ? "OTP dan notifikasi melalui API Chatery."
                  : "OTP beralih ke email jika Resend tersedia. Notifikasi SPKL gagal hingga Chatery dikonfigurasi."}
                configured={chateryConfigured}
              />
              <IntegrationRow
                icon={Mail}
                title="Resend Email"
                description={resendConfigured
                  ? "Login email dan OTP cadangan. Penerimaan perlu diuji."
                  : "RESEND_API_KEY dan RESEND_FROM_EMAIL belum dikonfigurasi."}
                configured={resendConfigured}
              />
              <IntegrationRow
                icon={Database}
                title="Neon Postgres"
                description={neonDatabase
                  ? "Data tersimpan dengan kontrol versi."
                  : "DATABASE_URL belum dikonfigurasi. Penyimpanan lokal tidak tersedia."}
                configured={neonDatabase}
              />
              <IntegrationRow
                icon={Cloud}
                title="Object Storage S3"
                description={neonStorage
                  ? "Bucket privat, diakses melalui proxy aplikasi."
                  : "Object storage belum dikonfigurasi. Unggahan tidak dapat disimpan."}
                configured={neonStorage}
              />
              <div className="flex items-start gap-3">
                <Smartphone className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-sm font-medium">PWA & GPS</p>
                  <p className="text-xs text-muted-foreground">
                    Pasang ke layar utama. GPS memerlukan HTTPS atau localhost.
                  </p>
                </div>
                <Badge variant="success-light">Siap</Badge>
              </div>
            </ProfileSection>
          )}
        </div>
      </div>
    </div>
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
      className="group flex min-w-0 items-center gap-3 py-3 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="hidden text-xs text-muted-foreground sm:block">{description}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

function IntegrationRow({
  icon: Icon,
  title,
  description,
  configured,
}: {
  icon: typeof ArrowRight;
  title: string;
  description: string;
  configured: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{title}</p>
          <Badge variant={configured ? "success-light" : "warning-light"}>
            {configured ? "Dikonfigurasi" : "Belum dikonfigurasi"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
