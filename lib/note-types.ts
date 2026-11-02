/** Catatan singkat untuk satu/beberapa divisi atau karyawan terpilih. */
export type NoteAudience = "division" | "divisions" | "employees";

export interface NoteAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface Note {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarKey: string | null;
  title: string;
  body: string;
  audienceType: NoteAudience;
  divisionId: string | null;
  divisionName: string;
  recipientNames: string[];
  attachments: NoteAttachment[];
  canEdit: boolean;
  canDelete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotePerson {
  id: string;
  name: string;
  divisionName: string | null;
}

export interface NoteDivision {
  id: string;
  name: string;
}

export interface NoteOptions {
  divisions: NoteDivision[];
  employees: NotePerson[];
  /** Divisi penulis, dipakai sebagai pilihan awal saat mengirim ke divisi. */
  myDivisionId: string | null;
}
