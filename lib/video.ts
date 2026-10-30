/**
 * Aturan video dokumentasi yang dipakai bersama server dan klien.
 *
 * Video hanya diunggah dari galeri, bukan direkam aplikasi. Karena itu tidak
 * ada cap waktu terbakar seperti foto dan tidak ada penanda di dalam berkas.
 * Yang diperiksa server: tipe MIME yang ditandatangani saat unggah, ukuran
 * persis, dan container video dari beberapa byte pertama.
 */
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const VIDEO_MIN_BYTES = 1024;
export const DEFAULT_MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export const VIDEO_MIME_EXTENSIONS = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
} as const;

export type VideoMime = keyof typeof VIDEO_MIME_EXTENSIONS;

export const VIDEO_MIME_TYPES = Object.keys(
  VIDEO_MIME_EXTENSIONS,
) as VideoMime[];

export const VIDEO_ACCEPT = VIDEO_MIME_TYPES.join(",");

export function isVideoMime(value: string): value is VideoMime {
  return value in VIDEO_MIME_EXTENSIONS;
}

export function videoExtensionFor(mime: string): string | null {
  return isVideoMime(mime) ? VIDEO_MIME_EXTENSIONS[mime] : null;
}

export function videoMimeForExtension(extension: string): VideoMime | null {
  const normalized = extension.toLowerCase();
  for (const [mime, ext] of Object.entries(VIDEO_MIME_EXTENSIONS)) {
    if (ext === normalized) return mime as VideoMime;
  }
  return null;
}

export type VideoContainer = "isobmff" | "webm";

/**
 * Byte awal yang cukup untuk mengenali container. MP4 dan MOV sama-sama
 * ISO BMFF (`ftyp`), jadi keduanya diterima untuk MIME video/mp4 maupun
 * video/quicktime. WebM dikenali dari header EBML.
 */
export function videoContainer(bytes: Uint8Array): VideoContainer | null {
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return "isobmff";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return "webm";
  }
  return null;
}

export function videoMatchesMime(bytes: Uint8Array, mime: string) {
  const container = videoContainer(bytes);
  if (!container) return false;
  if (container === "webm") return mime === "video/webm";
  return mime === "video/mp4" || mime === "video/quicktime";
}

/** Durasi untuk label galeri, mis. `1:05`. */
export function formatVideoDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return null;
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
