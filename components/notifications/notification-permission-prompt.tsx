"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { IconTile } from "@/components/reui/icon-tile";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { usePushSettings } from "./use-push-settings";

/** Beri waktu dashboard tampil dulu sebelum menawarkan izin. */
const PROMPT_DELAY_MS = 5_000;
/** Setelah ditunda, tawarkan lagi setelah dua minggu. */
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1_000;
/** Setelah dua kali ditunda, berhenti menawarkan otomatis. */
const MAX_PROMPTS = 2;

interface PromptState {
  count: number;
  until: number;
}

function storageKey(userId: string) {
  return `sibuma:notif-prompt:${userId}`;
}

function readPromptState(userId: string): PromptState {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return { count: 0, until: 0 };
    const parsed = JSON.parse(raw) as Partial<PromptState>;
    return {
      count: typeof parsed.count === "number" ? parsed.count : 0,
      until: typeof parsed.until === "number" ? parsed.until : 0,
    };
  } catch {
    return { count: 0, until: 0 };
  }
}

function writePromptState(userId: string, state: PromptState) {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // Penyimpanan bisa diblokir; modal tetap bisa ditutup untuk sesi ini.
  }
}

function markPromptHandled(userId: string) {
  writePromptState(userId, { count: MAX_PROMPTS, until: 0 });
}

/**
 * Tawarkan aktivasi push hanya untuk akun yang belum pernah mendaftarkan
 * perangkat dan belum memutuskan izin di browser ini. Izin tidak pernah
 * diminta otomatis: permintaan browser baru dipicu oleh klik "Aktifkan".
 *
 * Date.now() hanya dipakai untuk masa tunda di localStorage, di dalam effect
 * atau penanganan klik, sehingga tidak pernah ikut dirender.
 */
export function NotificationPermissionPrompt({ userId }: { userId: string }) {
  const { loading, busy, canActivate, subscriptions, activate } =
    usePushSettings();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const neverActivated = subscriptions === 0;

  // Akun yang sudah punya perangkat terdaftar tidak perlu ditawari lagi,
  // termasuk setelah perangkat itu dimatikan dari Profil.
  useEffect(() => {
    if (loading || subscriptions === 0) return;
    const state = readPromptState(userId);
    if (state.count < MAX_PROMPTS) markPromptHandled(userId);
  }, [loading, subscriptions, userId]);

  useEffect(() => {
    if (loading || !canActivate || !neverActivated) return;

    const state = readPromptState(userId);
    if (state.count >= MAX_PROMPTS) return;
    if (state.until > Date.now()) return;

    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") setOpen(true);
    }, PROMPT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [loading, canActivate, neverActivated, userId]);

  function dismiss() {
    const state = readPromptState(userId);
    writePromptState(userId, {
      count: state.count + 1,
      until: Date.now() + SNOOZE_MS,
    });
    setOpen(false);
    setError(null);
  }

  async function activateNow() {
    setError(null);
    const result = await activate();

    if (result.ok) {
      markPromptHandled(userId);
      setOpen(false);
      return;
    }

    if (result.reason === "denied" || result.reason === "unsupported") {
      markPromptHandled(userId);
      setOpen(false);
      toast.error(result.message);
      return;
    }

    setError(result.message);
  }

  return (
    <Modal
      open={open}
      onClose={dismiss}
      title="Aktifkan notifikasi?"
      description="Dapatkan pemberitahuan pekerjaan baru, catatan, dan tindak lanjut langsung di perangkat ini."
      size="sm"
      dismissible={!busy}
      footer={
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={dismiss}
          >
            Nanti
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => {
              void activateNow();
            }}
          >
            {busy ? <Spinner /> : <BellRing aria-hidden="true" />}
            Aktifkan notifikasi
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <IconTile variant="soft" aria-hidden="true">
          <BellRing />
        </IconTile>
        <p className="text-sm text-muted-foreground">
          Browser akan meminta izin setelah kamu menekan tombol. Kotak notifikasi
          di aplikasi tetap berfungsi tanpa izin ini, dan kamu bisa mematikannya
          kapan saja di Profil.
        </p>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
