import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SIBUMA — Sistem Building Management",
    short_name: "SIBUMA",
    description:
      "Checklist operasional building management dengan temuan, tindak lanjut, dan pemantauan area.",
    start_url: "/",
    id: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7fb",
    theme_color: "#623bbd",
    lang: "id",
    orientation: "portrait",
    // Membuat PWA bisa mendeteksi dirinya sendiri lewat
    // navigator.getInstalledRelatedApps(), termasuk saat dibuka di tab browser.
    related_applications: [
      {
        platform: "webapp",
        url: "/manifest.webmanifest",
        id: "/",
      },
    ],
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
