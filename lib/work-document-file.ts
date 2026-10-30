import "server-only";
import path from "node:path";
import { videoMatchesMime, videoMimeForExtension } from "./video";

/** Nama berkas disimpan untuk tampilan/unduhan; kunci objek tetap acak. */
export function safeWorkDocumentFileName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 200);
  return cleaned || "dokumen";
}

export function workDocumentFileExtension(fileName: string) {
  return path.extname(fileName).replace(/^\./, "").toLowerCase();
}

export function hasValidWorkDocumentMagic(
  bytes: Uint8Array,
  extension: string,
) {
  if (extension === "pdf") {
    return Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-";
  }
  if (extension === "jpg" || extension === "jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (extension === "png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (extension === "docx" || extension === "xlsx" || extension === "pptx") {
    return (
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
    );
  }
  const videoMime = videoMimeForExtension(extension);
  if (videoMime) return videoMatchesMime(bytes, videoMime);
  return false;
}
