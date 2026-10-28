import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { PwaRegister } from "@/components/pwa-register";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
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
  themeColor: "#112c25",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <body>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster
          position="top-center"
          closeButton
          richColors
          toastOptions={{
            classNames: {
              toast: "font-sans",
            },
          }}
        />
        <PwaRegister />
      </body>
    </html>
  );
}
