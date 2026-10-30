"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, Film, Save } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/reui/alert";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { IconTile } from "@/components/reui/icon-tile";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  PHOTO_LIMIT_MAX,
  PHOTO_LIMIT_MIN,
  VIDEO_LIMIT_MAX,
  VIDEO_LIMIT_MIN,
  VIDEO_SIZE_MAX_MB,
  VIDEO_SIZE_MIN_MB,
  type PhotoLimits,
} from "@/lib/photo-limit-types";
import { formatDateTime } from "@/lib/time";

const PHOTO_FIELDS = [
  {
    key: "checklistPhotos",
    id: "photo-limit-checklist",
    label: "Checklist",
    hint: "Per item checklist atau tindak lanjut.",
  },
  {
    key: "workPhotos",
    id: "photo-limit-work",
    label: "Pekerjaan harian",
    hint: "Per pekerjaan, termasuk foto hasil.",
  },
  {
    key: "spklPhotos",
    id: "photo-limit-spkl",
    label: "Dokumentasi SPKL",
    hint: "Per sesi absensi pekerja.",
  },
] as const;

const VIDEO_FIELDS = [
  {
    key: "checklistVideos",
    id: "video-limit-checklist",
    label: "Checklist",
    hint: "Video tambahan per item atau tindak lanjut.",
  },
  {
    key: "workVideos",
    id: "video-limit-work",
    label: "Pekerjaan harian",
    hint: "Video tambahan per pekerjaan.",
  },
  {
    key: "spklVideos",
    id: "video-limit-spkl",
    label: "Dokumentasi SPKL",
    hint: "Video tambahan per sesi absensi.",
  },
] as const;

type PhotoLimitKey = (typeof PHOTO_FIELDS)[number]["key"];
type VideoLimitKey = (typeof VIDEO_FIELDS)[number]["key"];

