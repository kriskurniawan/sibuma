"use client";

import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes";

/**
 * next-themes menyisipkan <script> inline untuk menerapkan tema sebelum paint.
 * React 19 memperingatkan <script> yang dirender di klien, jadi pola resmi Next
 * dipakai: `text/javascript` saat SSR agar browser mengeksekusinya, lalu
 * `text/plain` (inert) saat render klien. next-themes sudah memasang
 * `suppressHydrationWarning` pada script tersebut.
 */
export function ThemeProvider({ scriptProps, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      {...props}
      scriptProps={{
        ...scriptProps,
        type: typeof window === "undefined" ? "text/javascript" : "text/plain",
      }}
    />
  );
}
