"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { PublicShell } from "@/components/checklist/public-shell";
import { Frame, FramePanel } from "@/components/reui/frame";
import { EmptyState } from "@/components/ui";
import { Button } from "@/components/ui/button";

export default function PublicError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <PublicShell>
      <h1 className="sr-only">Informasi belum dapat dimuat</h1>
      <Frame spacing="default">
        <FramePanel role="alert">
          <EmptyState
            icon={TriangleAlert}
            title="Informasi belum dapat dimuat"
            description="Periksa koneksi Anda, lalu coba lagi."
            action={
              <Button type="button" size="sm" onClick={retry}>
                <RefreshCw aria-hidden="true" />
                Coba lagi
              </Button>
            }
          />
        </FramePanel>
      </Frame>
    </PublicShell>
  );
}
