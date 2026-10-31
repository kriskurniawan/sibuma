"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  CornerDownRight,
  MapPin,
  PencilLine,
  ShieldAlert,
  TimerReset,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/date-picker";
import { Modal } from "@/components/modal";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert";
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
  Avatar,
  Badge,
  EmptyState,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { TimeField } from "@/components/time-field";
import {
  durationLabel,
  formatDateHuman,
  formatTime,
  toLocalDateInput,
  toLocalTimeInput,
} from "@/lib/time";
import type {
  Attendance,
  Documentation,
  Employee,
  EmployeeAttendanceView,
  Spkl,
} from "@/lib/types";
import { cn } from "@/lib/utils";

function attendancePlacement(attendance: Attendance | null) {
  if (!attendance) return "Belum absen";
  if (attendance.status === "tidak_hadir") return "Tidak hadir";
  if (attendance.status === "berjalan") return "Sedang berjalan";
  return durationLabel(attendance.durationMinutes);
}

function correctionDefaults(
  attendance: Attendance,
  spkl: Spkl,
): {
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
} {
  const checkInAt = attendance.checkInAt ?? spkl.startAt;
  const checkOutAt =
    attendance.checkOutAt ??
    (attendance.status === "berjalan" ? new Date().toISOString() : spkl.endAt);
  return {
    checkInDate: toLocalDateInput(checkInAt),
    checkInTime: toLocalTimeInput(checkInAt),
    checkOutDate: toLocalDateInput(checkOutAt),
    checkOutTime: toLocalTimeInput(checkOutAt),
  };
}

function DateTimeField({
  idPrefix,
  label,
  dateLabel,
  timeLabel,
  date,
  time,
  onDateChange,
  onTimeChange,
}: {
  idPrefix: string;
  label: string;
  dateLabel: string;
  timeLabel: string;
  date: string;
  time: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}) {
  return (
    <div
      role="group"
      aria-labelledby={`${idPrefix}-label`}
      className="flex flex-col gap-1.5"
    >
      <Label id={`${idPrefix}-label`}>{label}</Label>
      <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <DatePicker
          id={`${idPrefix}-date`}
          value={date}
          onChange={onDateChange}
          ariaLabel={dateLabel}
          placeholder="Tanggal"
        />
        <TimeField
          id={`${idPrefix}-time`}
          value={time}
          onValueChange={(value) => onTimeChange(value ?? "")}
          aria-label={timeLabel}
          placeholder="Jam"
        />
      </div>
    </div>
  );
}

