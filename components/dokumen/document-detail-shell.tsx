import type { ReactNode } from "react";
import { BackLink } from "@/components/ui";

export function DocumentDetailShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 pb-8">
      <BackLink href="/dokumen">Kembali ke Dokumen kerja</BackLink>
      {children}
    </div>
  );
}
