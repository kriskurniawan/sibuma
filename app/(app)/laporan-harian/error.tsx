"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Frame, FramePanel } from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui";

export default function DailyReportError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Halaman Laporan harian gagal dimuat:", error);
  }, [error]);

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6 lg:gap-8">
      <PageHeader
        mobileCompact
        eyebrow="Operasional"
        title="Laporan harian"
        description="Teks dan kolase foto siap dibagikan ke WhatsApp."
      />
      <Frame spacing="default">
        <FramePanel>
          <EmptyState
            icon={AlertTriangle}
            title="Laporan harian gagal dimuat"
            description="Terjadi kendala saat menyiapkan laporan. Coba lagi; jika masih gagal, kembali ke beranda lalu buka halaman ini kembali."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button type="button" size="sm" onClick={() => retry()}>
                  <RotateCcw />
                  Coba lagi
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/" />}
                >
                  <Home />
                  Beranda
                </Button>
              </div>
            }
          />
        </FramePanel>
      </Frame>
    </div>
  );
}