function CorrectionDialog({
  spkl,
  employee,
  attendance,
  open,
  onClose,
}: {
  spkl: Spkl;
  employee: Employee;
  attendance: Attendance;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const defaults = correctionDefaults(attendance, spkl);
  const [checkInDate, setCheckInDate] = useState(defaults.checkInDate);
  const [checkInTime, setCheckInTime] = useState(defaults.checkInTime);
  const [checkOutDate, setCheckOutDate] = useState(defaults.checkOutDate);
  const [checkOutTime, setCheckOutTime] = useState(defaults.checkOutTime);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkIn =
    checkInDate && checkInTime ? `${checkInDate}T${checkInTime}` : "";
  const checkOut =
    checkOutDate && checkOutTime ? `${checkOutDate}T${checkOutTime}` : "";

  async function submit() {
    setError(null);
    if (!checkIn || !checkOut) {
      setError("Isi tanggal dan jam masuk serta pulang.");
      return;
    }
    if (reason.trim().length < 10) {
      setError("Alasan koreksi minimal 10 karakter.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/attendance/${attendance.id}/correct`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkInLocal: checkIn,
          checkOutLocal: checkOut,
          reason: reason.trim(),
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Koreksi absensi gagal disimpan.");
        return;
      }
      toast.success(data.message ?? "Koreksi absensi tersimpan.");
      onClose();
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksimu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Koreksi absensi"
      description={`${employee.name} · ${spkl.number}`}
      size="md"
      dismissible={!submitting}
      footer={
        <div className="flex w-full gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="flex-1"
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex-1"
          >
            {submitting ? (
              <>
                <Spinner />
                Menyimpan…
              </>
            ) : (
              <>
                <PencilLine />
                Simpan koreksi
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert variant="warning">
          <ShieldAlert />
          <AlertTitle>Koreksi akan tercatat di audit log</AlertTitle>
          <AlertDescription>
            Masukkan alasan yang jelas. Data sebelum dan sesudah koreksi
            disimpan permanen dan tidak dapat dihapus.
          </AlertDescription>
        </Alert>

        <div className="grid gap-3">
          <DateTimeField
            idPrefix="correct-in"
            label="Waktu masuk"
            dateLabel="Tanggal masuk"
            timeLabel="Jam masuk"
            date={checkInDate}
            time={checkInTime}
            onDateChange={setCheckInDate}
            onTimeChange={setCheckInTime}
          />
          <DateTimeField
            idPrefix="correct-out"
            label="Waktu pulang"
            dateLabel="Tanggal pulang"
            timeLabel="Jam pulang"
            date={checkOutDate}
            time={checkOutTime}
            onDateChange={setCheckOutDate}
            onTimeChange={setCheckOutTime}
          />
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Jadwal SPKL: {formatDateHuman(spkl.startAt, "d MMM yyyy")} ·{" "}
          {formatTime(spkl.startAt)}–{formatTime(spkl.endAt)} WIB. Waktu masuk
          boleh lebih awal dari jam mulai; durasi dihitung sejak jam mulai dan
          waktu pulang maksimal jam selesai.
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="correct-reason">Alasan koreksi</Label>
          <Textarea
            id="correct-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Contoh: Pekerja lupa absen pulang. Waktu disesuaikan dengan foto serah terima dan konfirmasi atasan."
          />
          <p className="text-right text-xs text-muted-foreground">
            {reason.length}/500
          </p>
        </div>

        {attendance.status === "tidak_hadir" && (
          <p className="rounded-md bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            Absensi ini tercatat tidak hadir. Mengisi waktu masuk dan pulang
            akan mengubah statusnya menjadi{" "}
            <span className="font-medium text-foreground">Dikoreksi</span>.
          </p>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </Modal>
  );
}

export function AttendanceSection({
  spkl,
  attendances,
  documentation,
  canManage,
}: {
  spkl: Spkl;
  attendances: EmployeeAttendanceView[];
  documentation: Documentation[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [correction, setCorrection] = useState<{
    employee: Employee;
    attendance: Attendance;
  } | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const present = attendances.filter(
    (row) => row.attendance?.checkInAt,
  ).length;
  const absent = attendances.filter(
    (row) => row.attendance?.status === "tidak_hadir",
  ).length;
  const running = attendances.filter(
    (row) => row.attendance?.status === "berjalan",
  ).length;
  const pendingReview = attendances.filter(
    (row) =>
      row.attendance?.status === "ditutup_otomatis" &&
      !row.attendance.reviewedAt,
  ).length;

  async function approve(attendance: Attendance) {
    if (reviewingId) return;
    setReviewingId(attendance.id);
    try {
      const response = await fetch(`/api/attendance/${attendance.id}/review`, {
        method: "PATCH",
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;
      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || "Gagal menyetujui absensi.");
      }
      toast.success(data.message || "Absensi disetujui.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyetujui absensi.",
      );
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <Frame id="kehadiran">
      <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <FrameTitle>Daftar pekerja</FrameTitle>
          <FrameDescription className="text-xs">
            {present} hadir · {running} berjalan · {absent} tidak hadir
          </FrameDescription>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="success-light">{present} hadir</Badge>
          {running > 0 && (
            <Badge variant="warning-light" dot>
              {running} aktif
            </Badge>
          )}
          {pendingReview > 0 && (
            <Badge variant="warning-light" dot>
              {pendingReview} perlu tinjauan
            </Badge>
          )}
          {absent > 0 && (
            <Badge variant="destructive-light">{absent} absen</Badge>
          )}
        </div>
      </FrameHeader>

      {attendances.length === 0 ? (
        <FramePanel>
          <EmptyState
            icon={UserX}
            title="Belum ada pekerja"
            description="Pekerja yang ditugaskan akan muncul di sini."
          />
        </FramePanel>
      ) : (
        <FramePanel className="flex flex-col divide-y divide-border">
          {attendances.map(({ employee, attendance }) => {
            const docCount = attendance
              ? documentation.filter(
                  (doc) =>
                    doc.attendanceId === attendance.id &&
                    doc.kind !== "video",
                ).length
              : 0;
            return (
              <div
                key={employee.id}
                className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={employee.name} seed={employee.id} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {employee.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {employee.nik} · {employee.phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {attendance ? (
                      <AttendanceBadge status={attendance.status} />
                    ) : (
                      <Badge variant="warning-light" dot>
                        Belum absen
                      </Badge>
                    )}
                    {attendance?.status === "ditutup_otomatis" &&
                      (attendance.reviewedAt ? (
                        <Badge variant="success-light">Disetujui</Badge>
                      ) : (
                        <Badge variant="warning-light" dot>
                          Perlu tinjauan
                        </Badge>
                      ))}
                    {canManage &&
                      attendance?.status === "ditutup_otomatis" &&
                      !attendance.reviewedAt && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => approve(attendance)}
                          disabled={Boolean(reviewingId)}
                        >
                          {reviewingId === attendance.id ? (
                            <Spinner />
                          ) : (
                            <Check />
                          )}
                          Setujui
                        </Button>
                      )}
                    {canManage && attendance && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCorrection({ employee, attendance })
                        }
                      >
                        <PencilLine />
                        Koreksi
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs text-muted-foreground">Masuk</p>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {attendance?.checkInAt
                        ? formatTime(attendance.checkInAt)
                        : "—"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs text-muted-foreground">Pulang</p>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {attendance?.checkOutAt
                        ? formatTime(attendance.checkOutAt)
                        : "—"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs text-muted-foreground">Durasi</p>
                    <p className="text-sm font-semibold text-foreground">
                      {attendancePlacement(attendance)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs text-muted-foreground">Bukti & lokasi</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Camera className="size-3" /> {docCount} foto
                      </span>
                      {attendance?.checkInLocation ? (
                        <span
                          className="flex items-center gap-1"
                          title={`Akurasi ±${Math.round(attendance.checkInLocation.accuracy)} m`}
                        >
                          <MapPin className="size-3" />
                          {attendance.checkInLocation.distanceFromSite} m
                        </span>
                      ) : null}
                      {attendance?.status === "berjalan" && (
                        <span className="flex items-center gap-1 text-warning-foreground">
                          <TimerReset className="size-3" />
                          aktif
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {attendance?.status === "ditutup_otomatis" && (
                  <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                    <ShieldAlert className="mt-0.5 size-3 shrink-0" />
                    <span>
                      {attendance.reviewedAt
                        ? "Penutupan otomatis sudah disetujui atasan."
                        : "Tidak ada absen pulang. Sesi ditutup otomatis dan menunggu persetujuan atasan."}
                    </span>
                  </p>
                )}

                {attendance?.status === "dikoreksi" &&
                  attendance.correctionReason && (
                    <p
                      className={cn(
                        "rounded-md bg-primary/5 px-2.5 py-2 text-xs leading-relaxed text-muted-foreground",
                      )}
                    >
                      <CornerDownRight className="mr-1 inline size-3" />
                      <span className="font-medium text-foreground">
                        Koreksi:
                      </span>{" "}
                      {attendance.correctionReason}
                    </p>
                  )}
              </div>
            );
          })}
        </FramePanel>
      )}

      <FrameFooter className="flex-row flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock3 className="size-3" />
          Waktu dari server dalam WIB
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="size-3" />
          Sesi tanpa absen pulang ditutup otomatis dan perlu persetujuan atasan
        </span>
        {canManage && (
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3" />
            Jarak diukur dari titik SPKL
          </span>
        )}
      </FrameFooter>

      {correction && (
        <CorrectionDialog
          key={`${correction.attendance.id}-${correction.attendance.updatedAt}`}
          spkl={spkl}
          employee={correction.employee}
          attendance={correction.attendance}
          open
          onClose={() => setCorrection(null)}
        />
      )}
    </Frame>
  );
}
