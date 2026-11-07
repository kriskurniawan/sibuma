"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { PwaInstallInstructions } from "@/components/pwa-install-instructions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  hasRelatedPwa,
  isPwaStandalone,
  type RelatedPwaApplication,
} from "@/lib/pwa-client";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

declare global {
  interface Navigator {
    /**
     * Didukung Chrome/Edge (Android sejak 84, desktop sejak 140). Tidak ada di
     * Safari/Firefox, sehingga hasilnya tidak bisa diandalkan di sana.
     */
    getInstalledRelatedApps?: () => Promise<RelatedPwaApplication[]>;
  }

  interface Window {
    __sibumaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

/** Jangan menahan tombol terlalu lama bila API deteksi tidak merespons. */
const DETECTION_TIMEOUT_MS = 1200;

/** null means unknown, not proof that a confirmed installation was removed. */
async function detectInstalledApp(): Promise<boolean | null> {
  if (typeof navigator.getInstalledRelatedApps !== "function") return null;
  try {
    const apps = await navigator.getInstalledRelatedApps();
    return hasRelatedPwa(apps, window.location.origin);
  } catch {
    return null;
  }
}

/**
 * Hide only with current evidence: standalone, appinstalled this session,
 * or the related-app API.
 * Safari cannot reliably detect an existing Home Screen app from a browser
 * tab, so installation help stays accessible there (also after uninstall).
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
    setPromptEvent(null);
    setInstalled(true);
    setInstructionsOpen(false);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    let disposed = false;
    let revision = 0;
    let timer: number | undefined;

    // Older versions wrote a permanent marker. It is not evidence of a
    // current installation and must never hide installation help in Safari.
    try {
      window.localStorage.removeItem("sibuma:pwa-installed");
    } catch {
      // Storage can be blocked; detection does not depend on it.
    }

    function capture(event: Event) {
      revision += 1;
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      window.__sibumaInstallPrompt = installEvent;
      setPromptEvent(installEvent);
      setInstalled(false);
      setReady(true);
    }

    function handleInstalled() {
      revision += 1;
      markInstalled();
      setReady(true);
    }

    async function recheck() {
      if (document.visibilityState === "hidden") return;
      const current = ++revision;
      if (isPwaStandalone()) {
        handleInstalled();
        return;
      }
      if (window.__sibumaInstallPrompt) {
        setPromptEvent(window.__sibumaInstallPrompt);
        setInstalled(false);
        setReady(true);
        return;
      }
      const detected = await detectInstalledApp();
      if (disposed || current !== revision) return;
      // Re-evaluate both ways when the API knows; preserve a current-session
      // appinstalled confirmation if detection is unavailable or fails.
      if (detected === true) markInstalled();
      else if (detected === false) setInstalled(false);
      setReady(true);
    }

    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    media.addEventListener("change", recheck);

    timer = window.setTimeout(() => {
      if (!disposed) setReady(true);
    }, DETECTION_TIMEOUT_MS);
    void recheck();

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
      media.removeEventListener("change", recheck);
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
      await promptEvent.userChoice;
      window.__sibumaInstallPrompt = null;
      setPromptEvent(null);
      // Acceptance is not completion; appinstalled confirms installation.
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

      <PwaInstallInstructions
        open={instructionsOpen}
        onClose={() => setInstructionsOpen(false)}
      />
    </>
  );
}
