"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useParams } from "next/navigation";
import { useSessionUser } from "@/components/session-user-provider";
import { BackLink, Badge, PageHeader } from "@/components/ui";

export function SpklBackLink({ children }: { children?: ReactNode }) {
  const user = useSessionUser();
  const href = user.role === "super_admin"
    ? "/laporan?tab=lembur"
    : user.role === "atasan" ? "/lembur" : "/riwayat";
  return (
    <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
      <BackLink href={href}>
        {user.role === "super_admin" ? "Kembali ke laporan" : "Kembali ke lembur"}
      </BackLink>
      {children}
    </div>
  );
}

export function SpklDetailStatusSkeleton() {
  return <Skeleton className="ml-auto h-6 w-24" />;
}

export function SpklFormHeading({ mode }: { mode: "create" | "edit" }) {
  const params = useParams<{ id?: string }>();
  const editing = mode === "edit";
  return (
    <>
      <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
        <BackLink href={editing && params.id ? `/spkl/${params.id}` : "/lembur"}>
          {editing ? "Kembali ke detail SPKL" : "Kembali ke lembur"}
        </BackLink>
        <Badge variant="primary-light" dot className="ml-auto">
          {editing ? "Ubah SPKL" : "SPKL baru"}
        </Badge>
      </div>
      <PageHeader
        mobileCompact
        title={editing ? "Ubah SPKL" : "Buat SPKL"}
        description="Tentukan pekerjaan, jadwal, lokasi, dan pekerja."
        descriptionClassName="hidden md:block"
      />
    </>
  );
}

/** Same action-bar positions as the form; submission waits for required data. */
export function SpklFormPendingActions({ mode }: { mode: "create" | "edit" }) {
  const params = useParams<{ id?: string }>();
  return (
    <div className="mobile-action-bar fixed inset-x-0 z-30 border-t border-border bg-background px-4 pt-2.5 xl:hidden">
      <div className="mx-auto flex max-w-2xl gap-2.5">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={mode === "edit" && params.id ? `/spkl/${params.id}` : "/lembur"} />}
          className="flex-1"
        >
          Batal
        </Button>
        <Button type="button" disabled className="flex-[1.4]">
          {mode === "create" ? <Send aria-hidden="true" /> : <Save aria-hidden="true" />}
          {mode === "create" ? "Buat SPKL" : "Simpan"}
        </Button>
      </div>
    </div>
  );
}

export function SpklFormShell({ mode, children }: {
  mode: "create" | "edit";
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <SpklFormHeading mode={mode} />
      {children}
    </div>
  );
}
