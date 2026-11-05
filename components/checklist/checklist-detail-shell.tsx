import type { ReactNode } from "react";
import { BackLink } from "@/components/ui";

export function ChecklistDetailShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <BackLink href="/checklist">Kembali ke Checklist</BackLink>
      {children}
    </div>
  );
}

export function ChecklistTemplateDetailShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-6 lg:gap-8">
      <BackLink href="/checklist/template">Kembali ke Template & lokasi</BackLink>
      {children}
    </div>
  );
}

export function ChecklistEquipmentDetailShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-6 lg:gap-8">
      <BackLink href="/checklist/peralatan">Kembali ke Peralatan</BackLink>
      {children}
    </div>
  );
}
