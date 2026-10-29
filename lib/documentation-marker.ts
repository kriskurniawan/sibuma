export const DOCUMENTATION_MARKER_PREFIX = "SIBUMA-DOC|1|";
export const MANUAL_WORK_MARKER_PREFIX = "SIBUMA-WORK|1|";

export type DocumentationCaptureSource = "exif" | "device";

export interface DocumentationMarker {
  spklNumber: string;
  takenAt: string;
  source: DocumentationCaptureSource;
}

export interface ManualWorkMarker {
  workId: string;
  takenAt: string;
  source: DocumentationCaptureSource;
}

/**
 * Penanda kecil di dalam JPEG. Dipakai server untuk memastikan file benar-benar
 * melewati proses cap waktu SIBUMA, bukan file mentah yang diunggah langsung.
 * Penanda ini tidak terlihat, sedangkan cap waktu terlihat dicetak di foto.
 */
export function buildDocumentationMarker(marker: DocumentationMarker) {
  const params = new URLSearchParams();
  params.set("spkl", marker.spklNumber);
  params.set("taken", marker.takenAt);
  params.set("source", marker.source);
  return `${DOCUMENTATION_MARKER_PREFIX}${params.toString()}`;
}

function readCapture(
  prefix: string,
  comment: string | null,
  referenceKey: string,
): {
  reference: string;
  takenAt: string;
  source: DocumentationCaptureSource;
} | null {
  if (!comment?.startsWith(prefix)) return null;
  const params = new URLSearchParams(comment.slice(prefix.length));
  const reference = params.get(referenceKey)?.trim();
  const takenAtRaw = params.get("taken")?.trim();
  const source = params.get("source");
  if (!reference || !takenAtRaw) return null;
  if (source !== "exif" && source !== "device") return null;
  const takenAt = new Date(takenAtRaw);
  if (Number.isNaN(takenAt.getTime())) return null;
  return {
    reference,
    takenAt: takenAt.toISOString(),
    source,
  };
}

export function parseDocumentationMarker(
  comment: string | null,
): DocumentationMarker | null {
  const capture = readCapture(
    DOCUMENTATION_MARKER_PREFIX,
    comment,
    "spkl",
  );
  if (!capture) return null;
  return {
    spklNumber: capture.reference,
    takenAt: capture.takenAt,
    source: capture.source,
  };
}

/**
 * Penanda untuk foto pekerjaan harian. Dipisahkan dari penanda dokumentasi
 * SPKL agar file dari modul lain tidak dapat dipakai ulang.
 */
export function buildManualWorkMarker(marker: ManualWorkMarker) {
  const params = new URLSearchParams();
  params.set("work", marker.workId);
  params.set("taken", marker.takenAt);
  params.set("source", marker.source);
  return `${MANUAL_WORK_MARKER_PREFIX}${params.toString()}`;
}

export function parseManualWorkMarker(
  comment: string | null,
): ManualWorkMarker | null {
  const capture = readCapture(MANUAL_WORK_MARKER_PREFIX, comment, "work");
  if (!capture) return null;
  return {
    workId: capture.reference,
    takenAt: capture.takenAt,
    source: capture.source,
  };
}

/** Ambil komentar JPEG pertama yang berisi penanda SIBUMA. */
export function readSibumaJpegComment(
  bytes: Uint8Array,
  prefix = DOCUMENTATION_MARKER_PREFIX,
): string | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x00 || marker === 0xff) {
      offset += 1;
      continue;
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) break;
    const end = offset + 2 + length;
    if (end > bytes.length) break;
    if (marker === 0xfe) {
      const comment = new TextDecoder().decode(
        bytes.subarray(offset + 4, end),
      );
      if (comment.startsWith(prefix)) return comment;
    }
    offset = end;
  }
  return null;
}
