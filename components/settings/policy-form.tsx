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
import type { Policy } from "@/lib/types";
import {
  durationLabel,
  formatDateHuman,
  formatDateTime,
} from "@/lib/time";

const ROUNDING_LABELS: Record<number, string> = {
  0: "Tanpa pembulatan",
  5: "5 menit",
  10: "10 menit",
  15: "15 menit",
  30: "30 menit",
};

export function PolicyForm({ policy }: { policy: Policy }) {
  const router = useRouter();
  const [values, setValues] = useState({
    roundingMinutes: policy.roundingMinutes,
    dailyLimitMinutes: policy.dailyLimitMinutes,
    weeklyLimitMinutes: policy.weeklyLimitMinutes,
    docGraceMinutes: policy.docGraceMinutes,
    requireDocumentation: policy.requireDocumentation,
    defaultRadiusMeters: policy.defaultRadiusMeters,
    maxGpsAccuracyMeters: policy.maxGpsAccuracyMeters,
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rounding">Pembulatan durasi</Label>
              <Select
                items={ROUNDING_LABELS}
                value={values.roundingMinutes}
                onValueChange={(value) => {
                  if (value !== null) {
                    numberValue("roundingMinutes", String(value));
                  }
                }}
              >
                <SelectTrigger id="rounding" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROUNDING_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={Number(value)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
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
                Setelah SPKL berakhir
              </p>
            </div>
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
            Berlaku untuk absensi dan SPKL berikutnya. Laporan lama tidak dihitung ulang.
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
            {formatDateTime(policy.updatedAt, "d MMM yyyy, HH:mm")} WIB ·{" "}
            {formatDateHuman(policy.updatedAt, "EEEE")}
          </p>
        </form>
      </FramePanel>
    </Frame>
  );
}
