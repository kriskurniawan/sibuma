"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Save, Send } from "lucide-react";
import { useSessionUser } from "@/components/session-user-provider";
import { Avatar } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

function FieldSkeleton({ label, multiline = false }: { label: string; multiline?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <Skeleton className={multiline ? "h-28 w-full" : "h-8 w-full"} />
    </div>
  );
}

export function ManualWorkFormSkeleton({ mode = "create" }: { mode?: "create" | "edit" }) {
  const user = useSessionUser();
  const params = useParams<{ id?: string }>();
  const canAssign = user.role === "atasan";
  const editing = mode === "edit";
  const backHref = editing && params.id ? `/pekerjaan/${params.id}` : "/pekerjaan";

  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-5 pb-24 xl:pb-0">
      <span className="sr-only">Memuat formulir pekerjaan harian…</span>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Frame>
            <FrameHeader>
              <FrameTitle>Rincian pekerjaan</FrameTitle>
              <FrameDescription>
                Jelaskan pekerjaan dengan jelas agar pekerja memahami hasil yang diharapkan.
              </FrameDescription>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-4">
              <FieldSkeleton label="Nama pekerjaan *" />
              <FieldSkeleton label="Deskripsi *" multiline />
              <FieldSkeleton label="Lokasi *" />
              <FieldSkeleton label="Nama petugas safety" />
            </FramePanel>
          </Frame>
          <Frame>
            <FrameHeader>
              <FrameTitle>Jadwal</FrameTitle>
              <FrameDescription>
                Satu pekerjaan boleh berlangsung beberapa hari. Target selesai bersifat opsional.
              </FrameDescription>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldSkeleton label="Tanggal mulai *" />
                <FieldSkeleton label="Target selesai" />
              </div>
              <div className="flex items-start justify-between gap-4 border-t border-border/70 pt-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">Wajib dokumentasi foto</span>
                  <p className="text-xs text-muted-foreground">Minimal satu foto sebelum pekerjaan dapat diselesaikan.</p>
                </div>
                <Skeleton className="h-5 w-9 shrink-0" />
              </div>
              {canAssign && (
                <div className="flex items-start justify-between gap-4 border-t border-border/70 pt-4">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium">Tampilkan ke pengunjung</span>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Judul, deskripsi, status, jadwal, dan nama petugas safety tampil di halaman area pengunjung. Foto, nama pekerja, dan catatan hasil tetap internal. Pekerjaan hanya muncul bila area lokasinya juga diaktifkan untuk pengunjung.
                    </p>
                  </div>
                  <Skeleton className="h-5 w-9 shrink-0" />
                </div>
              )}
            </FramePanel>
          </Frame>
        </div>
        <aside className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-20 xl:self-start">
          <Frame spacing="sm">
            <FrameHeader>
              <FrameTitle>Siapa yang bekerja</FrameTitle>
              <FrameDescription>
                {canAssign
                  ? "Pilih satu atau beberapa pekerja per divisi. Mereka dapat memulai, mengunggah bukti, dan menyelesaikan pekerjaan."
                  : "Pilih siapa saja yang ikut mengerjakan, bisa lebih dari satu. Kamu tercatat sebagai pelapor."}
              </FrameDescription>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              {!canAssign && (
                <>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={user.name} seed={user.id} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{user.name}</span>
                      <span className="truncate text-xs text-muted-foreground tabular-nums">{user.nik}</span>
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">Pelapor</span>
                  </div>
                  {!editing && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-muted-foreground">Penanggung jawab</span>
                      <span className="text-sm font-medium">{user.supervisorName ?? "Belum tersedia"}</span>
                    </div>
                  )}
                  <div className="border-t border-border/70" />
                </>
              )}
              <Skeleton className="h-3 w-28" />
              <FieldSkeleton label="Cari pekerja" />
              <FieldSkeleton label="Divisi" />
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex items-center gap-2.5">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="flex flex-1 flex-col gap-1">
                    <Skeleton className="h-3.5 w-32 max-w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="size-4 shrink-0" />
                </div>
              ))}
            </FramePanel>
            <FrameFooter className="hidden xl:flex">
              <Button type="button" disabled className="w-full">
                {editing ? <Save aria-hidden="true" /> : <Send aria-hidden="true" />}
                {editing ? "Simpan perubahan" : canAssign ? "Buat pekerjaan" : "Catat pekerjaan"}
              </Button>
            </FrameFooter>
          </Frame>
          {canAssign && (
            <Frame spacing="sm">
              <FrameHeader>
                <FrameTitle>Tindak lanjut</FrameTitle>
                <FrameDescription>Opsional. Tautkan bila pekerjaan ini menindaklanjuti temuan checklist.</FrameDescription>
              </FrameHeader>
              <FramePanel><Skeleton className="h-8 w-full" /></FramePanel>
            </Frame>
          )}
        </aside>
      </div>
      <div className="mobile-action-bar fixed inset-x-0 z-30 border-t border-border bg-background px-4 pt-2.5 xl:hidden">
        <div className="mx-auto flex max-w-2xl gap-2.5">
          <Button variant="outline" nativeButton={false} render={<Link href={backHref} />} className="flex-1">Batal</Button>
          <Button type="button" disabled className="flex-[1.4]">
            {editing ? <Save aria-hidden="true" /> : <Send aria-hidden="true" />}
            {editing ? "Simpan" : canAssign ? "Buat" : "Catat"}
          </Button>
        </div>
      </div>
    </div>
  );
}
