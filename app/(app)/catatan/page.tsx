import { redirect } from "next/navigation";
import Link from "next/link";
import { SearchX, StickyNote } from "lucide-react";
import { NoteCard } from "@/components/catatan/note-card";
import { NoteComposer } from "@/components/catatan/note-composer";
import { NoteFilters } from "@/components/catatan/note-filters";
import { NotePagination } from "@/components/catatan/note-pagination";
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
import { getCurrentUser } from "@/lib/auth";
import { getNoteOptions, getNotesPage } from "@/lib/note-queries";
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
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const request = pageRequest(first(params.page), first(params.size));
  const search = (first(params.q) ?? "").trim().slice(0, 80);
  const onlyMine = first(params.penulis) === "saya";
  const requestedAudience = first(params.jenis);
  const audience =
    requestedAudience === "divisi" || requestedAudience === "karyawan"
      ? requestedAudience
      : "semua";
  const filtered = search.length > 0 || onlyMine || audience !== "semua";

  const readOnly = isReadOnly(user);
  const [data, options] = await Promise.all([
    getNotesPage(user, request, { search, onlyMine, audience }),
    readOnly ? Promise.resolve(null) : getNoteOptions(user),
  ]);
  const { notes, total, page } = data;
  const composerOptions = readOnly ? null : options;

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader
        mobileCompact
        eyebrow="Komunikasi internal"
        title="Catatan"
        description="Catatan singkat untuk satu atau beberapa divisi, atau rekan kerja tertentu. Tidak ada balasan berantai dan tidak ada notifikasi WhatsApp per catatan."
        action={
          composerOptions ? (
            <div className="max-md:hidden">
              <NoteComposer options={composerOptions} />
            </div>
          ) : undefined
        }
      />

      <Frame>
        <FrameHeader>
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle>Catatan terbaru</FrameTitle>
            <FrameDescription className="text-xs">
              {filtered
                ? `${total} catatan ditemukan.`
                : `${total} catatan yang dapat kamu baca.`}
            </FrameDescription>
          </div>
        </FrameHeader>

        <FramePanel>
          <NoteFilters
            search={search}
            onlyMine={onlyMine}
            audience={audience}
          />
        </FramePanel>

        <FramePanel className="p-0">
          {notes.length === 0 ? (
            filtered ? (
              <EmptyState
                icon={SearchX}
                title="Tidak ada catatan yang cocok"
                description="Coba kata kunci lain atau hapus filter untuk melihat semua catatan."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href="/catatan" />}
                  >
                    Hapus filter
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={StickyNote}
                title="Belum ada catatan"
                description={
                  readOnly
                    ? "Catatan dari rekan kerja akan muncul di sini."
                    : "Tulis catatan pertama untuk satu atau beberapa divisi, atau rekan kerja tertentu."
                }
                action={
                  composerOptions ? (
                    <div className="max-md:hidden">
                      <NoteComposer
                        options={composerOptions}
                        label="Tulis catatan pertama"
                      />
                    </div>
                  ) : undefined
                }
              />
            )
          ) : (
            <div className="divide-y divide-border">
              {notes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          )}
        </FramePanel>

        {total > 0 && (
          <FrameFooter>
            <NotePagination
              page={page.pageIndex}
              pageSize={page.pageSize}
              total={total}
            />
          </FrameFooter>
        )}
      </Frame>

      {composerOptions && (
        <NoteComposer options={composerOptions} trigger="fab" />
      )}
    </div>
  );
}
