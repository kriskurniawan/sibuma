"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  ChevronsUpDown,
  ClipboardCheck,
  Clock3,
  History,
  Home,
  Loader2,
  LogOut,
  QrCode,
  ScrollText,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { QrScanButton } from "@/components/checklist/qr-scanner";
import { LogoMark } from "@/components/logo";
import { Avatar } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { avatarUrl } from "@/lib/avatar-url";
import { ROLE_LABEL } from "@/lib/constants";
import { formatDateHuman } from "@/lib/time";
import type { SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
}

function navigationFor(role: SessionUser["role"]): {
  main: NavItem[];
  manage: NavItem[];
  mobile: NavItem[];
} {
  if (role === "super_admin") {
    return {
      main: [
        { href: "/", label: "Beranda", icon: Home, exact: true },
        { href: "/laporan", label: "Laporan & rekap", icon: BarChart3 },
      ],
      manage: [
        { href: "/tim", label: "Akun atasan", icon: UsersRound },
        { href: "/audit", label: "Log audit", icon: ScrollText },
        { href: "/pengaturan", label: "Pengaturan", icon: SlidersHorizontal },
      ],
      mobile: [
        { href: "/", label: "Beranda", icon: Home, exact: true },
        { href: "/tim", label: "Atasan", icon: UsersRound },
        { href: "/laporan", label: "Laporan", icon: BarChart3 },
        { href: "/audit", label: "Audit", icon: ScrollText },
        { href: "/profil", label: "Profil", icon: UserRound },
      ],
    };
  }

  if (role === "atasan") {
    return {
      main: [
        { href: "/", label: "Beranda", icon: Home, exact: true },
        { href: "/checklist", label: "Checklist", icon: ClipboardCheck },
        { href: "/lembur", label: "Lembur", icon: Clock3 },
        { href: "/laporan", label: "Laporan & rekap", icon: BarChart3 },
      ],
      manage: [
        { href: "/tim", label: "Tim", icon: UsersRound },
        { href: "/checklist/template", label: "Template checklist", icon: Settings2 },
        { href: "/checklist/jadwal", label: "Jadwal checklist", icon: CalendarClock },
        { href: "/checklist/qr", label: "QR area", icon: QrCode },
        { href: "/audit", label: "Log audit", icon: ScrollText },
      ],
      mobile: [
        { href: "/", label: "Beranda", icon: Home, exact: true },
        { href: "/checklist", label: "Checklist", icon: ClipboardCheck },
        { href: "/lembur", label: "Lembur", icon: Clock3 },
        { href: "/laporan", label: "Laporan", icon: BarChart3 },
      ],
    };
  }

  return {
    main: [
      { href: "/", label: "Beranda", icon: Home, exact: true },
      { href: "/checklist", label: "Checklist", icon: ClipboardCheck },
      { href: "/riwayat", label: "Riwayat lembur", icon: History },
    ],
    manage: [],
    mobile: [
      { href: "/", label: "Beranda", icon: Home, exact: true },
      { href: "/checklist", label: "Checklist", icon: ClipboardCheck },
      { href: "/riwayat", label: "Riwayat", icon: History },
      { href: "/profil", label: "Profil", icon: UserRound },
    ],
  };
}

function isCurrent(pathname: string, item: NavItem) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function currentSectionLabel(
  pathname: string,
  nav: ReturnType<typeof navigationFor>,
) {
  if (pathname === "/profil") return "Profil saya";
  if (pathname.startsWith("/spkl/baru")) return "Buat SPKL";
  if (pathname.startsWith("/spkl/")) return "Detail SPKL";
  if (pathname.startsWith("/checklist/tindak-lanjut")) return "Tindak lanjut";
  if (pathname === "/checklist/qr") return "QR area";
  if (pathname.startsWith("/checklist/template/")) return "Detail template";
  if (pathname === "/checklist/template") return "Template checklist";
  if (pathname === "/checklist/jadwal") return "Jadwal checklist";
  if (pathname.startsWith("/checklist/") && pathname !== "/checklist/") {
    return "Detail checklist";
  }

  const match = [...nav.main, ...nav.manage]
    .filter((item) => isCurrent(pathname, item))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return match?.label ?? "Ruang kerja";
}

/** Close the mobile sidebar sheet after navigating to another page. */
function CloseMobileSidebarOnNavigate() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  return null;
}

