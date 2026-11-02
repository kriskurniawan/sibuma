"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Frame, FramePanel } from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui";

export default function NotificationError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Halaman Notifikasi gagal dimuat:", error);
  }, [error]);

  return (
    <Frame>
      <FramePanel>
        <EmptyState
          icon={AlertTriangle}
          title="Notifikasi gagal dimuat"
          description="Terjadi kendala saat memuat kotak notifikasi. Coba lagi; jika masih gagal, kembali ke beranda."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button type="button" size="sm" onClick={() => retry()}>
                <RotateCcw aria-hidden="true" />
                Coba lagi
              </Button>
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href="/" />}
              >
                Kembali ke beranda
              </Button>
            </div>
          }
        />
      </FramePanel>
    </Frame>
  );
}
