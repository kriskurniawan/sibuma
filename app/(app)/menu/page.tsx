import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  ChevronRight,
  Hammer,
  ListChecks,
  QrCode,
  ScrollText,
  Settings2,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";
import { ProfileActions } from "@/components/profile/profile-actions";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Avatar } from "@/components/ui";
import { isReadOnly } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { avatarUrl } from "@/lib/avatar-url";
import { ROLE_LABEL } from "@/lib/constants";
import type { SessionUser } from "@/lib/types";

export const metadata = { title: "Menu" };

interface MenuEntry {
  href: string;
  label: string;
  description: string;
  icon: typeof UsersRound;
}

interface MenuGroupData {
  title: string;
  description: string;
  items: MenuEntry[];
}

const GROUPS: Record<"atasan" | "super_admin", MenuGroupData[]> = {
  atasan: [
    {
      title: "Tim & operasional",
      description: "Siapkan pekerja, area, dan jadwal pemeriksaan.",
      items: [
        {
          href: "/tim",
          label: "Tim",
          description: "Anggota, divisi, dan penugasan.",
          icon: UsersRound,
        },
        {
          href: "/checklist/template",
          label: "Template checklist",
          description: "Susun item dan bukti yang diminta.",
          icon: Settings2,
        },
        {
          href: "/checklist/jadwal",
          label: "Jadwal checklist",
          description: "Frekuensi, area, dan anggota yang bertugas.",
          icon: CalendarClock,
        },
        {
          href: "/checklist/qr",
          label: "QR area",
          description: "Cetak dan kelola QR untuk tiap lokasi.",
          icon: QrCode,
        },
        {
          href: "/checklist/tindak-lanjut",
          label: "Tindak lanjut",
          description: "Temuan yang masih terbuka atau diproses.",
          icon: ListChecks,
        },
        {
          href: "/pekerjaan",
          label: "Pekerjaan harian",
          description: "Pekerjaan harian beserta dokumentasi foto.",
          icon: Hammer,
        },
      ],
    },
    {
      title: "Rekap & pemantauan",
      description: "Lihat hasil kerja dan jejak aktivitas tim.",
      items: [
        {
          href: "/laporan",
          label: "Laporan & rekap",
          description: "Checklist, temuan, pekerjaan harian, dan lembur tim.",
          icon: BarChart3,
        },
        {
          href: "/audit",
          label: "Log audit",
          description: "Riwayat perubahan dan aktivitas penting.",
          icon: ScrollText,
        },
      ],
    },
  ],
  super_admin: [
    {
      title: "Operasional",
      description: "Pantau pekerjaan lintas atasan.",
      items: [
        {
          href: "/tim",
          label: "Akun atasan",
          description: "Kelola akun atasan dan aksesnya.",
          icon: UsersRound,
        },
        {
          href: "/laporan",
          label: "Laporan & rekap",
          description: "Ringkasan operasional seluruh perusahaan.",
          icon: BarChart3,
        },
        {
          href: "/audit",
          label: "Log audit",
          description: "Riwayat perubahan dan aktivitas penting.",
          icon: ScrollText,
        },
      ],
    },
    {
      title: "Sistem",
      description: "Kebijakan aplikasi dan batas operasional.",
      items: [
        {
          href: "/pengaturan",
          label: "Pengaturan",
          description: "Kebijakan lembur, checklist, dan aplikasi.",
          icon: SlidersHorizontal,
        },
      ],
    },
  ],
};

function MenuGroup({ group }: { group: MenuGroupData }) {
  return (
    <Frame stacked spacing="default" className="min-w-0">
      <FrameHeader>
        <FrameTitle>{group.title}</FrameTitle>
        <FrameDescription className="hidden text-xs md:block">
          {group.description}
        </FrameDescription>
      </FrameHeader>
      <FramePanel>
        <nav aria-label={group.title} className="divide-y divide-border">
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex min-w-0 items-center gap-3 py-3 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <item.icon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="hidden text-xs text-muted-foreground md:block">
                  {item.description}
                </span>
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                aria-hidden="true"
              />
            </Link>
          ))}
        </nav>
      </FramePanel>
    </Frame>
  );
}

export default async function MenuPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Pekerja sudah punya Profil di bottom nav; Menu hanya untuk peran pengelola.
  if (user.role === "pekerja") redirect("/");

  const role = user.role as Extract<SessionUser["role"], "atasan" | "super_admin">;
  const readOnly = isReadOnly(user);
  const hiddenReadOnlyLinks = new Set([
    "/checklist/template",
    "/checklist/jadwal",
    "/checklist/qr",
    "/audit",
  ]);
  const groups = GROUPS[role]
    .map((group) => ({
      ...group,
      description:
        readOnly && group.title === "Tim & operasional"
          ? "Lihat pekerja, area, dan jadwal pemeriksaan."
          : group.description,
      items: group.items.filter(
        (item) => !readOnly || !hiddenReadOnlyLinks.has(item.href),
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Menu</h1>
      <Frame spacing="default">
        <FramePanel>
          <Link
            href="/profil"
            aria-label={`Profil ${user.name}`}
            className="group flex min-w-0 items-center gap-3 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Avatar
              name={user.name}
              seed={user.id}
              src={avatarUrl(user.id, user.avatarKey)}
              size="lg"
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-semibold text-foreground">
                {user.name}
              </span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{ROLE_LABEL[user.role]}</span>
                <span
                  aria-hidden="true"
                  className="size-1 shrink-0 rounded-full bg-muted-foreground/40"
                />
                <span>Lihat profil</span>
              </span>
            </span>
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
              aria-hidden="true"
            />
          </Link>
        </FramePanel>
      </Frame>

      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
        {groups.map((group) => (
          <MenuGroup key={group.title} group={group} />
        ))}
      </div>

      <Frame spacing="default">
        <FramePanel className="flex flex-col gap-3">
          <ProfileActions />
          <p className="text-xs text-muted-foreground">
            Keluar mengakhiri sesi perangkat ini. Perlu OTP baru untuk masuk kembali.
          </p>
        </FramePanel>
      </Frame>
    </div>
  );
}
