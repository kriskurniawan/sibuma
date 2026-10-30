import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Eye } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { PublicRefreshButton } from "@/components/checklist/public-refresh-button";
import { Frame, FramePanel } from "@/components/reui/frame";
import { Badge, EmptyState } from "@/components/ui";
import { Button } from "@/components/ui/button";

export function PublicShell({
  children,
  backHref,
  backLabel = "Semua area",
}: {
  children: ReactNode;
  backHref?: string | null;
  backLabel?: string;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <a
        href="#public-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 focus:bg-background focus:p-2 focus:text-sm focus:text-foreground"
      >
        Lewati ke konten
      </a>
      <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-2 px-3 sm:px-5">
          {backHref && (
            <Button
              size="icon-sm"
              variant="ghost"
              nativeButton={false}
              aria-label={`Kembali ke ${backLabel.toLowerCase()}`}
              render={<Link href={backHref} />}
            >
              <ArrowLeft aria-hidden="true" />
            </Button>
          )}
          <div className="flex min-w-0 items-center gap-2">
            <LogoMark className="size-7 shrink-0" />
            <span className="truncate text-sm font-semibold tracking-tight text-foreground">
              SIBUMA
            </span>
          </div>
          <Badge variant="outline" className="ml-auto shrink-0">
            <Eye aria-hidden="true" />
            Publik
          </Badge>
        </div>
      </header>

      <main
        id="public-content"
        className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6 md:gap-6 md:py-8"
      >
        {children}
      </main>

      <footer className="mx-auto flex w-full max-w-4xl flex-col gap-1 px-4 pb-6 sm:px-6">
        <div className="flex flex-col gap-1 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
          <p>Hasil publik tidak memuat catatan, foto, atau identitas petugas.</p>
          <p>Butuh bantuan? Hubungi petugas gedung setempat.</p>
        </div>
      </footer>
    </div>
  );
}

export function PublicUnavailable({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <PublicShell>
      <h1 className="sr-only">{title}</h1>
      <Frame spacing="default">
        <FramePanel>
          <EmptyState
            icon={Eye}
            title={title}
            description={description}
            action={<PublicRefreshButton label="Coba lagi" />}
          />
        </FramePanel>
      </Frame>
    </PublicShell>
  );
}
