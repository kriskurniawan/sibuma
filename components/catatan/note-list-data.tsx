import { Suspense } from "react";
import {
  NoteComposerControl,
  NoteListContent,
  NoteListPagination,
} from "@/components/catatan/note-list-shell";
import { DataLoadError } from "@/components/data-load-error";
import { FramePanel } from "@/components/reui/frame";
import { getNoteOptions, getNotesPage, type NoteFilters } from "@/lib/note-queries";
import type { PageRequest } from "@/lib/pagination";
import type { SessionUser } from "@/lib/types";

/** These wrappers catch only data-query failures, never authentication redirects. */
export async function loadNoteList(user: SessionUser, request: PageRequest, filters: NoteFilters) {
  try {
    return await getNotesPage(user, request, filters);
  } catch {
    return null;
  }
}

export async function loadNoteComposerOptions(user: SessionUser) {
  try {
    return await getNoteOptions(user);
  } catch {
    return null;
  }
}

type ListPromise = ReturnType<typeof loadNoteList>;
type OptionsPromise = ReturnType<typeof loadNoteComposerOptions>;

export async function NoteComposerData({
  options,
  trigger = "default",
  label,
  user,
}: {
  options: OptionsPromise;
  trigger?: "default" | "fab";
  label?: string;
  user?: SessionUser;
}) {
  const loaded = await options;
  return <NoteComposerControl options={loaded ?? undefined} error={!loaded} trigger={trigger} label={label} user={user} />;
}

export async function NoteListDescriptionData({ result, filtered }: { result: ListPromise; filtered: boolean }) {
  const data = await result;
  return data ? filtered ? `${data.total} catatan ditemukan.` : `${data.total} catatan yang dapat kamu baca.` : "Jumlah catatan belum tersedia.";
}

export async function NoteListData({
  result,
  options,
  filtered,
  user,
}: {
  result: ListPromise;
  options: OptionsPromise | null;
  filtered: boolean;
  user: SessionUser;
}) {
  const data = await result;
  if (!data) return <FramePanel><DataLoadError message="Daftar catatan gagal dimuat." /></FramePanel>;
  return (
    <NoteListContent
      notes={data.notes}
      filtered={filtered}
      user={user}
      emptyAction={options ? (
        <Suspense fallback={<NoteComposerControl label="Tulis catatan pertama" user={user} />}>
          <NoteComposerData options={options} label="Tulis catatan pertama" user={user} />
        </Suspense>
      ) : null}
    />
  );
}

export async function NoteListFooterData({ result }: { result: ListPromise }) {
  const data = await result;
  return data ? <NoteListPagination total={data.total} page={data.page} /> : null;
}
