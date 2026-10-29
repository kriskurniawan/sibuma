"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  Info,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  Ruler,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { AttendanceDialog } from "@/components/spkl/attendance-dialog";
import { AttendanceSection } from "@/components/spkl/attendance-section";
import { DocumentationPanel } from "@/components/spkl/documentation-panel";
import { LiveDuration } from "@/components/spkl/live-duration";
import { SpklManageActions } from "@/components/spkl/spkl-manage-actions";
import { MapView, type MapMarker } from "@/components/maps/map-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert";
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
  AvatarStack,
  Badge,
  DataRow,
  ProgressBar,
  SpklStatusBadge,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { UPLOAD_MAX_BYTES, UPLOAD_MAX_PER_SESSION } from "@/lib/constants";
import { formatDistance } from "@/lib/geo";
import {
  attendanceStartAt,
  durationLabel,
  formatDateHuman,
  formatTime,
  isEarlyCheckIn,
} from "@/lib/time";
import type { SessionUser, SpklDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SpklDetailViewProps {
  user: SessionUser;
  detail: SpklDetail;
  policy: {
    maxGpsAccuracyMeters: number;
    docGraceMinutes: number;
    roundingMinutes: number;
  };
}

export function SpklDetailView({
  user,
  detail,
  policy,
}: SpklDetailViewProps) {
  const [dialog, setDialog] = useState<"checkin" | "checkout" | null>(null);
  const { spkl, status, myAttendance } = detail;
  const isWorker = user.role === "pekerja";
  const canViewTeam = !isWorker;
  const running = myAttendance?.status === "berjalan";
  const checkedInEarly = myAttendance?.checkInAt
    ? isEarlyCheckIn(myAttendance.checkInAt, spkl.startAt)
    : false;
  const earlyCheckIn = running && checkedInEarly;
  const countedFrom =
    running && myAttendance?.checkInAt
      ? attendanceStartAt(myAttendance.checkInAt, spkl.startAt)
      : spkl.startAt;
  const graceEnd = new Date(
    new Date(spkl.endAt).getTime() + policy.docGraceMinutes * 60_000,
  );
  const myDocCount = myAttendance
    ? detail.documentation.filter(
        (doc) => doc.attendanceId === myAttendance.id,
      ).length
    : 0;
  const presentCount = detail.attendances.filter(
    (row) => row.attendance?.checkInAt,
  ).length;
  const docsToday = detail.documentation.length;
  // Client clock for the upload-message wording only; detail.canUpload remains
  // the server-authoritative permission check.
  const now = Date.now();
  const graceExpired = now > graceEnd.getTime();

  const uploadBlockedReason = !isWorker
    ? "Hanya pekerja pada SPKL ini"
    : !myAttendance?.checkInAt
      ? "Absen masuk terlebih dahulu"
      : graceExpired
        ? "Masa unggah sudah berakhir"
        : myDocCount >= UPLOAD_MAX_PER_SESSION
          ? "Batas foto tercapai"
          : "Unggahan tidak tersedia";

  const markers: MapMarker[] = [
    {
      id: "site",
      latitude: spkl.location.latitude,
      longitude: spkl.location.longitude,
      label: spkl.location.address || "Titik absen SPKL",
      type: "site",
    },
    ...detail.attendances
      .filter((row) => row.attendance?.checkInLocation)
      .map((row) => {
        const point = row.attendance!.checkInLocation!;
        return {
          id: `worker-${row.employee.id}`,
          latitude: point.latitude,
          longitude: point.longitude,
          label: `${row.employee.name} · ${formatTime(row.attendance!.checkInAt ?? point.capturedAt)}`,
          type: "worker" as const,
        };
      }),
  ];

  const showCheckIn = isWorker && detail.canCheckIn;
  const showCheckOut = isWorker && detail.canCheckOut;
  const backTarget =
    user.role === "super_admin"
      ? { href: "/laporan", label: "Kembali ke laporan" }
      : user.role === "atasan"
        ? { href: "/lembur", label: "Kembali ke lembur" }
        : { href: "/riwayat", label: "Kembali ke riwayat" };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backTarget.href}
          className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
        >
          <ArrowLeft className="size-3.5" />
          {backTarget.label}
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SpklStatusBadge status={status} />
          {running && (
            <Badge variant="warning-light" dot>
              Sesi aktif
            </Badge>
          )}
          {earlyCheckIn && (
            <Badge variant="info-light">Absen lebih awal</Badge>
          )}
        </div>
      </div>

      {status === "dibatalkan" && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>SPKL ini dibatalkan</AlertTitle>
          <AlertDescription>
            {spkl.cancelReason || "Dibatalkan oleh atasan."} Absensi baru tidak
            dapat dilakukan.
          </AlertDescription>
        </Alert>
      )}

      <Frame>
        <FrameHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
            <span>{spkl.number}</span>
            <span aria-hidden className="size-1 rounded-full bg-border" />
            <span>
              {spkl.createdAt
                ? `Dibuat ${formatDateHuman(spkl.createdAt, "d MMM yyyy")}`
                : ""}
            </span>
          </div>
          <FrameTitle className="max-w-3xl text-xl font-semibold tracking-tight sm:text-2xl">
            {spkl.title}
          </FrameTitle>
          <FrameDescription className="max-w-2xl text-sm">
            {spkl.description}
          </FrameDescription>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {formatDateHuman(spkl.startAt, "EEEE, d MMMM yyyy")}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock3 className="size-3.5" />
              {formatTime(spkl.startAt)}–{formatTime(spkl.endAt)} WIB
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              <span className="max-w-[24rem] truncate">
                {spkl.location.address}
              </span>
            </span>
          </div>
        </FrameHeader>

        <FramePanel className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {canViewTeam ? (
              <>
                <Button
                  nativeButton={false}
                  render={<a href="#kehadiran" />}
                >
                  <UsersRound />
                  {detail.canManage ? "Kelola kehadiran" : "Lihat kehadiran"}
                </Button>
                {detail.canManage && (
                  <SpklManageActions
                    spkl={spkl}
                    status={status}
                    editHref={`/spkl/${spkl.id}/edit`}
                    compact
                  />
                )}
              </>
            ) : showCheckIn ? (
              <Button size="lg" onClick={() => setDialog("checkin")}>
                <LogIn />
                Absen masuk sekarang
              </Button>
            ) : showCheckOut ? (
              <Button
                size="lg"
                variant="destructive"
                onClick={() => setDialog("checkout")}
              >
                <LogOut />
                Absen pulang
              </Button>
            ) : running ? (
              <Button
                variant="secondary"
                nativeButton={false}
                render={<a href="#dokumentasi" />}
              >
                <Camera />
                Buka dokumentasi
              </Button>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                <CheckCircle2 className="size-4" />
                {myAttendance
                  ? myAttendance.status === "tidak_hadir"
                    ? "Tercatat tidak hadir"
                    : "Absensi sudah tercatat"
                  : status === "terjadwal"
                    ? "Absen masuk dibuka pada hari pelaksanaan"
                    : status === "dibatalkan"
                      ? "SPKL dibatalkan"
                      : "Tidak ada aksi absensi"}
              </div>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">
                {running ? "Durasi berjalan" : "Direncanakan"}
              </p>
              <p className="text-base font-semibold tabular-nums text-foreground">
                {running && myAttendance?.checkInAt ? (
                  <LiveDuration startAt={countedFrom} endAt={spkl.endAt} />
                ) : (
                  durationLabel(
                    Math.max(
                      0,
                      Math.round(
                        (new Date(spkl.endAt).getTime() -
                          new Date(spkl.startAt).getTime()) /
                          60_000,
                      ),
                    ),
                  )
                )}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Kehadiran</p>
              <p className="text-base font-semibold tabular-nums text-foreground">
                {presentCount}
                <span className="text-sm font-normal text-muted-foreground">
                  /{detail.attendances.length}
                </span>
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Dokumentasi</p>
              <p className="text-base font-semibold tabular-nums text-foreground">
                {docsToday}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  foto
                </span>
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Radius absen</p>
              <p className="text-base font-semibold tabular-nums text-foreground">
                {spkl.radiusMeters}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  m
                </span>
              </p>
            </div>
          </div>
        </FramePanel>
      </Frame>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="flex min-w-0 flex-col gap-5">
          <Frame>
            <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <FrameTitle>Titik absen & radius</FrameTitle>
                <FrameDescription className="text-xs">
                  {spkl.location.address ||
                    `${spkl.location.latitude}, ${spkl.location.longitude}`}
                </FrameDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${spkl.location.latitude}&mlon=${spkl.location.longitude}#map=17/${spkl.location.latitude}/${spkl.location.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <Navigation />
                Petunjuk arah
              </Button>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              <div className="relative isolate h-[250px] w-full overflow-hidden rounded-lg bg-muted sm:h-[330px]">
                <MapView
                  center={spkl.location}
                  markers={markers}
                  radiusMeters={spkl.radiusMeters}
                  zoom={16}
                  interactive
                  className="size-full"
                />
                <Badge
                  variant="outline"
                  className="absolute left-3 top-3 z-[400] bg-background/95 backdrop-blur"
                >
                  <MapPin className="size-3" />
                  Radius {formatDistance(spkl.radiusMeters)}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[50%_50%_50%_2px] bg-primary" />
                  Titik absen SPKL
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-primary" />
                  Posisi absen anggota
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                  <Ruler className="size-3.5" />
                  Akurasi GPS maks. {policy.maxGpsAccuracyMeters} m
                </span>
              </div>
            </FramePanel>
          </Frame>

          <DocumentationPanel
            spklId={spkl.id}
            spklTitle={spkl.title}
            spklNumber={spkl.number}
            documents={detail.documentation}
            canUpload={detail.canUpload}
            uploadBlockedReason={uploadBlockedReason}
            maxUploads={UPLOAD_MAX_PER_SESSION}
            maxBytes={UPLOAD_MAX_BYTES}
          />

          <AttendanceSection
            spkl={spkl}
            attendances={detail.attendances}
            documentation={detail.documentation}
            canManage={detail.canManage}
          />
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          {isWorker && myAttendance && (
            <Frame spacing="sm">
              <FrameHeader className="flex-row items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <FrameTitle>Status kehadiran</FrameTitle>
                  <FrameDescription className="text-xs">
                    Absensiku pada SPKL ini
                  </FrameDescription>
                </div>
                <AttendanceBadge status={myAttendance.status} />
              </FrameHeader>
              <FramePanel className="flex flex-col gap-4">
                <div className="relative flex flex-col gap-4 pl-5">
                  <span className="absolute bottom-2 left-[5px] top-2 w-px bg-border" />
                  <div className="relative">
                    <span
                      className={cn(
                        "absolute -left-5 top-1 size-2.5 rounded-full ring-4 ring-card",
                        myAttendance.checkInAt ? "bg-success" : "bg-border",
                      )}
                    />
                    <p className="text-xs text-muted-foreground">Masuk</p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">
                      {myAttendance.checkInAt
                        ? `${formatTime(myAttendance.checkInAt)} WIB`
                        : "Belum absen"}
                    </p>
                    {myAttendance.checkInLocation && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" />
                        {myAttendance.checkInLocation.distanceFromSite} m dari
                        titik · ±
                        {Math.round(myAttendance.checkInLocation.accuracy)} m
                      </p>
                    )}
                  </div>
                  <div className="relative">
                    <span
                      className={cn(
                        "absolute -left-5 top-1 size-2.5 rounded-full ring-4 ring-card",
                        myAttendance.checkOutAt
                          ? "bg-success"
                          : running
                            ? "bg-warning"
                            : "bg-border",
                      )}
                    />
                    <p className="text-xs text-muted-foreground">Pulang</p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">
                      {myAttendance.checkOutAt
                        ? `${formatTime(myAttendance.checkOutAt)} WIB`
                        : running
                          ? "Sesi masih berjalan"
                          : "—"}
                    </p>
                    {myAttendance.status === "ditutup_otomatis" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ditutup otomatis saat SPKL berakhir.
                      </p>
                    )}
                  </div>
                  <div className="relative">
                    <span
                      className={cn(
                        "absolute -left-5 top-1 size-2.5 rounded-full ring-4 ring-card",
                        myDocCount > 0 ? "bg-success" : "bg-border",
                      )}
                    />
                    <p className="text-xs text-muted-foreground">Dokumentasi</p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">
                      {myDocCount} / {UPLOAD_MAX_PER_SESSION} foto
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-2.5">
                  <span className="text-xs text-muted-foreground">
                    Durasi tercatat
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {running && myAttendance.checkInAt ? (
                      <LiveDuration startAt={countedFrom} endAt={spkl.endAt} />
                    ) : (
                      durationLabel(myAttendance.durationMinutes)
                    )}
                  </span>
                </div>

                {checkedInEarly && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Kamu absen lebih awal. Durasi lembur dihitung sejak{" "}
                    {formatTime(spkl.startAt)} WIB.
                  </p>
                )}

                {myAttendance.status === "dikoreksi" &&
                  myAttendance.correctionReason && (
                    <Alert variant="info">
                      <AlertDescription>
                        <span className="font-medium text-foreground">
                          Koreksi atasan:
                        </span>{" "}
                        {myAttendance.correctionReason}
                      </AlertDescription>
                    </Alert>
                  )}

                {detail.canUpload && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-fit"
                    nativeButton={false}
                    render={<a href="#dokumentasi" />}
                  >
                    Tambah dokumentasi
                    <ArrowRight />
                  </Button>
                )}
              </FramePanel>
            </Frame>
          )}

          <Frame spacing="sm">
            <FrameHeader>
              <FrameTitle>Informasi penugasan</FrameTitle>
              <FrameDescription className="text-xs">
                Rincian SPKL dan pekerja terhubung
              </FrameDescription>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              <div className="flex flex-col">
                <DataRow label="Nomor" value={spkl.number} />
                <DataRow
                  label="Tanggal"
                  value={formatDateHuman(spkl.startAt, "d MMMM yyyy")}
                />
                <DataRow
                  label="Jam"
                  value={`${formatTime(spkl.startAt)}–${formatTime(spkl.endAt)} WIB`}
                />
                <DataRow
                  label="Lokasi"
                  value={
                    <span className="line-clamp-2 max-w-[11rem]">
                      {spkl.location.address || "Titik lokasi"}
                    </span>
                  }
                />
                <DataRow label="Radius" value={`${spkl.radiusMeters} meter`} />
                <DataRow
                  label="Divisi"
                  value={detail.division?.name ?? "Belum ditentukan"}
                />
                <DataRow
                  label="Pembuat"
                  value={detail.creator?.name ?? "Atasan"}
                />
                <DataRow
                  label="Dokumentasi"
                  value={spkl.requiresDocumentation ? "Wajib" : "Opsional"}
                />
                <DataRow
                  label="Pekerja"
                  value={`${detail.attendances.length} orang`}
                  className="border-b-0"
                />
              </div>

              <div className="flex items-center gap-2.5 rounded-md bg-muted/60 p-2.5">
                <AvatarStack employees={detail.workers} max={5} size="xs" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {detail.workers.length} pekerja terhubung ke SPKL ini
                </p>
              </div>
            </FramePanel>
          </Frame>

          <Alert variant="warning">
            <ShieldCheck />
            <AlertTitle>Ketentuan absensi</AlertTitle>
            <AlertDescription>
              <ul className="flex flex-col gap-1.5">
                <li>
                  Absen masuk bisa dilakukan sejak 00:00 WIB pada tanggal SPKL
                  hingga jam selesai, dalam radius {spkl.radiusMeters} m dari
                  titik.
                </li>
                <li>
                  Absen lebih awal diperbolehkan; durasi lembur tetap dihitung
                  sejak jam mulai SPKL.
                </li>
                <li>Waktu absensi memakai jam server, bukan jam perangkat.</li>
                <li>
                  {spkl.requiresDocumentation
                    ? "Minimal satu dokumentasi wajib diunggah sebelum absen pulang."
                    : "Dokumentasi pekerjaan tetap disarankan sebagai bukti."}
                </li>
                <li>
                  Pembulatan durasi {policy.roundingMinutes} menit · dokumentasi
                  ditutup {policy.docGraceMinutes} menit setelah SPKL berakhir.
                </li>
              </ul>
            </AlertDescription>
          </Alert>

          {canViewTeam && (
            <Frame spacing="sm">
              <FrameHeader>
                <FrameTitle>Progres kehadiran</FrameTitle>
                <FrameDescription className="text-xs">
                  Ringkasan tim pada SPKL ini
                </FrameDescription>
              </FrameHeader>
              <FramePanel className="flex flex-col gap-3">
                <div className="flex items-end justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Sudah absen masuk
                  </p>
                  <p className="text-xl font-semibold tabular-nums text-foreground">
                    {presentCount}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{detail.attendances.length}
                    </span>
                  </p>
                </div>
                <ProgressBar
                  value={presentCount}
                  max={Math.max(1, detail.attendances.length)}
                  tone={
                    presentCount === detail.attendances.length
                      ? "success"
                      : "warning"
                  }
                />
                <div className="flex flex-col gap-2">
                  {detail.attendances
                    .slice(0, 4)
                    .map(({ employee, attendance }) => (
                      <div
                        key={employee.id}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate font-medium text-foreground">
                          {employee.name}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {attendance?.checkInAt
                            ? `${formatTime(attendance.checkInAt)} masuk`
                            : "Belum absen"}
                        </span>
                      </div>
                    ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  nativeButton={false}
                  render={<a href="#kehadiran" />}
                >
                  Lihat semua kehadiran
                  <ArrowRight />
                </Button>
              </FramePanel>
            </Frame>
          )}

          <div className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <p>
              Data pribadi, koordinat, dan dokumentasi hanya dapat diakses
              pekerja pada SPKL ini serta atasan pembuatnya. Setiap tindakan
              tercatat di audit log.
            </p>
          </div>
        </aside>
      </div>

      {dialog === "checkin" && (
        <AttendanceDialog
          open
          onClose={() => setDialog(null)}
          mode="checkin"
          spklId={spkl.id}
          site={spkl.location}
          radiusMeters={spkl.radiusMeters}
          maxAccuracyMeters={policy.maxGpsAccuracyMeters}
        />
      )}
      {dialog === "checkout" && myAttendance && (
        <AttendanceDialog
          open
          onClose={() => setDialog(null)}
          mode="checkout"
          spklId={spkl.id}
          attendanceId={myAttendance.id}
          site={spkl.location}
          radiusMeters={spkl.radiusMeters}
          maxAccuracyMeters={policy.maxGpsAccuracyMeters}
          requiresDocumentation={spkl.requiresDocumentation}
        />
      )}
    </div>
  );
}
