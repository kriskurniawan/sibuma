"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { useSessionUser } from "@/components/session-user-provider";
import { BackLink, PageHeader } from "@/components/ui";

export function ManualWorkDetailShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 pb-8">
      <BackLink href="/pekerjaan">Kembali ke Pekerjaan harian</BackLink>
      {children}
    </div>
  );
}

export function ManualWorkFormShell({
  mode,
  children,
}: {
  mode: "create" | "edit";
  children: ReactNode;
}) {
  const user = useSessionUser();
  const params = useParams<{ id?: string }>();
  const canAssign = user.role === "atasan";
  const editing = mode === "edit";

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={editing && params.id ? `/pekerjaan/${params.id}` : "/pekerjaan"}>
        {editing ? "Kembali ke detail pekerjaan" : "Kembali ke Pekerjaan harian"}
      </BackLink>
      <PageHeader
        mobileCompact
        eyebrow="Pekerjaan harian"
        title={
          editing
            ? canAssign ? "Ubah pekerjaan harian" : "Ubah catatan pekerjaan"
            : canAssign ? "Buat pekerjaan harian" : "Catat pekerjaan harian"
        }
        description={
          canAssign
            ? "Catat pekerjaan harian dengan dokumentasi foto dan video. Satu pekerjaan boleh berlangsung beberapa hari."
            : "Catat pekerjaan yang kamu dan tim kerjakan. Satu pekerjaan boleh berlangsung beberapa hari."
        }
      />
      {children}
    </div>
  );
}
