"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  Clock3,
  CornerDownRight,
  MapPin,
  PencilLine,
  ShieldAlert,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { useTable, type ColumnDef } from "@tanstack/react-table";
import { DatePicker } from "@/components/date-picker";
import { Modal } from "@/components/modal";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
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
import { avatarUrl } from "@/lib/avatar-url";
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

interface AttendanceRow extends EmployeeAttendanceView {
  documentationCount: number;
}

function attendanceDuration(attendance: Attendance | null) {
  if (!attendance || attendance.status === "tidak_hadir") return "—";
  if (attendance.durationMinutes !== null) {
    return durationLabel(attendance.durationMinutes);
  }
  if (attendance.status === "berjalan") return "Berjalan";
  return "—";
}

function attendanceStatusCell(attendance: Attendance | null) {
  if (!attendance) {
    return (
      <Badge variant="warning-light" dot>
        Belum absen
      </Badge>
    );
  }
  return (
    <AttendanceBadge
      status={attendance.status}
      checkOutAt={attendance.checkOutAt}
    />
  );
}

const attendanceColumns: ColumnDef<DataGridFeatures, AttendanceRow>[] = [
  {
    id: "employee",
    accessorFn: (row) => `${row.employee.name} ${row.employee.nik}`,
    header: "Pekerja",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "max-w-64",
    },
    cell: ({ row }) => {
      const { employee } = row.original;
      return (
        <div className="flex items-center gap-2">
          <Avatar
            name={employee.name}
            seed={employee.id}
            src={avatarUrl(employee.id, employee.avatarKey)}
            size="xs"
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-foreground">
              {employee.name}
            </span>
            <span className="truncate text-xs text-muted-foreground tabular-nums">
              NIK {employee.nik}
            </span>
            {row.original.attendance && (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Camera className="size-3.5" aria-hidden="true" />
                  {row.original.documentationCount} foto
                </span>
                {row.original.attendance.checkInLocation ? (
                  <span
                    className="inline-flex items-center gap-1 tabular-nums"
                    title={`Akurasi ±${Math.round(row.original.attendance.checkInLocation.accuracy)} m`}
                  >
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {row.original.attendance.checkInLocation.distanceFromSite} m
                  </span>
                ) : null}
              </span>
            )}
          </div>
        </div>
      );
    },
  },
  {
    id: "status",
    accessorFn: (row) => row.attendance?.status ?? "belum_absen",
    header: "Status",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName: "max-w-56",
    },
    cell: ({ row }) => {
      const { attendance } = row.original;
      return (
        <div className="flex flex-col items-start gap-1">
          {attendanceStatusCell(attendance)}
          {attendance?.status === "ditutup_otomatis" && (
            <span className="text-xs leading-snug text-muted-foreground">
              Sesi ditutup otomatis.
            </span>
          )}
          {attendance?.status === "dikoreksi" &&
            attendance.correctionReason && (
              <span
                className="line-clamp-2 max-w-48 text-xs leading-snug text-muted-foreground"
                title={attendance.correctionReason}
              >
                Koreksi: {attendance.correctionReason}
              </span>
            )}
        </div>
      );
    },
  },
  {
    id: "time",
    accessorFn: (row) => row.attendance?.checkInAt ?? "",
    header: "Waktu",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName:
        "whitespace-nowrap text-sm font-medium text-foreground tabular-nums",
    },
    cell: ({ row }) => {
      const { attendance } = row.original;
      if (!attendance?.checkInAt && !attendance?.checkOutAt) return "—";
      return (
        <div className="flex items-center gap-1">
          <span>
            {attendance.checkInAt ? formatTime(attendance.checkInAt) : "—"}
          </span>
          <span className="text-muted-foreground">–</span>
          <span>
            {attendance.checkOutAt ? formatTime(attendance.checkOutAt) : "—"}
          </span>
        </div>
      );
    },
  },
  {
    id: "duration",
    accessorFn: (row) => row.attendance?.durationMinutes ?? null,
    header: "Durasi",
    meta: {
      headerClassName: "whitespace-nowrap",
      cellClassName:
        "whitespace-nowrap text-sm font-medium text-foreground tabular-nums",
    },
    cell: ({ row }) => attendanceDuration(row.original.attendance),
  },
];

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

  const summary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let running = 0;
    let missingCheckout = 0;
    let notStarted = 0;

    for (const row of attendances) {
      if (!row.attendance) notStarted += 1;
      if (row.attendance?.checkInAt) present += 1;
      if (row.attendance?.status === "tidak_hadir") absent += 1;
      if (row.attendance?.status === "berjalan") running += 1;
      if (
        row.attendance?.status === "ditutup_otomatis" &&
        !row.attendance.checkOutAt
      ) {
        missingCheckout += 1;
      }
    }

    return { present, absent, running, missingCheckout, notStarted };
  }, [attendances]);

  const documentationCountByAttendance = useMemo(() => {
    const counts = new Map<string, number>();

    for (const doc of documentation) {
      if (doc.kind === "video") continue;
      counts.set(doc.attendanceId, (counts.get(doc.attendanceId) ?? 0) + 1);
    }

    return counts;
  }, [documentation]);

  const rows = useMemo<AttendanceRow[]>(
    () =>
      attendances.map((row) => ({
        ...row,
        documentationCount: row.attendance
          ? (documentationCountByAttendance.get(row.attendance.id) ?? 0)
          : 0,
      })),
    [attendances, documentationCountByAttendance],
  );

  const actionColumn = useMemo<ColumnDef<DataGridFeatures, AttendanceRow>>(
    () => ({
      id: "actions",
      header: "Aksi",
      meta: {
        headerClassName: "whitespace-nowrap text-end [&>div]:justify-end",
        cellClassName: "whitespace-nowrap text-end",
      },
      cell: ({ row }) => {
        const { attendance } = row.original;
        if (!attendance) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setCorrection({ employee: row.original.employee, attendance })
            }
          >
            <PencilLine aria-hidden="true" />
            Koreksi
          </Button>
        );
      },
    }),
    [],
  );

  const columns = useMemo(
    () => (canManage ? [...attendanceColumns, actionColumn] : attendanceColumns),
    [actionColumn, canManage],
  );

  const table = useTable({
    features: dataGridFeatures,
    data: rows,
    columns,
    initialState: {
      pagination: { pageIndex: 0, pageSize: Math.max(rows.length, 1) },
    },
    getRowId: (row) => row.employee.id,
  });

  const { present, absent, running, missingCheckout, notStarted } = summary;

  return (
    <Frame id="kehadiran">
      <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <FrameTitle>Daftar pekerja</FrameTitle>
          <FrameDescription className="text-xs">
            Kehadiran, bukti, dan koreksi {attendances.length} pekerja pada SPKL
            ini.
          </FrameDescription>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="success-light">{present} hadir</Badge>
          {running > 0 && (
            <Badge variant="warning-light" dot>
              {running} aktif
            </Badge>
          )}
          {missingCheckout > 0 && (
            <Badge variant="warning-light" dot>
              {missingCheckout} belum pulang
            </Badge>
          )}
          {notStarted > 0 && (
            <Badge variant="outline">{notStarted} belum absen</Badge>
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
            description={
              canManage
                ? "Tambahkan pekerja lewat halaman ubah SPKL agar kehadiran dapat dicatat."
                : "Pekerja yang ditugaskan akan muncul di sini."
            }
            action={
              canManage ? (
                <Button
                  nativeButton={false}
                  render={<Link href={`/spkl/${spkl.id}/edit`} />}
                  variant="outline"
                  size="sm"
                >
                  <PencilLine aria-hidden="true" />
                  Atur pekerja
                </Button>
              ) : undefined
            }
          />
        </FramePanel>
      ) : (
        <FramePanel className="p-0">
          <div className="hidden lg:block">
            <DataGrid
              table={table}
              recordCount={rows.length}
              tableLayout={{ dense: true, width: "auto", headerBorder: true }}
              tableClassNames={{
                base: "min-w-[38rem]",
                headerRow: "bg-muted/40",
              }}
            >
              <DataGridContainer>
                <DataGridScrollArea>
                  <DataGridTable />
                </DataGridScrollArea>
              </DataGridContainer>
            </DataGrid>
          </div>

          <div className="divide-y divide-border/70 lg:hidden">
            {rows.map(({ employee, attendance, documentationCount }) => (
              <article
                key={employee.id}
                className="flex flex-col gap-3 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Avatar
                      name={employee.name}
                      seed={employee.id}
                      src={avatarUrl(employee.id, employee.avatarKey)}
                      size="sm"
                    />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {employee.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground tabular-nums">
                        NIK {employee.nik}
                      </p>
                      <p className="truncate text-xs text-muted-foreground tabular-nums">
                        {employee.phone}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">{attendanceStatusCell(attendance)}</div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-y border-border/70 py-2.5">
                  <div>
                    <p className="text-xs text-muted-foreground">Masuk</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                      {attendance?.checkInAt
                        ? formatTime(attendance.checkInAt)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pulang</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                      {attendance?.checkOutAt
                        ? formatTime(attendance.checkOutAt)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Durasi</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">
                      {attendanceDuration(attendance)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {attendance ? (
                      <>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Camera className="size-3.5" aria-hidden="true" />
                          {documentationCount} foto
                        </span>
                        {attendance.checkInLocation ? (
                          <span
                            className="inline-flex items-center gap-1 tabular-nums"
                            title={`Akurasi ±${Math.round(attendance.checkInLocation.accuracy)} m`}
                          >
                            <MapPin className="size-3.5" aria-hidden="true" />
                            {attendance.checkInLocation.distanceFromSite} m
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span>Belum ada bukti</span>
                    )}
                  </div>
                  {canManage && attendance && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCorrection({ employee, attendance })}
                    >
                      <PencilLine aria-hidden="true" />
                      Koreksi
                    </Button>
                  )}
                </div>

                {attendance?.status === "ditutup_otomatis" && (
                  <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                    <ShieldAlert
                      className="mt-0.5 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {attendance.checkOutAt
                        ? "Sesi ditutup otomatis oleh sistem."
                        : "Absen pulang tidak tercatat. Durasi tidak dihitung; atasan dapat mengoreksi bila pekerja benar-benar menyelesaikan pekerjaan."}
                    </span>
                  </p>
                )}

                {attendance?.status === "dikoreksi" &&
                  attendance.correctionReason && (
                    <p className="rounded-md bg-primary/5 px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
                      <CornerDownRight
                        className="mr-1 inline size-3"
                        aria-hidden="true"
                      />
                      <span className="font-medium text-foreground">
                        Koreksi:
                      </span>{" "}
                      {attendance.correctionReason}
                    </p>
                  )}
              </article>
            ))}
          </div>
        </FramePanel>
      )}

      <FrameFooter className="flex-row flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock3 className="size-3" />
          Waktu dari server dalam WIB
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="size-3" />
          Sesi tanpa absen pulang tidak dihitung; atasan dapat mengoreksi
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
