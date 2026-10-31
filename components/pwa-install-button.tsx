"use client";

import { useEffect, useState } from "react";
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

declare global {
  interface Window {
    __sibumaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

/**
 * Tombol pasang PWA di header mobile. Hanya tampil saat aplikasi belum dibuka
 * dalam mode terpasang. Browser yang mendukung beforeinstallprompt memakai
 * dialog bawaan; browser lain mendapat petunjuk manual.
 */
export function PwaInstallButton() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");

    function syncInstalled() {
      const next = isStandalone();
      setInstalled(next);
      if (next) {
        window.__sibumaInstallPrompt = null;
        setPromptEvent(null);
        setInstructionsOpen(false);
      }
    }

    function capture(event: Event) {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      window.__sibumaInstallPrompt = installEvent;
      setPromptEvent(installEvent);
    }

    function handleInstalled() {
      window.__sibumaInstallPrompt = null;
      setPromptEvent(null);
      setInstalled(true);
      setInstructionsOpen(false);
    }

    syncInstalled();
    setPromptEvent(window.__sibumaInstallPrompt ?? null);
    setReady(true);

    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", handleInstalled);
    media.addEventListener("change", syncInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", handleInstalled);
      media.removeEventListener("change", syncInstalled);
    };
  }, []);

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
      if (choice.outcome === "accepted") {
        setInstalled(true);
        setInstructionsOpen(false);
      }
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
