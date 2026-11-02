import { notFound, redirect } from "next/navigation";
import { CalendarPlus, History } from "lucide-react";
import { NoteDelete } from "@/components/catatan/note-delete";
import { NoteEdit } from "@/components/catatan/note-edit";
import { NotePhoto } from "@/components/catatan/note-photo";
import { Badge } from "@/components/reui/badge";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { BackLink, PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { noteAudienceLabel, noteRecipientText } from "@/lib/note-display";
import { getNote } from "@/lib/note-queries";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Detail Catatan" };

function sizeLabel(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function CatatanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const note = await getNote(user, id);
  if (!note) notFound();

  const totalBytes = note.attachments.reduce(
    (sum, attachment) => sum + attachment.sizeBytes,
    0,
  );

  return (
    <div className="flex flex-col gap-5 pb-8">
      <BackLink href="/catatan">Kembali ke Catatan</BackLink>

      <PageHeader
        eyebrow="Catatan"
        title={<span className="break-words">{note.title}</span>}
        description={`Ditulis ${note.authorName}`}
        descriptionClassName="break-words"
      />

      <dl
        aria-label="Riwayat catatan"
        className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
      >
        <div className="inline-flex items-center gap-1.5">
          <CalendarPlus className="size-3.5" aria-hidden="true" />
          <dt>Dibuat</dt>
          <dd className="tabular-nums">
            <time dateTime={note.createdAt}>
              {formatDateTime(note.createdAt)}
            </time>
          </dd>
        </div>
        {note.updatedAt !== note.createdAt && (
          <div className="inline-flex items-center gap-1.5">
            <History className="size-3.5" aria-hidden="true" />
            <dt>Diperbarui</dt>
            <dd className="tabular-nums">
              <time dateTime={note.updatedAt}>
                {formatDateTime(note.updatedAt)}
              </time>
            </dd>
          </div>
        )}
      </dl>

      <Frame>
        <FrameHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle>Isi catatan</FrameTitle>
            <FrameDescription className="break-words text-xs">
              Untuk {noteRecipientText(note)}
            </FrameDescription>
          </div>
          <Badge
            variant={
              note.audienceType === "employees" ? "primary-light" : "info-light"
            }
            className="shrink-0"
          >
            {noteAudienceLabel(note)}
          </Badge>
        </FrameHeader>
        <FramePanel>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
            {note.body}
          </p>
        </FramePanel>
      </Frame>

      {note.attachments.length > 0 && (
        <Frame>
          <FrameHeader className="flex flex-row items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <FrameTitle>Foto</FrameTitle>
              <FrameDescription className="text-xs">
                {note.attachments.length} foto · {sizeLabel(totalBytes)}
              </FrameDescription>
            </div>
          </FrameHeader>
          <FramePanel>
            <div className="flex flex-wrap gap-3">
              {note.attachments.map((attachment, index) => (
                <NotePhoto
                  key={attachment.id}
                  noteId={note.id}
                  attachment={attachment}
                  index={index}
                  title={note.title}
                />
              ))}
            </div>
          </FramePanel>
        </Frame>
      )}

      {(note.canEdit || note.canDelete) && (
        <div className="flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
          {note.canEdit && (
            <NoteEdit
              noteId={note.id}
              initialTitle={note.title}
              initialBody={note.body}
              initialAttachments={note.attachments}
              updatedAt={note.updatedAt}
            />
          )}
          {note.canDelete && (
            <NoteDelete
              noteId={note.id}
              title={note.title}
              redirectTo="/catatan"
            />
          )}
        </div>
      )}
    </div>
  );
}
