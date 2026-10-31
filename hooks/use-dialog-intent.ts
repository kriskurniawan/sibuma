"use client";

import { useEffect, useRef } from "react";

// Dicatat saat interaksi, tidak pernah dibaca untuk menghasilkan markup render.
declare global {
  interface Window {
    __sibumaDialogIntent?: string;
    __sibumaDialogIntentAt?: number;
    __sibumaDialogIntentElement?: Element;
    __sibumaDialogIntentPath?: string;
    __sibumaDialogTriggerElement?: Element;
    __sibumaDialogTriggerAt?: number;
    __sibumaHydrated?: boolean;
  }
}

/**
 * Menerima intent saat handler halaman siap, termasuk klik sebelum hidrasi.
 * Marker root tidak menentukan kesiapan boundary halaman atau navigasi berikutnya.
 */
export function useDialogIntent(intent: string, onOpen: () => void) {
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    function consumeIntent() {
      // Bandingkan dengan path saat ini, bukan path saat effect dipasang:
      // komponen bisa bertahan melewati navigasi klien.
      const pathname = window.location.pathname;
      if (window.__sibumaDialogIntentPath !== pathname) return;
      if (window.__sibumaDialogIntent !== intent) return;

      const trigger = window.__sibumaDialogIntentElement;
      const at = window.__sibumaDialogIntentAt ?? 0;
      delete window.__sibumaDialogIntent;
      delete window.__sibumaDialogIntentAt;
      delete window.__sibumaDialogIntentElement;
      delete window.__sibumaDialogIntentPath;
      // Koneksi elemen + pathname membatasi intent pada instance halaman ini.
      // Tidak memakai TTL: JavaScript lambat tidak boleh membuang klik pengguna.
      if (!trigger?.isConnected) return;

      window.__sibumaDialogTriggerElement = trigger;
      window.__sibumaDialogTriggerAt = at;
      onOpenRef.current();
    }

    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest<HTMLElement>("[data-dialog-intent]");
      if (!trigger || trigger.dataset.dialogIntent !== intent) return;
      if (
        trigger.matches(":disabled, [aria-disabled='true']") ||
        trigger.closest("[inert]")
      ) {
        return;
      }
      window.__sibumaDialogIntent = intent;
      // Laju waktu dicatat hanya saat event, tidak dipakai dalam markup (C4).
      window.__sibumaDialogIntentAt = Date.now();
      window.__sibumaDialogIntentElement = trigger;
      window.__sibumaDialogIntentPath = window.location.pathname;
      consumeIntent();
    }

    document.addEventListener("click", handleClick, true);
    consumeIntent();
    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [intent]);
}
