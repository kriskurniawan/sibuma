"use client";

import { useEffect } from "react";

/**
 * Menandai bahwa React sudah terhidrasi. Script beforeInteractive berhenti
 * mencatat klik pemicu dialog setelah ini, karena handler React sudah aktif.
 */
export function HydrationMarker() {
  useEffect(() => {
    window.__sibumaHydrated = true;
  }, []);

  return null;
}