function NavRows({
  items,
  pathname,
}: {
  items: NavItem[];
  pathname: string;
}) {
  return (
    <SidebarMenu className="gap-1">
      {items.map((item) => {
        const active = isCurrent(pathname, item);
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              isActive={active}
              tooltip={item.label}
              render={
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                />
              }
            >
              <item.icon
                strokeWidth={active ? 2.1 : 1.8}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">
                {item.label}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = navigationFor(user.role);
  const mobileNav: Array<NavItem | "scan"> = [...nav.mobile];
  if (user.role !== "super_admin") {
    mobileNav.splice(Math.floor(mobileNav.length / 2), 0, "scan");
  }
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Sampai jumpa!");
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
      toast.error("Gagal keluar. Coba lagi.");
    }
  }

  const todayLabel = formatDateHuman(new Date().toISOString(), "EEEE, d MMMM");
  const sectionLabel = currentSectionLabel(pathname, nav);
  const firstName = user.name.split(" ")[0];

  return (
    <SidebarProvider className="print:block">
      <CloseMobileSidebarOnNavigate />
      <Sidebar collapsible="icon" className="no-print">
        <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                tooltip="SIBUMA — Beranda"
                render={<Link href="/" aria-label="SIBUMA — Beranda" />}
              >
                <LogoMark className="size-8" />
                <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-sm font-semibold tracking-[0.04em] text-sidebar-foreground">
                    SIBUMA
                  </span>
                  <span className="truncate text-xs font-normal text-sidebar-foreground/60">
                    Sistem Building Management
                  </span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Ruang kerja</SidebarGroupLabel>
            <SidebarGroupContent>
              <NavRows items={nav.main} pathname={pathname} />
            </SidebarGroupContent>
          </SidebarGroup>

          {nav.manage.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Kelola</SidebarGroupLabel>
              <SidebarGroupContent>
                <NavRows items={nav.manage} pathname={pathname} />
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      type="button"
                      size="lg"
                      tooltip="Akun saya"
                      className="aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground"
                    />
                  }
                >
                  <Avatar
                    name={user.name}
                    seed={user.id}
                    src={avatarUrl(user.id, user.avatarKey)}
                    size="md"
                  />
                  <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm font-medium text-sidebar-foreground">
                      {user.name}
                    </span>
                    <span className="truncate text-xs font-normal text-sidebar-foreground/60">
                      {ROLE_LABEL[user.role]} · {user.nik}
                    </span>
                  </span>
                  <ChevronsUpDown
                    className="ml-auto size-3.5 text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden"
                    aria-hidden="true"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" className="min-w-52">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Akun saya</DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem render={<Link href="/profil" />}>
                      <UserRound aria-hidden="true" />
                      Profil saya
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={loggingOut}
                      onClick={logout}
                    >
                      {loggingOut ? (
                        <Loader2 className="animate-spin" aria-hidden="true" />
                      ) : (
                        <LogOut aria-hidden="true" />
                      )}
                      {loggingOut ? "Keluar…" : "Keluar"}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>

          <p className="flex items-center gap-1.5 px-2 pb-1 text-xs text-sidebar-foreground/45 group-data-[collapsible=icon]:hidden">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Waktu server · jejak audit aktif
          </p>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="print-full min-w-0">
        <header className="no-print sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 sm:px-5">
          <SidebarTrigger className="-ml-1" aria-label="Buka atau tutup menu" />
          <Separator orientation="vertical" className="h-4!" />
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {sectionLabel}
            </span>
            <span className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              <span suppressHydrationWarning className="capitalize">
                {todayLabel}
              </span>
              <span className="text-muted-foreground/60">· WIB</span>
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="hidden gap-2 sm:inline-flex"
              nativeButton={false}
              render={<Link href="/profil" />}
            >
              <Avatar
                name={user.name}
                seed={user.id}
                src={avatarUrl(user.id, user.avatarKey)}
                size="xs"
              />
              <span className="max-w-36 truncate">{firstName}</span>
            </Button>
            <Link
              href="/profil"
              aria-label="Profil saya"
              className="rounded-full sm:hidden"
            >
              <Avatar
                name={user.name}
                seed={user.id}
                src={avatarUrl(user.id, user.avatarKey)}
                size="sm"
              />
            </Link>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[90rem] flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-12">
          {children}
        </div>
      </SidebarInset>

      <nav
        aria-label="Navigasi utama"
        className="no-print safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/95 px-2 pt-1 backdrop-blur-xl md:hidden"
      >
        <div
          className={cn(
            "mx-auto grid max-w-md",
            mobileNav.length === 3
              ? "grid-cols-3"
              : mobileNav.length === 4
                ? "grid-cols-4"
                : "grid-cols-5",
          )}
        >
          {mobileNav.map((item) => {
            if (item === "scan") {
              return (
                <QrScanButton
                  key="scan"
                  trigger={(openScanner) => (
                    <button
                      type="button"
                      onClick={openScanner}
                      aria-label="Scan QR area"
                      aria-haspopup="dialog"
                      className="group -mt-4 flex flex-col items-center gap-1 rounded-lg px-2 pb-2 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-card transition-colors group-hover:bg-primary/80 group-active:translate-y-px">
                        <QrCode
                          className="size-6"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      </span>
                      Scan
                    </button>
                  )}
                />
              );
            }

            const active = isCurrent(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "group-hover:bg-muted",
                  )}
                >
                  <item.icon
                    className="size-4"
                    strokeWidth={active ? 2.2 : 1.8}
                    aria-hidden="true"
                  />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </SidebarProvider>
  );
}
