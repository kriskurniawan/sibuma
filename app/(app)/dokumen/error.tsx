"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Frame, FramePanel } from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui";

export default function DokumenError({ reset }: { reset: () => void }) {
  return (
    <Frame>
      <FramePanel>
        <EmptyState
          icon={AlertTriangle}
          title="Dokumen kerja gagal dimuat"
          description="Terjadi kendala saat memuat daftar atau detail dokumen. Coba lagi; jika masih gagal, kembali ke beranda."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button type="button" size="sm" onClick={reset}>
                <RotateCcw />
                Coba lagi
              </Button>
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href="/" />}
              >
                Ke beranda
              </Button>
            </div>
          }
        />
      </FramePanel>
    </Frame>
  );
}
