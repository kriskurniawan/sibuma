import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  ChevronRight,
  ListChecks,
  QrCode,
  ScrollText,
  Settings2,
  ShieldCheck,
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
import { IconTile } from "@/components/reui/icon-tile";
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
      ],
    },
    {
      title: "Rekap & pemantauan",
      description: "Lihat hasil kerja dan jejak aktivitas tim.",
      items: [
        {
          href: "/laporan",
          label: "Laporan & rekap",
          description: "Checklist, temuan, dan lembur tim.",
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
    <Frame stacked spacing="sm">
      <FrameHeader>
        <FrameTitle>{group.title}</FrameTitle>
        <FrameDescription className="text-xs">
          {group.description}
        </FrameDescription>
      </FrameHeader>
      <FramePanel className="p-0">
        <div className="divide-y divide-border/70">
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
            >
              <IconTile variant="soft" size="sm" aria-hidden="true">
                <item.icon strokeWidth={2} />
              </IconTile>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  {item.label}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {item.description}
                </span>
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
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
    <div className="flex flex-col gap-5 md:gap-6">
      <Frame spacing="sm">
        <FramePanel className="p-0">
          <Link
            href="/profil"
            className="group flex items-center gap-3 p-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
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
              <span className="truncate text-xs text-muted-foreground">
                {ROLE_LABEL[user.role]} · NIK {user.nik}
              </span>
            </span>
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
              aria-hidden="true"
            />
          </Link>
        </FramePanel>
      </Frame>

      {groups.map((group) => (
        <MenuGroup key={group.title} group={group} />
      ))}

      <Frame stacked spacing="sm">
        <FrameHeader>
          <FrameTitle>Akun</FrameTitle>
          <FrameDescription className="text-xs">
            Keluar akan mengakhiri sesi pada perangkat ini. Kamu perlu kode OTP
            baru untuk masuk kembali.
          </FrameDescription>
        </FrameHeader>
        <FramePanel>
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Sesi aman · jejak audit aktif
            </p>
            <ProfileActions />
          </div>
        </FramePanel>
      </Frame>
    </div>
  );
}
