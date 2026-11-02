"use client";

import { useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PenLine, RefreshCw, SearchX, StickyNote } from "lucide-react";
import { NoteCard } from "@/components/catatan/note-card";
import { NoteComposer } from "@/components/catatan/note-composer";
import { NoteFilters } from "@/components/catatan/note-filters";
import { DataLoadError } from "@/components/data-load-error";
import { ListPagination } from "@/components/list-pagination";
import { MobileFab } from "@/components/mobile-fab";
import { useSessionUser } from "@/components/session-user-provider";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { EmptyState, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { isReadOnly } from "@/lib/access";
import type { Note, NoteOptions } from "@/lib/note-types";
import type { PageRequest } from "@/lib/pagination";
import type { SessionUser } from "@/lib/types";

/** Real action labels stay in place while only their recipient options load. */
export function NoteComposerControl({
  options,
  error = false,
  trigger = "default",
  label = "Tulis catatan",
  user: snapshot,
}: {
  options?: NoteOptions;
  error?: boolean;
  trigger?: "default" | "fab";
  label?: string;
  /** Fresh page user; the layout snapshot is only a loading fallback. */
  user?: SessionUser;
}) {
  const sessionUser = useSessionUser();
  const user = snapshot ?? sessionUser;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (isReadOnly(user)) return null;
  if (options) return <NoteComposer options={options} trigger={trigger} label={label} />;

  if (trigger === "fab") {
    return (
      <MobileFab
        disabled={!error || pending}
        title={error ? "Pilihan penerima gagal dimuat. Coba lagi." : "Memuat pilihan penerima…"}
        onClick={() => startTransition(() => router.refresh())}
      >
        <PenLine aria-hidden="true" />
        {error ? "Coba lagi" : label}
      </MobileFab>
    );
  }
  return error ? <DataLoadError message="Pilihan penerima gagal dimuat." /> : (
    <Button type="button" size="sm" disabled aria-busy="true">
      <PenLine aria-hidden="true" />
      {label}
    </Button>
  );
}

export function NotePageShell({
  action,
  fab,
  children,
  user: snapshot,
}: {
  action?: ReactNode;
  fab?: ReactNode;
  children: ReactNode;
  /** Fresh page user; the layout snapshot is only a loading fallback. */
  user?: SessionUser;
}) {
  const sessionUser = useSessionUser();
  const user = snapshot ?? sessionUser;
  const canWrite = !isReadOnly(user);
  const actionContent = action === undefined ? <NoteComposerControl user={user} /> : action;
  const fabContent = fab === undefined ? <NoteComposerControl user={user} trigger="fab" /> : fab;
  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader
        mobileCompact
        eyebrow="Komunikasi internal"
        title="Catatan"
        description="Catatan singkat untuk satu atau beberapa divisi, atau rekan kerja tertentu. Tidak ada balasan berantai dan tidak ada notifikasi WhatsApp per catatan."
        action={canWrite ? <div className="max-md:hidden">{actionContent}</div> : undefined}
      />
      {children}
      {canWrite && fabContent}
    </div>
  );
}

export function NoteListControls() {
  const params = useSearchParams();
  const requestedAudience = params.get("jenis");
  const audience = requestedAudience === "divisi" || requestedAudience === "karyawan" ? requestedAudience : "semua";
  return (
    <NoteFilters
      search={(params.get("q") ?? "").trim().slice(0, 80)}
      onlyMine={params.get("penulis") === "saya"}
      audience={audience}
    />
  );
}

/** Shared by the first route fallback and every streamed list render. */
export function NoteListFrame({
  description,
  children,
  footer,
}: {
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Frame>
      <FrameHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <FrameTitle>Catatan terbaru</FrameTitle>
          <FrameDescription className="text-xs">{description}</FrameDescription>
        </div>
      </FrameHeader>
      <FramePanel><NoteListControls /></FramePanel>
      {children}
      {footer}
    </Frame>
  );
}

export function NoteListContent({
  notes,
  filtered,
  emptyAction,
  user: snapshot,
}: {
  notes: Note[];
  filtered: boolean;
  emptyAction: ReactNode;
  /** Fresh page user; the layout snapshot is only a loading fallback. */
  user?: SessionUser;
}) {
  const sessionUser = useSessionUser();
  const user = snapshot ?? sessionUser;
  const readOnly = isReadOnly(user);
  return (
    <FramePanel className="p-0">
      {notes.length === 0 ? (
        <EmptyState
          icon={filtered ? SearchX : StickyNote}
          title={filtered ? "Tidak ada catatan yang cocok" : "Belum ada catatan"}
          description={filtered
            ? "Coba kata kunci lain atau hapus filter untuk melihat semua catatan."
            : readOnly
              ? "Catatan dari rekan kerja akan muncul di sini."
              : "Tulis catatan pertama untuk satu atau beberapa divisi, atau rekan kerja tertentu."}
          action={filtered ? (
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/catatan" />}>Hapus filter</Button>
          ) : readOnly ? (
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/catatan" />}>
              <RefreshCw aria-hidden="true" />Muat ulang
            </Button>
          ) : <div className="max-md:hidden">{emptyAction}</div>}
        />
      ) : (
        <div className="divide-y divide-border">
          {notes.map((note) => <NoteCard key={note.id} note={note} />)}
        </div>
      )}
    </FramePanel>
  );
}

/** Own wrapper so existing note pagination stays untouched; navigation is a transition. */
export function NoteListPagination({ total, page }: { total: number; page: PageRequest }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  function update(pageIndex: number, pageSize: number) {
    const query = new URLSearchParams(params.toString());
    if (pageIndex > 0) query.set("page", String(pageIndex + 1));
    else query.delete("page");
    if (pageSize !== 10) query.set("size", String(pageSize));
    else query.delete("size");
    const search = query.toString();
    startTransition(() => router.push(search ? `/catatan?${search}` : "/catatan", { scroll: false }));
  }
  if (total === 0) return null;
  return (
    <FrameFooter aria-busy={pending}>
      <ListPagination
        page={page.pageIndex}
        pageSize={page.pageSize}
        total={total}
        onPageChange={(next) => update(next, page.pageSize)}
        onPageSizeChange={(size) => update(0, size)}
        itemLabel="catatan"
      />
      <span className="sr-only" role="status">{pending ? "Memuat halaman catatan…" : ""}</span>
    </FrameFooter>
  );
}
