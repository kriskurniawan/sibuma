"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, PencilLine, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/reui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { Spkl, SpklStatus } from "@/lib/types";

export function SpklManageActions({
  spkl,
  status,
  editHref,
  compact = false,
}: {
  spkl: Spkl;
  status: SpklStatus;
  editHref: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "selesai" || status === "dibatalkan") return null;

  async function cancelSpkl() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/spkl/${spkl.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Gagal membatalkan SPKL.");
        return;
      }
      toast.success(data.message ?? "SPKL dibatalkan.");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksimu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className={
          compact ? "flex flex-wrap gap-2" : "flex flex-wrap items-center gap-2"
        }
      >
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={editHref} />}
        >
          <PencilLine />
          Ubah SPKL
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <Ban />
          Batalkan
        </Button>
      </div>

      <AlertDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && submitting) return;
          setOpen(nextOpen);
          if (!nextOpen) setError(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <ShieldAlert />
            </AlertDialogMedia>
            <AlertDialogTitle>Batalkan SPKL?</AlertDialogTitle>
            <AlertDialogDescription>
              {spkl.number} · {spkl.title}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-4">
            <Alert variant="destructive">
              <ShieldAlert />
              <AlertDescription>
                Tindakan ini tidak dapat dibatalkan. Semua pekerja akan menerima
                notifikasi WhatsApp dan sesi absensi yang masih berjalan ditutup
                otomatis.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cancel-reason">
                Alasan pembatalan{" "}
                <span className="font-normal text-muted-foreground">
                  (opsional)
                </span>
              </Label>
              <Textarea
                id="cancel-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                placeholder="Contoh: Pekerjaan selesai lebih cepat sehingga lembur tidak diperlukan."
              />
              <p className="text-right text-xs text-muted-foreground">
                {reason.length}/500
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Kembali</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={cancelSpkl}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Spinner />
                  Membatalkan…
                </>
              ) : (
                <>
                  <Ban />
                  Ya, batalkan
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
