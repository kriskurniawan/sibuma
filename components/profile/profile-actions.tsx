"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, RefreshCcw, ShieldAlert, Sparkles } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import { clearPrivateBrowserCache } from "@/components/pwa-register";

export function ProfileActions({
  canReset,
  demoMode,
  scope = "all",
}: {
  canReset: boolean;
  demoMode: boolean;
  /** Kept optional so existing callers still render both actions. */
  scope?: "all" | "logout" | "reset";
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setLoggingOut(false);
        toast.error("Server belum mengakhiri sesi. Periksa koneksi lalu coba lagi.");
        return;
      }
      // Drop anything that could expose the previous account on a shared phone.
      await clearPrivateBrowserCache();
      toast.success("Sampai jumpa!");
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
      toast.error("Gagal keluar. Coba lagi.");
    }
  }

  async function resetDemo() {
    setResetting(true);
    setError(null);
    try {
      const response = await fetch("/api/demo/reset", { method: "POST" });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Gagal mereset data demo.");
        return;
      }
      toast.success(data.message ?? "Data demo dikembalikan ke kondisi awal.");
      setResetOpen(false);
      router.push("/");
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksimu.");
    } finally {
      setResetting(false);
    }
  }

  const showReset = scope !== "logout" && canReset && demoMode;
  const showLogout = scope !== "reset";

  if (!showReset && !showLogout) return null;

  return (
    <>
      <div className="flex w-full flex-col gap-2">
        {showReset && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              setError(null);
              setResetOpen(true);
            }}
          >
            <RefreshCcw />
            Reset data demo
          </Button>
        )}
        {showLogout && (
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            onClick={logout}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <>
                <Spinner />
                Keluar…
              </>
            ) : (
              <>
                <LogOut />
                Keluar dari akun
              </>
            )}
          </Button>
        )}
      </div>

      {showReset && (
        <AlertDialog
          open={resetOpen}
          onOpenChange={(nextOpen) => {
            if (!nextOpen && resetting) return;
            setResetOpen(nextOpen);
            if (!nextOpen) setError(null);
          }}
        >
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive">
                <ShieldAlert />
              </AlertDialogMedia>
              <AlertDialogTitle>Reset data demo?</AlertDialogTitle>
              <AlertDialogDescription>
                Seluruh SPKL, absensi, dokumentasi, notifikasi, dan audit log
                akan dikembalikan ke data awal.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="flex flex-col gap-3">
              <Alert variant="destructive">
                <ShieldAlert />
                <AlertDescription>
                  <p className="font-medium">
                    Hanya tersedia dalam mode demo.
                  </p>
                  <p>
                    Data produksi tidak akan tersentuh selama{" "}
                    <code className="font-mono text-xs">DEMO_MODE=false</code> di
                    environment.
                  </p>
                </AlertDescription>
              </Alert>

              <Alert variant="info">
                <Sparkles />
                <AlertDescription>
                  Akun demo Budi Santoso tetap dapat digunakan setelah reset.
                  Kamu akan diarahkan ke beranda dengan data baru.
                </AlertDescription>
              </Alert>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={resetting}>Batal</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={resetDemo}
                disabled={resetting}
              >
                {resetting ? (
                  <>
                    <Spinner />
                    Mereset…
                  </>
                ) : (
                  <>
                    <RefreshCcw />
                    Ya, reset
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
