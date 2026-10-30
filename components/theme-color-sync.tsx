"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { THEME_COLOR } from "@/lib/theme";

/** Keep the browser chrome color aligned with the explicitly chosen theme. */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;

    const metas = Array.from(
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
    );
    const light = metas.find((meta) => meta.content === THEME_COLOR.light);
    const dark = metas.find((meta) => meta.content === THEME_COLOR.dark);
    if (!light || !dark) return;

    const isDark = resolvedTheme === "dark";
    light.media = isDark ? "not all" : "all";
    dark.media = isDark ? "all" : "not all";
  }, [resolvedTheme]);

  return null;
}
