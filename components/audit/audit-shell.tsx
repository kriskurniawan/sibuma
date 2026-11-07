"use client";

import { Suspense, useState, type ReactNode } from "react";
import { Bell, ScrollText, Search, ShieldCheck, X } from "lucide-react";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FrameTitle,
} from "@/components/reui/frame";
import { PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AuditEntries,
  AuditStats,
  AuditTabCount,
  AuditTypeCount,
} from "@/components/audit/audit-view";
import {
  AuditRowsSkeleton,
  AuditStatsSkeleton,
} from "@/components/audit/audit-skeleton";
import type { AuditDataPromise } from "@/components/audit/audit-data";
import { useSessionUser } from "@/components/session-user-provider";
import { isReadOnly, isSuperAdmin } from "@/lib/access";
import type { AuditLog } from "@/lib/types";

type AuditTab = "audit" | "notifikasi";
type AuditType = AuditLog["objectType"];
import {
  AuditFilterContext,
  useAuditFilters,
} from "@/components/audit/audit-filter-context";
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

function AuditToolbar({
  notifications,
  dataPromise,
}: {
  notifications?: boolean;
  dataPromise?: AuditDataPromise;
}) {
  const filters = useAuditFilters();
  const search = notifications ? filters.notificationSearch : filters.search;
  const setSearch = notifications
    ? filters.setNotificationSearch
    : filters.setSearch;
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 max-w-full items-center gap-1.5 overflow-x-auto lg:flex-wrap">
        {notifications
          ? (
              [
                { value: "semua", label: "Semua" },
                { value: "menunggu", label: "Menunggu" },
                { value: "terkirim", label: "Terkirim" },
                { value: "gagal", label: "Gagal" },
              ] as const
            ).map((item) => (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={
                  filters.notificationStatus === item.value
                    ? "default"
                    : "outline"
                }
                aria-pressed={filters.notificationStatus === item.value}
                onClick={() => filters.setNotificationStatus(item.value)}
              >
                {item.label}
              </Button>
            ))
          : AUDIT_FILTERS.map((item) => (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={
                  filters.typeFilter === item.value ? "default" : "outline"
                }
                aria-pressed={filters.typeFilter === item.value}
                onClick={() => filters.setTypeFilter(item.value)}
              >
                {item.label}
                <Suspense fallback={<Skeleton className="h-3 w-3" />}>
                  <AuditTypeCount dataPromise={dataPromise} type={item.value} />
                </Suspense>
              </Button>
            ))}
      </div>
      <InputGroup className="w-full lg:w-64">
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={
            notifications
              ? "Cari nomor atau isi pesan…"
              : "Cari aktor, ringkasan, objek…"
          }
          aria-label={notifications ? "Cari outbox WhatsApp" : "Cari log audit"}
        />
        {search && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              size="icon-xs"
              onClick={() => setSearch("")}
              aria-label="Hapus pencarian"
            >
              <X aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </div>
  );
}

export function AuditShell({
  dataPromise,
}: {
  dataPromise?: AuditDataPromise;
}) {
  const user = useSessionUser();
  const [tab, setTab] = useState<AuditTab>("audit");
  const [typeFilter, setTypeFilter] = useState<"semua" | AuditType>("semua");
  const [search, setSearch] = useState("");
  const [notificationSearch, setNotificationSearch] = useState("");
  const [notificationStatus, setNotificationStatus] = useState<
    "semua" | "terkirim" | "gagal" | "menunggu"
  >("semua");
  if ((user.role !== "atasan" && !isSuperAdmin(user)) || isReadOnly(user))
    return null;
  const count = (kind: AuditTab): ReactNode => (
    <Suspense fallback={<Skeleton className="h-4 w-5" />}>
      <AuditTabCount dataPromise={dataPromise} tab={kind} />
    </Suspense>
  );
  return (
    <AuditFilterContext.Provider
      value={{
        tab,
        setTab,
        typeFilter,
        setTypeFilter,
        search,
        setSearch,
        notificationSearch,
        setNotificationSearch,
        notificationStatus,
        setNotificationStatus,
      }}
    >
      <div className="flex min-w-0 flex-col gap-6">
        <PageHeader
          mobileCompact
          eyebrow="Transparansi & jejak"
          title="Log audit."
          description="Riwayat perubahan dan pengiriman notifikasi WhatsApp."
          descriptionClassName="hidden md:block"
        />
        <Suspense fallback={<AuditStatsSkeleton />}>
          <AuditStats dataPromise={dataPromise} />
        </Suspense>
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as AuditTab)}
          className="min-w-0 gap-6"
        >
          <TabsList className="w-full">
            <TabsTrigger value="audit">
              <ScrollText aria-hidden="true" />
              Log audit{count("audit")}
            </TabsTrigger>
            <TabsTrigger value="notifikasi">
              <Bell aria-hidden="true" />
              Outbox{count("notifikasi")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="audit">
            <Frame spacing="default" className="min-w-0">
              <FrameHeader className="gap-3">
                <div className="flex flex-col gap-1">
                  <FrameTitle className="max-md:sr-only">Log audit</FrameTitle>
                  <FrameDescription className="text-xs">
                    Peristiwa terbaru
                  </FrameDescription>
                </div>
                <AuditToolbar dataPromise={dataPromise} />
              </FrameHeader>
              <Suspense fallback={<AuditRowsSkeleton />}>
                <AuditEntries dataPromise={dataPromise} />
              </Suspense>
              <FrameFooter className="hidden flex-row items-start gap-2 text-xs text-muted-foreground md:flex">
                <ShieldCheck
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                Log audit tidak dapat diubah atau dihapus dari aplikasi.
              </FrameFooter>
            </Frame>
          </TabsContent>
          <TabsContent value="notifikasi">
            <Frame spacing="default" className="min-w-0">
              <FrameHeader className="gap-3">
                <div className="flex flex-col gap-1">
                  <FrameTitle className="max-md:sr-only">
                    Outbox WhatsApp
                  </FrameTitle>
                  <FrameDescription className="text-xs">
                    Pesan terbaru
                  </FrameDescription>
                </div>
                <AuditToolbar notifications dataPromise={dataPromise} />
              </FrameHeader>
              <Suspense fallback={<AuditRowsSkeleton />}>
                <AuditEntries notifications dataPromise={dataPromise} />
              </Suspense>
            </Frame>
          </TabsContent>
        </Tabs>
      </div>
    </AuditFilterContext.Provider>
  );
}
