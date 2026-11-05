"use client";

/**
 * Script inline yang harus berjalan saat HTML pertama kali diparse.
 *
 * React memperingatkan `<script>` yang dirender di klien karena skrip seperti
 * itu tidak akan dieksekusi. Saat SSR kita tetap mengirim `text/javascript`
 * agar browser menjalankannya; saat hidrasi di klien atribut diganti menjadi
 * `text/plain` yang inert. `suppressHydrationWarning` menutup selisih atribut
 * tersebut.
 */
export function InlineScript({
  id,
  html,
}: {
  id?: string;
  html: string;
}) {
  return (
    <script
      id={id}
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
    >
      {html}
    </script>
  );
}
