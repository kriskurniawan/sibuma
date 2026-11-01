import type { Note } from "./note-types";

export function noteRecipientText(
  note: Note,
  options?: { compact?: boolean },
) {
  if (note.audienceType !== "employees") {
    return note.divisionName ? `Divisi ${note.divisionName}` : "Divisi tujuan";
  }
  if (note.recipientNames.length === 0) return "Penerima tidak tersedia";
  if (options?.compact && note.recipientNames.length > 3) {
    const shown = note.recipientNames.slice(0, 3).join(", ");
    return `${shown}, dan ${note.recipientNames.length - 3} lainnya`;
  }
  return note.recipientNames.join(", ");
}

/** Label badge harus pendek agar tidak mengambil ruang judul. */
export function noteAudienceLabel(note: Note) {
  if (note.audienceType === "employees") {
    return `${note.recipientNames.length} karyawan`;
  }
  if (note.audienceType === "divisions") return "Lintas divisi";
  return "Divisi";
}
