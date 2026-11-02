import { CheckCircle2, Clock3, ListChecks, LoaderCircle } from "lucide-react";
import { DataLoadError } from "@/components/data-load-error";
import { MobileSummary } from "@/components/mobile-summary";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function SummaryStatSkeleton({ label, helper, suffix }: { label: string; helper?: string; suffix?: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="text-xs font-medium">{label}</CardDescription>
        <CardAction><Skeleton className="size-8" /></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-baseline gap-1.5">
          <Skeleton className="h-8 w-12" />
          {suffix && <span className="text-xs font-medium text-muted-foreground">{suffix}</span>}
        </div>
        {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : <Skeleton className="h-4 w-16" />}
      </CardContent>
    </Card>
  );
}

export function ChecklistSubmenuDataError({ message }: { message: string }) {
  return (
    <Frame>
      <FramePanel>
        <DataLoadError message={message} />
      </FramePanel>
    </Frame>
  );
}

function SetupListRowSkeleton() {
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-start gap-2.5">
        <Skeleton className="mt-0.5 size-4 shrink-0" />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Skeleton className="h-4 w-32 max-w-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3 w-40 max-w-full" />
          <Skeleton className="hidden h-3 w-56 max-w-full md:block" />
        </div>
      </div>
      <Skeleton className="h-7 w-16 shrink-0" />
    </li>
  );
}

export function ChecklistTemplateDataSkeleton() {
  return (
    <div aria-busy="true" role="status" className="contents">
      <span className="sr-only">Memuat template dan lokasi…</span>
      {[
        { title: "Lokasi", description: "Lokasi aktif tersedia untuk jadwal baru." },
        { title: "Template", description: "Item pemeriksaan dan kebijakan pengisian." },
      ].map((section) => (
        <Frame key={section.title} spacing="default" className="min-w-0">
          <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <FrameTitle>{section.title}</FrameTitle>
              <FrameDescription className="hidden text-xs md:block">{section.description}</FrameDescription>
            </div>
            <Skeleton className="h-5 w-8" />
          </FrameHeader>
          <FramePanel className="p-0">
            <ul className="divide-y divide-border/70" aria-hidden="true">
              {Array.from({ length: 3 }, (_, index) => <SetupListRowSkeleton key={index} />)}
            </ul>
          </FramePanel>
        </Frame>
      ))}
    </div>
  );
}

function ScheduleRowSkeleton() {
  return (
    <li className="flex flex-col gap-2.5 px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-48 max-w-full" />
        </div>
        <Skeleton className="h-7 w-16 shrink-0" />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-40 max-w-full" />
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="hidden items-center md:flex">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="-ml-2 size-6 rounded-full" />
        <Skeleton className="-ml-2 size-6 rounded-full" />
      </div>
    </li>
  );
}

export function ChecklistScheduleDataSkeleton() {
  return (
    <Frame spacing="default" className="min-w-0" aria-busy="true" role="status">
      <span className="sr-only">Memuat jadwal checklist…</span>
      <div className="hidden md:block">
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Jadwal checklist</FrameTitle>
            <FrameDescription className="text-xs">Template, lokasi, dan anggota yang ditugaskan.</FrameDescription>
          </div>
          <Skeleton className="h-5 w-8" />
        </FrameHeader>
      </div>
      <FramePanel className="p-0">
        <ul className="divide-y divide-border/70" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => <ScheduleRowSkeleton key={index} />)}
        </ul>
      </FramePanel>
    </Frame>
  );
}

