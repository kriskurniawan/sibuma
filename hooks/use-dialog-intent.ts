"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    __sibumaDialogIntent?: string;
    __sibumaDialogIntentAt?: number;
    __sibumaHydrated?: boolean;
  }
}

const MAX_INTENT_AGE_MS = 5000;

/**
 * Menjalankan dialog yang dipilih sebelum React selesai hidrasi.
 *
 * Klik pertama pada halaman yang masih memuat tidak memiliki handler React.
 * Script beforeInteractive mencatat niatnya, lalu hook ini memutarnya setelah
 * komponen siap. Intent yang terlalu lama dibuang agar tidak membuka dialog
 * yang tidak diinginkan setelah navigasi.
 */
export function useDialogIntent(intent: string, onOpen: () => void) {
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    // Handler React sudah aktif; klik berikutnya tidak perlu dicatat lagi.
    window.__sibumaHydrated = true;

    const pending = window.__sibumaDialogIntent;
    if (!pending) return;

    const at = window.__sibumaDialogIntentAt ?? 0;
    // Date.now() hanya dibaca di effect untuk membuang intent kedaluwarsa.
    if (Date.now() - at > MAX_INTENT_AGE_MS) {
      delete window.__sibumaDialogIntent;
      delete window.__sibumaDialogIntentAt;
      return;
    }
    if (pending !== intent) return;

    delete window.__sibumaDialogIntent;
    delete window.__sibumaDialogIntentAt;
    onOpenRef.current();
  }, [intent]);
}
