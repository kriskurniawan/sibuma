"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileLock2, Save } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { formatDateTime } from "@/lib/time";
import {
  formatDocumentBytes,
  WORK_DOCUMENT_EXTENSIONS,
  WORK_DOCUMENT_HARD_MAX_BYTES,
  type WorkDocumentExtension,
  type WorkDocumentSettings,
} from "@/lib/work-document-types";

const MAX_FILE_MB = WORK_DOCUMENT_HARD_MAX_BYTES / 1024 / 1024;

const EXTENSION_LABEL: Record<WorkDocumentExtension, string> = {
  pdf: "PDF",
  jpg: "JPG",
  jpeg: "JPEG",
  png: "PNG",
  docx: "DOCX",
  xlsx: "XLSX",
  pptx: "PPTX",
  mp4: "MP4",
  webm: "WEBM",
  mov: "MOV",
};

export function DocumentSettings({
  settings,
}: {
  settings: WorkDocumentSettings;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    uploadsEnabled: settings.uploadsEnabled,
    maxFileMb: Math.round(settings.maxFileBytes / 1024 / 1024),
    maxVideoMb: Math.round(settings.maxVideoBytes / 1024 / 1024),
    quotaMb: Math.round(settings.quotaBytes / 1024 / 1024),
    allowedExtensions: settings.allowedExtensions,
    trashRetentionDays: settings.trashRetentionDays,
    shareToDivision: settings.shareToDivision,
    shareToSupervisor: settings.shareToSupervisor,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleExtension(extension: WorkDocumentExtension, checked: boolean) {
    setValues((current) => ({
      ...current,
      allowedExtensions: checked
        ? [...current.allowedExtensions, extension]
        : current.allowedExtensions.filter((value) => value !== extension),
    }));
  }

  function numberValue(
    key: "maxFileMb" | "maxVideoMb" | "quotaMb" | "trashRetentionDays",
    raw: string,
  ) {
    setValues((current) => ({
      ...current,
      [key]: raw === "" ? 0 : Number(raw),
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (values.allowedExtensions.length === 0) {
      setError("Pilih minimal satu jenis berkas.");
      return;
    }
    if (
      !Number.isInteger(values.maxVideoMb) ||
      values.maxVideoMb < 1 ||
      values.maxVideoMb > MAX_FILE_MB
    ) {
      setError(`Ukuran maksimal video harus antara 1 dan ${MAX_FILE_MB} MB.`);
      return;
    }
    if (values.quotaMb < values.maxFileMb) {
      setError(
        "Kuota per pengguna tidak boleh lebih kecil dari ukuran maksimal berkas.",
      );
      return;
    }
    if (values.quotaMb < values.maxVideoMb) {
      setError(
        "Kuota per pengguna tidak boleh lebih kecil dari ukuran maksimal video.",
      );
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/pengaturan/dokumen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "Pengaturan gagal disimpan.");
      }
      toast.success("Pengaturan dokumen kerja disimpan.");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Pengaturan gagal disimpan.",
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
            <FileLock2 />
          </IconTile>
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle>Dokumen kerja</FrameTitle>
          </div>
        </div>
        <FrameDescription className="hidden md:block">
          Batas unggahan, kuota, jenis berkas, dan opsi berbagi. Perubahan tidak
          membatalkan dokumen yang sudah ada.
        </FrameDescription>
      </FrameHeader>

      <FramePanel>
        <form
          id="document-settings-form"
          className="flex flex-col gap-5"
          onSubmit={submit}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Label htmlFor="document-uploads-enabled">
                Izinkan unggahan dokumen
              </Label>
              <p className="text-xs text-muted-foreground">
                Jika dimatikan, semua karyawan hanya dapat membuka dokumen yang
                sudah ada. Pratinjau dan unduhan tetap berjalan.
              </p>
            </div>
            <Switch
              id="document-uploads-enabled"
              checked={values.uploadsEnabled}
              onCheckedChange={(checked) =>
                setValues((current) => ({
                  ...current,
                  uploadsEnabled: checked,
                }))
              }
            />
          </div>

          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="document-max-file">Ukuran maksimal berkas</Label>
              <InputGroup>
                <InputGroupInput
                  id="document-max-file"
                  type="number"
                  min={1}
                  max={MAX_FILE_MB}
                  step={1}
                  value={values.maxFileMb}
                  onChange={(event) =>
                    numberValue("maxFileMb", event.target.value)
                  }
                  className="tabular-nums"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText className="text-xs">MB</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatDocumentBytes(values.maxFileMb * 1024 * 1024)} per
                berkas, maksimal {MAX_FILE_MB} MB.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="document-max-video">Ukuran maksimal video</Label>
              <InputGroup>
                <InputGroupInput
                  id="document-max-video"
                  type="number"
                  min={1}
                  max={MAX_FILE_MB}
                  step={1}
                  value={values.maxVideoMb}
                  onChange={(event) =>
                    numberValue("maxVideoMb", event.target.value)
                  }
                  className="tabular-nums"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText className="text-xs">MB</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatDocumentBytes(values.maxVideoMb * 1024 * 1024)} per
                video, maksimal {MAX_FILE_MB} MB.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="document-quota">Kuota per pengguna</Label>
              <InputGroup>
                <InputGroupInput
                  id="document-quota"
                  type="number"
                  min={1}
                  max={102_400}
                  step={1}
                  value={values.quotaMb}
                  onChange={(event) =>
                    numberValue("quotaMb", event.target.value)
                  }
                  className="tabular-nums"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText className="text-xs">MB</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatDocumentBytes(values.quotaMb * 1024 * 1024)} per akun.
                Berkas di sampah tetap dihitung sampai dihapus permanen.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <Label>Jenis berkas yang diizinkan</Label>
            <div className="flex flex-wrap gap-2">
              {WORK_DOCUMENT_EXTENSIONS.map((extension) => {
                const checked = values.allowedExtensions.includes(extension);
                return (
                  <label
                    key={extension}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        toggleExtension(extension, value === true)
                      }
                    />
                    {EXTENSION_LABEL[extension]}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Dokumen Office hanya dapat diunduh; pratinjau di browser tersedia
              untuk PDF, gambar, dan video.
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <Label htmlFor="document-share-division">
                  Izinkan berbagi ke divisi
                </Label>
                <p className="text-xs text-muted-foreground">
                  Pemilik dokumen dapat membuka akses hanya-baca kepada anggota
                  divisi mana pun.
                </p>
              </div>
              <Switch
                id="document-share-division"
                checked={values.shareToDivision}
                onCheckedChange={(checked) =>
                  setValues((current) => ({
                    ...current,
                    shareToDivision: checked,
                  }))
                }
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <Label htmlFor="document-share-supervisor">
                  Izinkan berbagi ke atasan
                </Label>
                <p className="text-xs text-muted-foreground">
                  Pemilik dokumen dapat membuka akses hanya-baca kepada atasan
                  mana pun.
                </p>
              </div>
              <Switch
                id="document-share-supervisor"
                checked={values.shareToSupervisor}
                onCheckedChange={(checked) =>
                  setValues((current) => ({
                    ...current,
                    shareToSupervisor: checked,
                  }))
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Menonaktifkan opsi tidak menutup akses yang sudah terbuka dan tidak
              menambahkan penerima baru; pemilik tetap dapat mempertahankan atau
              menutup penerima yang ada.
            </p>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <Label htmlFor="document-trash-retention">
              Masa simpan sampah
            </Label>
            <div className="flex items-center gap-2">
              <InputGroup className="max-w-40">
                <InputGroupInput
                  id="document-trash-retention"
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  value={values.trashRetentionDays}
                  onChange={(event) =>
                    numberValue("trashRetentionDays", event.target.value)
                  }
                  className="tabular-nums"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText className="text-xs">hari</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </div>
            <p className="text-xs text-muted-foreground">
              Masa simpan ditetapkan saat dokumen dihapus; perubahan berlaku
              untuk penghapusan berikutnya.
            </p>
          </div>

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
          {formatDateTime(settings.updatedAt, "d MMM yyyy, HH:mm")}.
        </p>
        <Button
          type="submit"
          size="sm"
          form="document-settings-form"
          disabled={saving}
        >
          {saving ? <Spinner /> : <Save aria-hidden="true" />}
          {saving ? "Menyimpan…" : "Simpan pengaturan"}
        </Button>
      </FrameFooter>
    </Frame>
  );
}
