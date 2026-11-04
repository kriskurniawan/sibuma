"use client";

import { useEffect, useId, useRef } from "react";

const HISTORY_STATE_KEY = "__sibumaDialogHistory";

function stateWithMarker(marker: string) {
  const current: unknown = window.history.state;
  const base =
    current && typeof current === "object"
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, [HISTORY_STATE_KEY]: marker };
}

function hasMarker(marker: string) {
  const current: unknown = window.history.state;
  if (!current || typeof current !== "object") return false;
  return (
    (current as Record<string, unknown>)[HISTORY_STATE_KEY] === marker
  );
}

/**
 * Menautkan dialog layar penuh dengan riwayat browser. Membuka dialog menambah
 * satu entri riwayat, sehingga tombol kembali perangkat hanya menutup dialog
 * dan tetap berada di halaman saat ini. Menutup lewat tombol atau latar dialog
 * membuang entri tambahan itu agar kembali berikutnya langsung meninggalkan
 * halaman. Entri tidak dibuang saat komponen dilepas karena dialog terbuka,
 * sebab navigasi ke halaman lain tidak boleh dibatalkan.
 */
export function useDialogHistory(open: boolean, onClose: () => void) {
  const marker = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Diperbarui saat render agar cleanup tahu apakah dialog benar-benar
  // ditutup pengguna atau hanya dipasang ulang StrictMode saat pengembangan.
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!open) return;

    // Pemasangan ulang StrictMode memakai marker yang sama; jangan menumpuk
    // entri kedua yang nanti butuh dua kali kembali untuk ditinggalkan.
    if (!hasMarker(marker)) {
      window.history.pushState(stateWithMarker(marker), "", window.location.href);
    }
    let closedByPop = false;

    function handlePopState() {
      closedByPop = true;
      onCloseRef.current();
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (!closedByPop && !openRef.current && hasMarker(marker)) {
        window.history.back();
      }
    };
  }, [marker, open]);
}