export function PhotoLimitSettings({ limits }: { limits: PhotoLimits }) {
  const router = useRouter();
  const [values, setValues] = useState({
    checklistPhotos: limits.checklistPhotos,
    workPhotos: limits.workPhotos,
    spklPhotos: limits.spklPhotos,
    checklistVideos: limits.checklistVideos,
    workVideos: limits.workVideos,
    spklVideos: limits.spklVideos,
    videoEnabled: limits.videoEnabled,
    maxVideoMb: Math.round(limits.maxVideoBytes / 1024 / 1024),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function numberValue(key: PhotoLimitKey | VideoLimitKey, raw: string) {
    setValues((current) => ({
      ...current,
      [key]: raw === "" ? 0 : Number(raw),
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    for (const field of PHOTO_FIELDS) {
      const value = values[field.key];
      if (
        !Number.isInteger(value) ||
        value < PHOTO_LIMIT_MIN ||
        value > PHOTO_LIMIT_MAX
      ) {
        setError(
          `${field.label} harus bilangan bulat antara ${PHOTO_LIMIT_MIN} dan ${PHOTO_LIMIT_MAX} foto.`,
        );
        return;
      }
    }

    for (const field of VIDEO_FIELDS) {
      const value = values[field.key];
      if (
        !Number.isInteger(value) ||
        value < VIDEO_LIMIT_MIN ||
        value > VIDEO_LIMIT_MAX
      ) {
        setError(
          `Batas video ${field.label} harus bilangan bulat antara ${VIDEO_LIMIT_MIN} dan ${VIDEO_LIMIT_MAX} video.`,
        );
        return;
      }
    }

    if (
      !Number.isInteger(values.maxVideoMb) ||
      values.maxVideoMb < VIDEO_SIZE_MIN_MB ||
      values.maxVideoMb > VIDEO_SIZE_MAX_MB
    ) {
      setError(
        `Ukuran video maksimal harus bilangan bulat antara ${VIDEO_SIZE_MIN_MB} dan ${VIDEO_SIZE_MAX_MB} MB.`,
      );
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/pengaturan/foto", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "Batas dokumentasi gagal disimpan.");
      }
      toast.success("Batas foto dan video dokumentasi disimpan.");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Batas dokumentasi gagal disimpan.",
      );
    } finally {
      setSaving(false);
    }
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
            <Camera />
          </IconTile>
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle>Batas foto dan video dokumentasi</FrameTitle>
          </div>
        </div>
        <FrameDescription className="hidden md:block">
          Jumlah maksimum per modul dan ukuran video. Perubahan berlaku untuk
          unggahan berikutnya; dokumentasi yang sudah ada tidak dihapus.
        </FrameDescription>
      </FrameHeader>

      <FramePanel>
        <form
          id="photo-limit-settings-form"
          className="flex flex-col gap-6"
          onSubmit={submit}
        >
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-sm font-medium text-foreground">Foto</h3>
              <p className="text-xs text-muted-foreground">
                Foto tetap wajib untuk dokumentasi; video hanya tambahan.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {PHOTO_FIELDS.map((field) => (
                <div key={field.key} className="flex flex-col gap-2">
                  <Label htmlFor={field.id}>{field.label}</Label>
                  <InputGroup>
                    <InputGroupInput
                      id={field.id}
                      type="number"
                      min={PHOTO_LIMIT_MIN}
                      max={PHOTO_LIMIT_MAX}
                      step={1}
                      value={values[field.key]}
                      onChange={(event) =>
                        numberValue(field.key, event.target.value)
                      }
                      className="tabular-nums"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText className="text-xs">foto</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  <p className="text-xs text-muted-foreground">{field.hint}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              Nilai foto yang diizinkan {PHOTO_LIMIT_MIN}–{PHOTO_LIMIT_MAX}.
            </p>
          </section>

          <section className="flex flex-col gap-4 border-t border-border/70 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <IconTile
                  variant="soft"
                  size="sm"
                  className="text-primary"
                  aria-hidden="true"
                >
                  <Film />
                </IconTile>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h3 className="text-sm font-medium text-foreground">Video</h3>
                  <p className="text-xs text-muted-foreground">
                    Diunggah dari galeri perangkat. Batas berlaku untuk seluruh
                    modul dokumentasi.
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-2">
                <Label htmlFor="video-enabled" className="text-xs">
                  Izinkan video
                </Label>
                <Switch
                  id="video-enabled"
                  checked={values.videoEnabled}
                  onCheckedChange={(checked) =>
                    setValues((current) => ({
                      ...current,
                      videoEnabled: checked,
                    }))
                  }
                />
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="video-size-mb">Ukuran maksimal</Label>
                <InputGroup>
                  <InputGroupInput
                    id="video-size-mb"
                    type="number"
                    min={VIDEO_SIZE_MIN_MB}
                    max={VIDEO_SIZE_MAX_MB}
                    step={1}
                    value={values.maxVideoMb}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        maxVideoMb:
                          event.target.value === ""
                            ? 0
                            : Number(event.target.value),
                      }))
                    }
                    className="tabular-nums"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText className="text-xs">MB</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <p className="text-xs text-muted-foreground">
                  Per video, {VIDEO_SIZE_MIN_MB}–{VIDEO_SIZE_MAX_MB} MB.
                </p>
              </div>
              {VIDEO_FIELDS.map((field) => (
                <div key={field.key} className="flex flex-col gap-2">
                  <Label htmlFor={field.id}>{field.label}</Label>
                  <InputGroup>
                    <InputGroupInput
                      id={field.id}
                      type="number"
                      min={VIDEO_LIMIT_MIN}
                      max={VIDEO_LIMIT_MAX}
                      step={1}
                      value={values[field.key]}
                      onChange={(event) =>
                        numberValue(field.key, event.target.value)
                      }
                      className="tabular-nums"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText className="text-xs">video</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  <p className="text-xs text-muted-foreground">{field.hint}</p>
                </div>
              ))}
            </div>

            <Alert variant="info">
              <AlertDescription>
                Video tidak dapat menggantikan foto dokumentasi wajib. Nilai 0
                mematikan unggahan video pada modul tersebut.
              </AlertDescription>
            </Alert>
          </section>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
      </FramePanel>

      <FrameFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground tabular-nums">
          Terakhir diubah{" "}
          {formatDateTime(limits.updatedAt, "d MMM yyyy, HH:mm")}.
        </p>
        <Button
          type="submit"
          size="sm"
          form="photo-limit-settings-form"
          disabled={saving}
        >
          {saving ? <Spinner /> : <Save aria-hidden="true" />}
          {saving ? "Menyimpan…" : "Simpan pengaturan"}
        </Button>
      </FrameFooter>
    </Frame>
  );
}
