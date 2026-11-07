import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { HydrationMarker } from "@/components/hydration-marker";
import { InlineScript } from "@/components/inline-script";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeColorSync } from "@/components/theme-color-sync";
import { ThemeToaster } from "@/components/theme-toaster";
import { TimeZoneBootstrap } from "@/components/time-zone-bootstrap";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_NAME, APP_TAGLINE, APP_TIMEZONE } from "@/lib/constants";
import { THEME_COLOR, THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Checklist operasional building management: isi area kerja, pantau temuan, dan tindak lanjuti bersama tim.",
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  icons: {
    apple: [{ url: "/icons/icon-180-v4.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description:
      "Checklist area, temuan, dan tindak lanjut operasional gedung dalam satu alur.",
    type: "website",
    locale: "id_ID",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning data-scroll-behavior="smooth">
      {/* Browser extensions can add attributes to <body> before hydration. */}
      <body suppressHydrationWarning>
        <TimeZoneBootstrap timeZone={APP_TIMEZONE} />
        {/* Inline sengaja: beforeInteractive baru dieksekusi setelah bootstrap
            Next diunduh. Capture harus aktif sebelum tombol SSR terlihat. */}
        <InlineScript
          id="dialog-intent"
          html={`(function () {
  var INTENT = "__sibumaDialogIntent";
  var AT = "__sibumaDialogIntentAt";
  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || typeof target.closest !== "function") return;
    var trigger = target.closest("[data-dialog-intent]");
    if (!trigger || trigger.matches(":disabled, [aria-disabled='true']") || trigger.closest("[inert]")) return;
    var intent = trigger.getAttribute("data-dialog-intent");
    if (!intent) return;
    window[INTENT] = intent;
    window.__sibumaDialogIntentElement = trigger;
    window.__sibumaDialogIntentPath = window.location.pathname;
    // Clock is read only in this click handler to identify dialog intent;
    // it is never rendered or used as an SSR/hydration value (C4 exception).
    window[AT] = Date.now();
    // Listener halaman menerima klik yang sama; jika belum siap, intent
    // tetap tersimpan sampai handler halaman tersebut terpasang.
  }, true);
})();`}
        />
        <InlineScript
          id="pwa-install-capture"
          html={`(function () {
  window.__sibumaInstallPrompt = null;
  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    window.__sibumaInstallPrompt = event;
  });
  window.addEventListener("appinstalled", function () {
    window.__sibumaInstallPrompt = null;
  });
})();`}
        />
        <HydrationMarker />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey={THEME_STORAGE_KEY}
          disableTransitionOnChange
        >
          <TooltipProvider>{children}</TooltipProvider>
          <ThemeToaster />
          <ThemeColorSync />
          <PwaRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
