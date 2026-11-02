"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert";
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

export function NoteDelete({
  noteId,
  title,
  redirectTo,
}: {
  noteId: string;
  title: string;
  /** Halaman tujuan setelah catatan dihapus, mis. kembali ke feed. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigationTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (navigationTimer.current !== null) {
        window.clearTimeout(navigationTimer.current);
      }
    },
    [],
  );

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/catatan/${noteId}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;

      // 404 berarti catatan sudah tidak ada; tujuan penghapusan tercapai dan
      // pengguna tidak perlu mengulang permintaan.
      const alreadyGone = response.status === 404;
      if (!response.ok && !alreadyGone) {
        throw new Error(payload?.message ?? "Catatan gagal dihapus.");
      }
      if (!alreadyGone && !payload?.ok) {
        throw new Error(payload?.message ?? "Catatan gagal dihapus.");
      }

      toast.success(
        alreadyGone ? "Catatan sudah tidak ada." : "Catatan dihapus.",
      );

      if (redirectTo) {
        // Dialog dan status pending dipertahankan sampai navigasi unmount.
        router.replace(redirectTo);
        router.refresh();
        navigationTimer.current = window.setTimeout(() => {
          navigationTimer.current = null;
          setBusy(false);
          setError(
            "Halaman belum berpindah. Coba lagi atau buka daftar catatan secara manual.",
          );
        }, 10_000);
        return;
      }

      setOpen(false);
      setBusy(false);
      router.refresh();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Catatan gagal dihapus. Coba lagi.",
      );
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        className="w-full sm:w-auto"
        aria-label={`Hapus catatan ${title}`}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Trash2 aria-hidden="true" />
        Hapus catatan
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next, details) => {
          if (!next && busy) {
            details.cancel();
            return;
          }
          if (!next) {
            setOpen(false);
            setError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">
              Hapus catatan ini?
            </AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              Catatan “{title}” dan foto lampirannya akan dihapus permanen.
              Tindakan ini tercatat di log audit.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>Catatan gagal dihapus</AlertTitle>
              <AlertDescription className="break-words">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
            >
              {busy ? <Spinner /> : <Trash2 />}
              {busy ? "Menghapus…" : "Hapus catatan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
