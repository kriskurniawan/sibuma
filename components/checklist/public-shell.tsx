import type { ReactNode } from "react";
import { Eye } from "lucide-react";
import { Logo } from "@/components/logo";
import { Badge, EmptyState } from "@/components/ui";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-4xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Logo compact />
        <Badge variant="outline">
          <Eye aria-hidden="true" />
          Informasi publik
        </Badge>
      </header>

      {children}

      <footer className="mt-auto flex flex-col gap-1 border-t border-border/70 pt-4 text-xs leading-relaxed text-muted-foreground">
        <p>
          Halaman ini menampilkan hasil checklist yang dipublikasikan. Catatan,
          foto, dan identitas petugas tidak ditampilkan.
        </p>
        <p>Butuh bantuan? Hubungi petugas gedung setempat.</p>
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
      <div className="rounded-xl border border-border/70 bg-card px-4 py-8">
        <EmptyState icon={Eye} title={title} description={description} />
      </div>
    </PublicShell>
  );
}
