import { NoteDetailShell } from "@/components/catatan/note-detail-shell";
import { NoteDetailSkeleton } from "@/components/catatan/note-detail-skeleton";

export default function CatatanDetailLoading() {
  return <NoteDetailShell><NoteDetailSkeleton /></NoteDetailShell>;
}
