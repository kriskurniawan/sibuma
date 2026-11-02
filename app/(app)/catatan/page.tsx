import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  loadNoteComposerOptions,
  loadNoteList,
  NoteComposerData,
  NoteListData,
  NoteListDescriptionData,
  NoteListFooterData,
} from "@/components/catatan/note-list-data";
import { NoteComposerControl, NoteListFrame, NotePageShell } from "@/components/catatan/note-list-shell";
import { NoteListCountSkeleton, NoteListFooterSkeleton, NoteListRowsSkeleton } from "@/components/catatan/note-list-skeletons";
import { isReadOnly } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { pageRequest } from "@/lib/pagination";

export const metadata = { title: "Catatan" };

export default async function CatatanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const request = pageRequest(first(params.page), first(params.size));
  const search = (first(params.q) ?? "").trim().slice(0, 80);
  const onlyMine = first(params.penulis) === "saya";
  const requestedAudience = first(params.jenis);
  const audience = requestedAudience === "divisi" || requestedAudience === "karyawan" ? requestedAudience : "semua";
  const filtered = search.length > 0 || onlyMine || audience !== "semua";
  const result = loadNoteList(user, request, { search, onlyMine, audience });
  const options = isReadOnly(user) ? null : loadNoteComposerOptions(user);

  // Composer options and feed data stream independently through stable boundaries.
  return (
    <NotePageShell
      user={user}
      action={options ? (
        <Suspense fallback={<NoteComposerControl user={user} />}>
          <NoteComposerData options={options} user={user} />
        </Suspense>
      ) : null}
      fab={options ? (
        <Suspense fallback={<NoteComposerControl trigger="fab" user={user} />}>
          <NoteComposerData options={options} trigger="fab" user={user} />
        </Suspense>
      ) : null}
    >
      <NoteListFrame
        description={
          <Suspense fallback={<NoteListCountSkeleton />}>
            <NoteListDescriptionData result={result} filtered={filtered} />
          </Suspense>
        }
        footer={
          <Suspense fallback={<NoteListFooterSkeleton />}>
            <NoteListFooterData result={result} />
          </Suspense>
        }
      >
        <Suspense fallback={<NoteListRowsSkeleton />}>
          <NoteListData result={result} options={options} filtered={filtered} user={user} />
        </Suspense>
      </NoteListFrame>
    </NotePageShell>
  );
}
