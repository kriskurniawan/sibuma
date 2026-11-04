"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

const HOME_PATH = "/";
const GUARD_STATE_KEY = "__sibumaHomeGuard";
const EXIT_WINDOW_MS = 2000;
const TOAST_ID = "sibuma-exit-hint";

function isMobileViewport() {
  return window.matchMedia("(max-width: 767px)").matches;
}

/**
 * Menahan tombol kembali perangkat di beranda agar tidak membuka menu/halaman
 * sebelumnya. Setiap tekanan kembali hanya menghabiskan entri penahan riwayat,
 * lalu penahan dipasang lagi. Dua tekanan dalam dua detik mencoba menutup
 * aplikasi; PWA terpasang menutup/meminimalkan jendela, sedangkan tab browser
 * biasa mengabaikannya sehingga riwayat tetap tertahan di beranda.
 */
export function MobileHomeBackGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== HOME_PATH || !isMobileViewport()) return;

    let exitArmed = false;
    let resetTimer: number | undefined;
    let closeCheckTimer: number | undefined;

    function pushGuard() {
      window.history.pushState(
        { ...window.history.state, [GUARD_STATE_KEY]: true },
        "",
        window.location.href,
      );
    }

    function handlePopState() {
      if (window.location.pathname !== HOME_PATH) return;
      pushGuard();

      if (!exitArmed) {
        exitArmed = true;
        toast("Tekan tombol kembali sekali lagi untuk keluar.", {
          id: TOAST_ID,
          duration: EXIT_WINDOW_MS,
        });
        window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(() => {
          exitArmed = false;
        }, EXIT_WINDOW_MS);
        return;
      }

      exitArmed = false;
      window.clearTimeout(resetTimer);
      window.close();
      window.clearTimeout(closeCheckTimer);
      closeCheckTimer = window.setTimeout(() => {
        if (document.visibilityState !== "visible") return;
        toast("Tutup aplikasi atau tab untuk keluar.", {
          id: TOAST_ID,
          duration: 3000,
        });
      }, 300);
    }

    pushGuard();
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.clearTimeout(resetTimer);
      window.clearTimeout(closeCheckTimer);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [pathname]);

  return null;
}
