import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeColorSync } from "@/components/theme-color-sync";
import { ThemeToaster } from "@/components/theme-toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
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
