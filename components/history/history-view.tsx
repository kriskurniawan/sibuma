"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  History,
  Search,
  TimerReset,
  X,
} from "lucide-react";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import {
  AttendanceBadge,
  EmptyState,
  PageHeader,
  SpklStatusBadge,
  StatCard,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SPKL_STATUS_LABEL } from "@/lib/constants";
import type { SpklListItem, SpklStatus } from "@/lib/types";
import type { WorkerOverview } from "@/lib/queries";
import { durationLabel, formatDateHuman, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ value: "semua" | SpklStatus; label: string }> = [
  { value: "semua", label: "Semua" },
  { value: "berlangsung", label: SPKL_STATUS_LABEL.berlangsung },
  { value: "terjadwal", label: SPKL_STATUS_LABEL.terjadwal },
  { value: "selesai", label: SPKL_STATUS_LABEL.selesai },
  { value: "dibatalkan", label: SPKL_STATUS_LABEL.dibatalkan },
];

function HistoryRow({ item }: { item: SpklListItem }) {
  const { spkl, status, myAttendance, documentationCount } = item;

  return (
    <Link
      href={`/spkl/${spkl.id}`}
      className={cn(
        "group -mx-4 flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none",
        status === "dibatalkan" && "opacity-70",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 text-sm font-medium text-foreground">
            {spkl.title}
          </span>
          {myAttendance ? (
            <AttendanceBadge status={myAttendance.status} />
          ) : (
            <SpklStatusBadge status={status} />
          )}
        </div>
        <span className="truncate text-xs font-medium text-muted-foreground">
          {spkl.number}
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="size-3.5 shrink-0" />
            {formatDateHuman(spkl.startAt, "d MMM yyyy")}
          </span>
          <span className="flex items-center gap-1">
            <Clock3 className="size-3.5 shrink-0" />
            <span className="tabular-nums">
              {formatTime(spkl.startAt)}–{formatTime(spkl.endAt)} WIB
            </span>
          </span>
          <span className="flex items-center gap-1">
            <TimerReset className="size-3.5 shrink-0" />
            <span className="tabular-nums">
              {durationLabel(myAttendance?.durationMinutes ?? null)}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <Camera className="size-3.5 shrink-0" />
            {documentationCount} foto
          </span>
        </div>
      </div>
      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
    </Link>
  );
}

export function HistoryView({ overview }: { overview: WorkerOverview }) {
  const [filter, setFilter] = useState<"semua" | SpklStatus>("semua");
  const [search, setSearch] = useState("");

  const sorted = useMemo(
    () =>
      [...overview.items].sort(
        (a, b) =>
          new Date(b.spkl.startAt).getTime() -
          new Date(a.spkl.startAt).getTime(),
      ),
    [overview.items],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sorted.filter((item) => {
      if (filter !== "semua" && item.status !== filter) return false;
      if (!query) return true;
      return `${item.spkl.title} ${item.spkl.number} ${item.spkl.location.address ?? ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [filter, search, sorted]);

  const grouped = useMemo(() => {
    const groups = new Map<string, SpklListItem[]>();
    for (const item of filtered) {
      const label = formatDateHuman(item.spkl.startAt, "MMMM yyyy");
      const existing = groups.get(label) ?? [];
      existing.push(item);
      groups.set(label, existing);
    }
    return [...groups.entries()];
  }, [filtered]);

  const counts = useMemo(() => {
    const value: Record<string, number> = { semua: overview.items.length };
    for (const item of overview.items) {
      value[item.status] = (value[item.status] ?? 0) + 1;
    }
    return value;
  }, [overview.items]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Arsip pribadi"
        title="Riwayat lembur."
        description="Semua SPKL yang pernah dan akan kamu jalani, lengkap dengan durasi, kehadiran, dan dokumentasi."
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/" />}
          >
            <CalendarDays />
            Kembali ke beranda
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total bulan ini"
          value={Math.floor(overview.stats.monthlyMinutes / 60)}
          suffix="jam"
          icon={Clock3}
          helper={`${overview.stats.monthlyMinutes % 60} menit · target 20 jam`}
          tone="primary"
        />
        <StatCard
          label="Sesi selesai"
          value={overview.stats.completedSessions}
          suffix="sesi"
          icon={CheckCircle2}
          helper={`${overview.stats.monthlySessions} sesi memiliki absensi masuk`}
          tone="success"
        />
        <StatCard
          label="Dokumentasi"
          value={overview.stats.documentationCount}
          suffix="foto"
          icon={Camera}
          helper="Bukti kerja yang kamu unggah bulan ini"
          tone="info"
        />
      </div>

      <Frame>
        <FrameHeader className="gap-3">
          <div className="flex flex-col gap-1">
            <FrameTitle>Riwayat per bulan</FrameTitle>
            <FrameDescription className="text-xs">
              Dikelompokkan berdasarkan bulan mulai, terbaru di atas.
            </FrameDescription>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="no-scrollbar -mx-1 min-w-0 overflow-x-auto px-1">
              <Tabs
                value={filter}
                onValueChange={(value) =>
                  setFilter(value as "semua" | SpklStatus)
                }
              >
                <TabsList className="w-max">
                  {FILTERS.map((item) => {
                    const count = counts[item.value] ?? 0;
                    return (
                      <TabsTrigger key={item.value} value={item.value}>
                        {item.label}
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                          {count}
                        </span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            </div>

            <InputGroup className="w-full lg:w-64">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama atau nomor SPKL…"
                aria-label="Cari riwayat SPKL"
              />
              {search && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    onClick={() => setSearch("")}
                    aria-label="Hapus pencarian"
                  >
                    <X />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
          </div>
        </FrameHeader>

        {grouped.length > 0 ? (
          <FramePanel className="flex flex-col gap-6">
            {grouped.map(([month, items]) => (
              <section key={month} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {month}
                  </h2>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {items.length} SPKL
                  </span>
                </div>
                <div className="flex flex-col divide-y divide-border/70">
                  {items.map((item) => (
                    <HistoryRow key={item.spkl.id} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </FramePanel>
        ) : (
          <FramePanel>
            <EmptyState
              icon={History}
              title={
                search
                  ? "Tidak ada SPKL yang cocok"
                  : "Belum ada riwayat pada filter ini"
              }
              description={
                search
                  ? "Coba kata kunci lain atau hapus pencarian."
                  : "Penugasan lembur dari atasan akan muncul di sini setelah dibuat."
              }
              action={
                search || filter !== "semua" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setFilter("semua");
                    }}
                  >
                    <TimerReset />
                    Tampilkan semua riwayat
                  </Button>
                ) : (
                  <Button nativeButton={false} render={<Link href="/" />}>
                    <TimerReset />
                    Kembali ke beranda
                  </Button>
                )
              }
            />
          </FramePanel>
        )}

        <FrameFooter className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2">
            <Download className="mt-0.5 size-3.5 shrink-0" />
            Butuh rekap untuk keperluan pribadi? Hubungi atasanmu untuk ekspor
            laporan tim.
          </p>
          <p className="flex items-center gap-2">
            <Clock3 className="size-3 shrink-0" />
            Semua waktu dalam WIB
          </p>
        </FrameFooter>
      </Frame>

      {overview.items.some((item) => item.status === "berlangsung") && (
        <p className="text-center text-xs font-medium text-muted-foreground">
          Kamu memiliki sesi aktif. Buka detail SPKL untuk absen pulang atau
          menambah dokumentasi.
        </p>
      )}
    </div>
  );
}
