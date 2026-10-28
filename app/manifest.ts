import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SIBUMA — Sistem Building Management",
    short_name: "SIBUMA",
    description:
      "Checklist operasional building management dengan temuan, tindak lanjut, dan pemantauan area.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f3eb",
    theme_color: "#112c25",
    lang: "id",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
