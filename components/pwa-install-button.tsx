"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

interface RelatedApplication {
  platform: string;
  id?: string;
  url?: string;
  version?: string;
}

declare global {
  interface Navigator {
    /**
     * Didukung Chrome/Edge (Android sejak 84, desktop sejak 140). Tidak ada di
     * Safari/Firefox, sehingga hasilnya tidak bisa diandalkan di sana.
     */
    getInstalledRelatedApps?: () => Promise<RelatedApplication[]>;
  }

  interface Window {
    __sibumaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

const INSTALLED_STORAGE_KEY = "sibuma:pwa-installed";
/** Jangan menahan tombol terlalu lama bila API deteksi tidak merespons. */
const DETECTION_TIMEOUT_MS = 1200;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function readInstalledMarker() {
  try {
    return window.localStorage.getItem(INSTALLED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Penanda lokal dipakai saat API deteksi tidak tersedia (mis. Safari) atau
 * saat aplikasi pernah dibuka dalam mode terpasang, agar tombol tidak muncul
 * lagi di tab browser.
 */
function writeInstalledMarker(installed: boolean) {
  try {
    if (installed) window.localStorage.setItem(INSTALLED_STORAGE_KEY, "1");
    else window.localStorage.removeItem(INSTALLED_STORAGE_KEY);
  } catch {
    // Penyimpanan bisa diblokir; deteksi per sesi tetap berjalan.
  }
}

/** `true` hanya jika browser memastikan ada PWA terkait yang terpasang. */
async function detectInstalledApp() {
  if (typeof navigator.getInstalledRelatedApps !== "function") return false;
  try {
    const apps = await navigator.getInstalledRelatedApps();
    return apps.length > 0;
  } catch {
    return false;
  }
}

/**
 * Tombol pasang PWA di header mobile. Hanya tampil saat aplikasi belum
 * terpasang, baik saat dibuka di tab browser maupun di dalam aplikasi.
 */
export function PwaInstallButton() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  const markInstalled = useCallback(() => {
    window.__sibumaInstallPrompt = null;
    writeInstalledMarker(true);
    setPromptEvent(null);
    setInstalled(true);
    setInstructionsOpen(false);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    let disposed = false;

    function syncDisplayMode() {
      if (isStandalone()) markInstalled();
    }

    function capture(event: Event) {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      window.__sibumaInstallPrompt = installEvent;
      // Browser hanya menawarkan pemasangan bila PWA belum terpasang, jadi
      // penanda lama (mis. setelah uninstall) harus dihapus.
      writeInstalledMarker(false);
      setPromptEvent(installEvent);
      setInstalled(false);
    }

    function handleInstalled() {
      markInstalled();
    }

    async function recheck() {
      if (document.visibilityState === "hidden") return;
      const detected = await detectInstalledApp();
      if (!disposed && detected) markInstalled();
    }

    const earlyPrompt = window.__sibumaInstallPrompt ?? null;
    syncDisplayMode();

    if (earlyPrompt) {
      setPromptEvent(earlyPrompt);
      writeInstalledMarker(false);
      setReady(true);
    } else if (isStandalone()) {
      setReady(true);
    } else if (readInstalledMarker()) {
      setInstalled(true);
      setReady(true);
    } else {
      const timer = window.setTimeout(() => {
        if (!disposed) setReady(true);
      }, DETECTION_TIMEOUT_MS);
      void detectInstalledApp().then((detected) => {
        if (disposed) return;
        window.clearTimeout(timer);
        if (detected) markInstalled();
        setReady(true);
      });
    }

    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    media.addEventListener("change", syncDisplayMode);

    return () => {
      disposed = true;
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
      media.removeEventListener("change", syncDisplayMode);
    };
  }, [markInstalled]);

  async function install() {
    if (installing) return;
    if (!promptEvent) {
      setInstructionsOpen(true);
      return;
    }

    setInstalling(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      window.__sibumaInstallPrompt = null;
      setPromptEvent(null);
      if (choice.outcome === "accepted") markInstalled();
    } catch {
      setInstructionsOpen(true);
    } finally {
      setInstalling(false);
    }
  }

  if (!ready || installed) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="md:hidden"
        aria-label="Pasang aplikasi SIBUMA"
        disabled={installing}
        onClick={() => void install()}
      >
        {installing ? <Spinner /> : <Download aria-hidden="true" />}
        <span>Pasang</span>
      </Button>

      <Modal
        open={instructionsOpen}
        onClose={() => setInstructionsOpen(false)}
        title="Pasang SIBUMA"
        description="Buka SIBUMA langsung dari layar utama, tanpa melalui browser."
        size="sm"
        mobileSheet
        footer={
          <Button
            type="button"
            size="sm"
            onClick={() => setInstructionsOpen(false)}
          >
            Mengerti
          </Button>
        }
      >
        <ol className="flex flex-col gap-3">
          {[
            "Buka menu browser: ikon ⋮ di Chrome atau tombol Bagikan di Safari.",
            "Pilih Instal aplikasi atau Tambahkan ke Layar Utama.",
            "Konfirmasi, lalu buka SIBUMA dari layar utama.",
          ].map((step, index) => (
            <li key={step} className="flex items-start gap-3 text-sm">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums text-foreground">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-muted-foreground">
          Jika opsi tidak tersedia, buka SIBUMA melalui Chrome di Android atau
          Safari di iPhone.
        </p>
      </Modal>
    </>
  );
}
