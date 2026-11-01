import Link from "next/link";
import { ChevronRight, Paperclip } from "lucide-react";
import { Badge } from "@/components/reui/badge";
import { Avatar } from "@/components/ui";
import { avatarUrl } from "@/lib/avatar-url";
import { noteAudienceLabel, noteRecipientText } from "@/lib/note-display";
import type { Note } from "@/lib/note-types";
import { formatDateTime } from "@/lib/time";

export function NoteCard({ note }: { note: Note }) {
  const photoCount = note.attachments.length;

  return (
    <Link
      href={`/catatan/${note.id}`}
      className="flex min-w-0 items-start gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-5"
    >
      <Avatar
        name={note.authorName}
        seed={note.authorId}
        src={avatarUrl(note.authorId, note.authorAvatarKey)}
        size="sm"
        className="mt-0.5 shrink-0"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {note.title}
          </h2>
          <Badge
            variant={
              note.audienceType === "employees" ? "primary-light" : "info-light"
            }
            className="shrink-0"
          >
            {noteAudienceLabel(note)}
          </Badge>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
          <span className="min-w-0 break-words font-medium text-foreground">
            {note.authorName}
          </span>
          <span aria-hidden="true">·</span>
          <time dateTime={note.createdAt}>
            {formatDateTime(note.createdAt)}
          </time>
          <span aria-hidden="true">·</span>
          <span className="min-w-0 break-words">
            Untuk {noteRecipientText(note, { compact: true })}
          </span>
        </div>

        <p className="line-clamp-1 break-words text-sm text-muted-foreground">
          {note.body}
        </p>
      </div>

      <span className="mt-0.5 flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        {photoCount > 0 && (
          <span
            className="inline-flex items-center gap-1 tabular-nums"
            aria-label={`${photoCount} foto`}
          >
            <Paperclip className="size-3.5" aria-hidden="true" />
            {photoCount}
          </span>
        )}
        <ChevronRight className="size-4" aria-hidden="true" />
      </span>
    </Link>
  );
}
