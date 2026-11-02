import type { ReactNode } from "react";
import { BackLink } from "@/components/ui";

export function NoteDetailShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 pb-8">
      <BackLink href="/catatan">Kembali ke Catatan</BackLink>
      {children}
    </div>
  );
}
