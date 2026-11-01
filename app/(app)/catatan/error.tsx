"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Frame, FramePanel } from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui";

export default function CatatanError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Halaman Catatan gagal dimuat:", error);
  }, [error]);

  return (
    <Frame>
      <FramePanel>
        <EmptyState
          icon={AlertTriangle}
          title="Catatan gagal dimuat"
          description="Terjadi kendala saat memuat catatan. Coba lagi; jika masih gagal, kembali ke daftar Catatan."
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
                render={<Link href="/catatan" />}
              >
                Kembali ke Catatan
              </Button>
            </div>
          }
        />
      </FramePanel>
    </Frame>
  );
}
