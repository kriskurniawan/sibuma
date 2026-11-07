"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/reui/alert";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { IconTile } from "@/components/reui/icon-tile";
import { MonthPicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { MAX_DAILY_MINUTES, MAX_WEEKLY_MINUTES } from "@/lib/constants";
import { overtimePeriodLabel, overtimePeriodRange } from "@/lib/overtime-period";
import { TIME_ZONE_OPTIONS } from "@/lib/time-zone";
import type { Policy } from "@/lib/types";
import {
  currentTimeZoneLabel,
  durationLabel,
  formatDateHuman,
  formatDateTime,
} from "@/lib/time";

const TIME_ZONE_ITEMS = TIME_ZONE_OPTIONS.map((option) => ({
  value: option.value,
  label: `${option.label} · ${option.offset}`,
}));

export function PolicyForm({ policy }: { policy: Policy }) {
  const router = useRouter();
  const [values, setValues] = useState({
    dailyLimitMinutes: policy.dailyLimitMinutes,
    weeklyLimitMinutes: policy.weeklyLimitMinutes,
    docGraceMinutes: policy.docGraceMinutes,
    requireDocumentation: policy.requireDocumentation,
    defaultRadiusMeters: policy.defaultRadiusMeters,
    maxGpsAccuracyMeters: policy.maxGpsAccuracyMeters,
    timezone: policy.timezone,
    overtimePeriodStartDay: policy.overtimePeriodStartDay,
    overtimeRoundingEnabled: policy.overtimeRoundingEnabled,
    overtimeRoundingToleranceMinutes:
      policy.overtimeRoundingToleranceMinutes,
    overtimeRoundingEffectiveMonth:
      policy.overtimeRoundingEffectiveMonth.slice(0, 7),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (values.dailyLimitMinutes > MAX_DAILY_MINUTES) {
      setError("Batas harian tidak boleh lebih dari 8 jam.");
      return;
    }
    if (values.weeklyLimitMinutes > MAX_WEEKLY_MINUTES) {
      setError("Batas mingguan tidak boleh lebih dari 40 jam.");
      return;
    }
    if (values.weeklyLimitMinutes < values.dailyLimitMinutes) {
      setError("Batas mingguan harus lebih besar atau sama dengan batas harian.");
      return;
    }
    if (
      !Number.isInteger(values.overtimePeriodStartDay) ||
      values.overtimePeriodStartDay < 1 ||
      values.overtimePeriodStartDay > 31
    ) {
      setError("Tanggal mulai periode lembur harus antara 1 dan 31.");
      return;
    }
    if (
      !Number.isInteger(values.overtimeRoundingToleranceMinutes) ||
      values.overtimeRoundingToleranceMinutes < 0 ||
      values.overtimeRoundingToleranceMinutes > 60
    ) {
      setError("Toleransi pembulatan harus antara 0 dan 60 menit.");
      return;
    }
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(
        values.overtimeRoundingEffectiveMonth,
      )
    ) {
      setError("Pilih bulan mulai berlaku pembulatan.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Gagal menyimpan kebijakan.");
        return;
      }
      toast.success(data.message ?? "Kebijakan tersimpan.");
      if (values.timezone !== policy.timezone) {
        window.location.reload();
        return;
      }
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksimu.");
    } finally {
      setSaving(false);
    }
  }

  function numberValue(key: keyof typeof values, raw: string) {
    setValues((current) => ({
      ...current,
      [key]: raw === "" ? 0 : Number(raw),
    }));
  }

  const selectedTimeZone =
    TIME_ZONE_OPTIONS.find((option) => option.value === values.timezone) ??
    TIME_ZONE_OPTIONS[0];
  const timeZoneChanged = values.timezone !== policy.timezone;
  const previewStartDay =
    Number.isInteger(values.overtimePeriodStartDay) &&
    values.overtimePeriodStartDay >= 1 &&
    values.overtimePeriodStartDay <= 31
      ? values.overtimePeriodStartDay
      : 1;
  const periodPreview = overtimePeriodLabel(
    overtimePeriodRange(new Date(), previewStartDay, selectedTimeZone.value),
    selectedTimeZone.value,
  );

  return (
    <Frame spacing="default">
      <FrameHeader className="gap-2">
        <div className="flex items-center gap-3">
          <IconTile
            variant="soft"
            size="sm"
            className="text-primary"
            aria-hidden="true"
          >
            <Settings2 />
          </IconTile>
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle>Kebijakan lembur</FrameTitle>
          </div>
        </div>
        <FrameDescription className="hidden md:block">
          Berlaku untuk seluruh tim; perubahan tercatat di audit.
        </FrameDescription>
      </FrameHeader>

      <FramePanel>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="daily-limit">Batas harian</Label>
              <InputGroup>
                <InputGroupInput
                  id="daily-limit"
                  type="number"
                  min={60}
                  max={MAX_DAILY_MINUTES}
                  step={15}
                  value={values.dailyLimitMinutes}
                  onChange={(event) =>
                    numberValue("dailyLimitMinutes", event.target.value)
                  }
                  className="tabular-nums"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText className="text-xs">mnt</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <p className="text-xs text-muted-foreground">
                {durationLabel(values.dailyLimitMinutes)}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="weekly-limit">Batas mingguan</Label>
              <InputGroup>
                <InputGroupInput
                  id="weekly-limit"
                  type="number"
                  min={60}
                  max={MAX_WEEKLY_MINUTES}
                  step={30}
                  value={values.weeklyLimitMinutes}
                  onChange={(event) =>
                    numberValue("weeklyLimitMinutes", event.target.value)
                  }
                  className="tabular-nums"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText className="text-xs">mnt</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <p className="text-xs text-muted-foreground">
                {durationLabel(values.weeklyLimitMinutes)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:max-w-xs">
            <Label htmlFor="grace">Tenggang dokumentasi</Label>
            <InputGroup>
              <InputGroupInput
                id="grace"
                type="number"
                min={0}
                max={1_440}
                step={5}
                value={values.docGraceMinutes}
                onChange={(event) =>
                  numberValue("docGraceMinutes", event.target.value)
                }
                className="tabular-nums"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText className="text-xs">mnt</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <p className="text-xs text-muted-foreground">
              Batas unggah dokumentasi setelah SPKL berakhir.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="default-radius">Radius default titik</Label>
              <Input
                id="default-radius"
                type="number"
                min={25}
                max={1_000}
                step={5}
                value={values.defaultRadiusMeters}
                onChange={(event) =>
                  numberValue("defaultRadiusMeters", event.target.value)
                }
                className="tabular-nums"
              />
              <p className="text-xs text-muted-foreground">
                Meter untuk titik absensi baru
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="gps-accuracy">Akurasi GPS maks.</Label>
              <Input
                id="gps-accuracy"
                type="number"
                min={10}
                max={1_000}
                step={5}
                value={values.maxGpsAccuracyMeters}
                onChange={(event) =>
                  numberValue("maxGpsAccuracyMeters", event.target.value)
                }
                className="tabular-nums"
              />
              <p className="text-xs text-muted-foreground">
                Meter toleransi sinyal
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <Label htmlFor="overtime-period-start">
              Tanggal mulai periode lembur
            </Label>
            <Input
              id="overtime-period-start"
              type="number"
              min={1}
              max={31}
              step={1}
              value={values.overtimePeriodStartDay}
              onChange={(event) =>
                numberValue("overtimePeriodStartDay", event.target.value)
              }
              className="tabular-nums sm:max-w-28"
            />
            <p className="text-xs text-muted-foreground">
              Periode berjalan:{" "}
              <span className="font-medium text-foreground">
                {periodPreview}
              </span>
              . Isi 1 untuk bulan kalender. Tanggal 29–31 mengikuti hari
              terakhir pada bulan yang lebih pendek.
            </p>
          </div>

          <div className="flex flex-col gap-4 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <Label htmlFor="overtime-rounding">
                  Pembulatan jam lembur
                </Label>
                <p className="text-xs text-muted-foreground">
                  Kekurangan hingga toleransi tetap dihitung penuh; lebih dari
                  itu dibulatkan ke bawah per jam.
                </p>
              </div>
              <Switch
                id="overtime-rounding"
                checked={values.overtimeRoundingEnabled}
                onCheckedChange={(checked) =>
                  setValues((current) => ({
                    ...current,
                    overtimeRoundingEnabled: checked,
                  }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="overtime-rounding-tolerance">
                  Toleransi kekurangan
                </Label>
                <InputGroup>
                  <InputGroupInput
                    id="overtime-rounding-tolerance"
                    type="number"
                    min={0}
                    max={60}
                    step={5}
                    disabled={!values.overtimeRoundingEnabled}
                    value={values.overtimeRoundingToleranceMinutes}
                    onChange={(event) =>
                      numberValue(
                        "overtimeRoundingToleranceMinutes",
                        event.target.value,
                      )
                    }
                    className="tabular-nums"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText className="text-xs">mnt</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <p className="text-xs text-muted-foreground">
                  Contoh: kurang 30 menit tetap penuh, kurang 31 menit
                  dikurangi 1 jam.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="overtime-rounding-month">
                  Mulai berlaku
                </Label>
                <MonthPicker
                  id="overtime-rounding-month"
                  value={values.overtimeRoundingEffectiveMonth}
                  disabled={!values.overtimeRoundingEnabled}
                  onChange={(value) =>
                    setValues((current) => ({
                      ...current,
                      overtimeRoundingEffectiveMonth: value,
                    }))
                  }
                  ariaLabel="Bulan mulai berlaku pembulatan lembur"
                />
                <p className="text-xs text-muted-foreground">
                  SPKL mulai bulan ini mengikuti aturan baru. Bulan sebelumnya
                  tidak berubah.
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Waktu absen aktual tetap disimpan. Datang lebih awal atau pulang
              lebih lambat tidak menambah jam di luar jadwal SPKL.
            </p>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <Label htmlFor="timezone">Zona waktu</Label>
            <Select
              value={values.timezone}
              onValueChange={(value) => {
                if (!value) return;
                setValues((current) => ({
                  ...current,
                  timezone: value,
                }));
              }}
              items={TIME_ZONE_ITEMS}
            >
              <SelectTrigger id="timezone" className="w-full sm:max-w-xs">
                <SelectValue placeholder="Pilih zona waktu" />
              </SelectTrigger>
              <SelectContent>
                {TIME_ZONE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} · {option.offset}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {selectedTimeZone.description}. Jam, label waktu, dan batas
              tanggal memakai zona ini.
              {timeZoneChanged &&
                " Menyimpan perubahan akan memuat ulang halaman; tanggal yang sudah tersimpan tidak diubah."}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Label htmlFor="require-documentation">Dokumentasi wajib</Label>
              <p className="text-xs text-muted-foreground">
                Default untuk SPKL baru
              </p>
            </div>
            <Switch
              id="require-documentation"
              checked={values.requireDocumentation}
              onCheckedChange={(checked) =>
                setValues((current) => ({
                  ...current,
                  requireDocumentation: checked,
                }))
              }
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Aturan absensi berlaku untuk SPKL berikutnya. Pembulatan lembur
            dihitung mulai bulan yang dipilih; bulan sebelumnya tidak berubah.
          </p>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={saving} className="w-full sm:w-auto sm:self-end">
            {saving ? (
              <>
                <Spinner />
                Menyimpan…
              </>
            ) : (
              <>
                <Save />
                Simpan kebijakan
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Terakhir diperbarui{" "}
            {formatDateTime(policy.updatedAt, "d MMM yyyy, HH:mm")}{" "}
            {currentTimeZoneLabel()} · {formatDateHuman(policy.updatedAt, "EEEE")}
          </p>
        </form>
      </FramePanel>
    </Frame>
  );
}