export function ChecklistQrDataSkeleton() {
  return (
    <div aria-busy="true" role="status" className="contents">
      <span className="sr-only">Memuat QR area…</span>
      <MobileSummary
        columns={3}
        className="md:hidden"
        items={[
          { label: "QR aktif", value: <Skeleton className="h-7 w-12" />, tone: "primary" },
          { label: "QR langsung", value: <Skeleton className="h-7 w-12" />, tone: "info" },
          { label: "Area publik", value: <Skeleton className="h-7 w-12" />, tone: "success" },
        ]}
      />
      <div className="hidden gap-3 md:grid md:grid-cols-3">
        <SummaryStatSkeleton label="Total QR" />
        <SummaryStatSkeleton label="QR area langsung" helper="Langsung membuka satu area" />
        <SummaryStatSkeleton label="Area publik" helper="Tampil di QR pilih area" />
      </div>
      <Frame spacing="default" className="min-w-0">
        <div className="hidden md:block">
          <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <FrameTitle>Daftar QR</FrameTitle>
              <FrameDescription className="text-xs">Tautan tetap; nonaktifkan QR yang tidak dipakai.</FrameDescription>
            </div>
            <Skeleton className="h-5 w-8" />
          </FrameHeader>
        </div>
        <FramePanel className="p-0">
          <ul className="divide-y divide-border/70" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <li key={index} className="flex flex-col gap-3 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Skeleton className="mt-0.5 size-4 shrink-0" />
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Skeleton className="h-4 w-32 max-w-full" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </div>
                      <Skeleton className="hidden h-3 w-44 max-w-full md:block" />
                    </div>
                  </div>
                  <div className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto">
                    {Array.from({ length: 5 }, (_, action) => <Skeleton key={action} className="h-7 w-16 shrink-0" />)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </FramePanel>
      </Frame>
    </div>
  );
}

export function ChecklistFollowUpSummarySkeleton() {
  return (
    <div aria-busy="true" role="status" className="contents">
      <span className="sr-only">Memuat ringkasan tindak lanjut…</span>
      <MobileSummary
        className="md:hidden"
        items={[
          { label: "Belum selesai", value: <Skeleton className="h-7 w-12" />, icon: ListChecks, tone: "neutral" },
          { label: "Diproses", value: <Skeleton className="h-7 w-12" />, icon: LoaderCircle, tone: "primary" },
          { label: "Terlambat", value: <Skeleton className="h-7 w-12" />, icon: Clock3, tone: "neutral" },
          { label: "Selesai bulan ini", value: <Skeleton className="h-7 w-12" />, icon: CheckCircle2, tone: "success" },
        ]}
      />
      <div className="hidden grid-cols-2 gap-4 md:grid xl:grid-cols-4">
        <SummaryStatSkeleton label="Belum selesai" suffix="temuan" helper="Terbuka, diproses, atau tertunda" />
        <SummaryStatSkeleton label="Sedang diproses" suffix="temuan" helper="Sudah mulai ditangani PIC" />
        <SummaryStatSkeleton label="Terlambat" suffix="temuan" helper="Melewati deadline tindak lanjut" />
        <SummaryStatSkeleton label="Selesai bulan ini" suffix="temuan" helper="Dihitung dari waktu penyelesaian" />
      </div>
    </div>
  );
}

function FollowUpMobileRowSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Skeleton className="h-4 w-48 max-w-full" />
          <Skeleton className="h-3 w-36 max-w-full" />
        </div>
        <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
      </div>
      <Skeleton className="h-3 w-3/4 max-w-full" />
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-24 max-w-full" />
        </div>
        <Skeleton className="h-7 w-24 shrink-0" />
      </div>
    </div>
  );
}

function FollowUpTableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-3.5 w-40 max-w-full" />
        <Skeleton className="h-3 w-28 max-w-full" />
      </div>
      <Skeleton className="hidden h-3 w-24 shrink-0 lg:block" />
      <div className="hidden min-w-0 flex-col gap-1 xl:flex">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="hidden h-5 w-16 shrink-0 rounded-full lg:block" />
      <Skeleton className="hidden h-5 w-20 shrink-0 rounded-full xl:block" />
      <Skeleton className="h-7 w-20 shrink-0" />
    </div>
  );
}

export function ChecklistFollowUpDataSkeleton() {
  return (
    <div aria-busy="true" role="status">
      <span className="sr-only">Memuat daftar tindak lanjut…</span>
      <div className="border-b border-border px-4 py-3"><Skeleton className="h-4 w-36" /></div>
      <div className="hidden divide-y divide-border/70 md:block" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => <FollowUpTableRowSkeleton key={index} />)}
      </div>
      <div className="divide-y divide-border/70 md:hidden" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => <FollowUpMobileRowSkeleton key={index} />)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-2" aria-hidden="true">
        <Skeleton className="h-3 w-44 max-w-full" />
        <Skeleton className="h-7 w-40 max-w-full" />
      </div>
    </div>
  );
}
