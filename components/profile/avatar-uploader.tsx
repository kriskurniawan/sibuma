"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const OUTPUT_SIZE = 512;

async function squareJpeg(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sourceX = (bitmap.width - side) / 2;
    const sourceY = (bitmap.height - side) / 2;
    const size = Math.min(OUTPUT_SIZE, side);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Browser tidak dapat memproses foto.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size, size);
    context.drawImage(bitmap, sourceX, sourceY, side, side, 0, 0, size, size);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.86);
    });
    if (!blob) throw new Error("Foto gagal dikompres. Coba foto lain.");
    return blob;
  } finally {
    bitmap.close();
  }
}

export function AvatarUploader({
  employeeId,
  name,
  avatarKey,
  endpoint,
  onChanged,
  disabled = false,
}: {
  employeeId: string;
  name: string;
  avatarKey?: string | null;
  endpoint: string;
  onChanged?: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [key, setKey] = useState<string | null>(avatarKey ?? null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function openPicker() {
    if (busy || disabled) return;
    setError(null);
    inputRef.current?.click();
  }

  async function upload(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Format foto harus JPEG, PNG, atau WebP.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError("Ukuran foto asli maksimal 5 MB.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const blob = await squareJpeg(file);
      const body = new FormData();
      body.append(
        "file",
        new File([blob], "avatar.jpg", { type: "image/jpeg" }),
      );
      const response = await fetch(endpoint, { method: "POST", body });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
        avatarKey?: string | null;
      };
      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? "Gagal mengunggah foto.");
      }
      setKey(data.avatarKey ?? null);
      setPreview(URL.createObjectURL(blob));
      toast.success(data.message ?? "Foto profil diperbarui.");
      onChanged?.();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Gagal mengunggah foto. Coba lagi.",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    if (busy || disabled) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? "Gagal menghapus foto.");
      }
      setKey(null);
      setPreview(null);
      toast.success(data.message ?? "Foto profil dihapus.");
      onChanged?.();
      return true;
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Gagal menghapus foto. Coba lagi.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  const src =
    preview ??
    (key
      ? `/api/avatars/${encodeURIComponent(employeeId)}?v=${encodeURIComponent(key)}`
      : undefined);

  return (
    <div className="flex flex-col gap-3" aria-busy={busy}>
      <p role="status" className="sr-only">
        {busy ? "Memproses foto profil." : ""}
      </p>
      <div className="flex items-center gap-4">
        <Avatar name={name} seed={employeeId} src={src} size="xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm font-medium text-foreground">Foto profil</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            JPEG, PNG, atau WebP, maks. 5 MB. Dipotong persegi; disimpan privat.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openPicker}
              disabled={busy || disabled}
            >
              {busy ? <Spinner /> : <ImagePlus aria-hidden="true" />}
              {key || preview ? "Ganti foto" : "Pilih foto"}
            </Button>
            {(key || preview) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={busy || disabled}
              >
                <Trash2 aria-hidden="true" />
                Hapus
              </Button>
            )}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Pilih foto profil"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus foto profil?</AlertDialogTitle>
            <AlertDialogDescription>
              Foto dihapus dari penyimpanan privat dan avatar kembali memakai
              inisial nama. Kamu dapat mengunggah foto baru kapan saja.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (await remove()) setConfirmOpen(false);
              }}
            >
              {busy ? "Menghapus…" : "Hapus foto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
