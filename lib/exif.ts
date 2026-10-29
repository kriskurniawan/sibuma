import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { APP_TIMEZONE } from "./constants";
import type { GeoPoint } from "./types";

export interface ImageExif {
  takenAt: string | null;
  location: GeoPoint | null;
}

const EMPTY: ImageExif = { takenAt: null, location: null };
const MAX_HEADER_BYTES = 512 * 1024;

interface IfdEntry {
  entry: number;
  type: number;
  count: number;
  valueOffset: number;
}

/**
 * Baca DateTimeOriginal dan GPS dari JPEG tanpa dependensi tambahan. EXIF hanya
 * dipakai sebagai petunjuk waktu/posisi; bila tidak ada atau tidak valid,
 * pemanggil memakai jam dan GPS perangkat.
 */
export async function readImageExif(file: Blob): Promise<ImageExif> {
  try {
    if (file.type !== "image/jpeg") return EMPTY;
    const buffer = await file.slice(0, MAX_HEADER_BYTES).arrayBuffer();
    if (buffer.byteLength < 4) return EMPTY;
    const view = new DataView(buffer);
    if (view.getUint16(0) !== 0xffd8) return EMPTY;

    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = view.getUint8(offset + 1);
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x00 || marker === 0xff) {
        offset += 1;
        continue;
      }
      const length = view.getUint16(offset + 2);
      if (length < 2) break;
      const end = offset + 2 + length;
      if (end > view.byteLength) break;
      if (marker === 0xe1 && end >= offset + 10) {
        const start = offset + 4;
        if (
          view.getUint32(start) === 0x45786966 &&
          view.getUint16(start + 4) === 0
        ) {
          return parseTiff(view, start + 6);
        }
      }
      offset = end;
    }
  } catch {
    // EXIF bersifat opsional; jangan gagalkan pemilihan foto karenanya.
  }
  return EMPTY;
}

function parseTiff(view: DataView, base: number): ImageExif {
  if (base + 8 > view.byteLength) return EMPTY;
  const order = view.getUint16(base);
  const little = order === 0x4949;
  if (!little && order !== 0x4d4d) return EMPTY;
  if (view.getUint16(base + 2, little) !== 42) return EMPTY;
  const ifd0Offset = view.getUint32(base + 4, little);
  const ifd0 = readIfd(view, base, ifd0Offset, little);
  return {
    takenAt: readCaptureTime(view, base, ifd0, little),
    location: readGpsLocation(view, base, ifd0, little),
  };
}

function readIfd(
  view: DataView,
  base: number,
  relativeOffset: number,
  little: boolean,
): Map<number, IfdEntry> {
  const result = new Map<number, IfdEntry>();
  const offset = base + relativeOffset;
  if (offset < 0 || offset + 2 > view.byteLength) return result;
  const count = view.getUint16(offset, little);
  if (count > 512 || offset + 2 + count * 12 > view.byteLength) return result;
  for (let index = 0; index < count; index += 1) {
    const entry = offset + 2 + index * 12;
    const tag = view.getUint16(entry, little);
    result.set(tag, {
      entry,
      type: view.getUint16(entry + 2, little),
      count: view.getUint32(entry + 4, little),
      valueOffset: view.getUint32(entry + 8, little),
    });
  }
  return result;
}

function readAscii(
  view: DataView,
  base: number,
  entry: IfdEntry | undefined,
  little: boolean,
) {
  if (!entry || entry.count <= 0 || entry.count > 256) return "";
  const start =
    entry.count <= 4 ? entry.entry + 8 : base + entry.valueOffset;
  if (start < 0 || start + entry.count > view.byteLength) return "";
  let value = "";
  for (let index = 0; index < entry.count; index += 1) {
    const code = view.getUint8(start + index);
    if (code === 0) break;
    value += String.fromCharCode(code);
  }
  return value.trim();
}

function readTagAscii(
  view: DataView,
  base: number,
  entries: Map<number, IfdEntry>,
  tag: number,
  little: boolean,
) {
  return readAscii(view, base, entries.get(tag), little);
}

function readCaptureTime(
  view: DataView,
  base: number,
  ifd0: Map<number, IfdEntry>,
  little: boolean,
) {
  const pointer = ifd0.get(0x8769);
  if (!pointer) return null;
  const exifIfd = readIfd(view, base, pointer.valueOffset, little);
  const raw =
    readTagAscii(view, base, exifIfd, 0x9003, little) ||
    readTagAscii(view, base, exifIfd, 0x9004, little);
  return parseExifDate(raw);
}

function parseExifDate(raw: string) {
  const match =
    /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const yearNumber = Number(year);
  if (yearNumber < 2000 || yearNumber > new Date().getFullYear() + 1) {
    return null;
  }
  if (
    Number(month) < 1 ||
    Number(month) > 12 ||
    Number(day) < 1 ||
    Number(day) > 31 ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59
  ) {
    return null;
  }
  const local = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  const date = fromZonedTime(local, APP_TIMEZONE);
  if (Number.isNaN(date.getTime())) return null;
  if (
    formatInTimeZone(date, APP_TIMEZONE, "yyyy:MM:dd HH:mm:ss") !==
    `${year}:${month}:${day} ${hour}:${minute}:${second}`
  ) {
    return null;
  }
  // Jam kamera yang jauh di depan perangkat biasanya salah setel.
  if (date.getTime() > Date.now() + 5 * 60_000) return null;
  return date.toISOString();
}

function readGpsLocation(
  view: DataView,
  base: number,
  ifd0: Map<number, IfdEntry>,
  little: boolean,
): GeoPoint | null {
  const pointer = ifd0.get(0x8825);
  if (!pointer) return null;
  const gps = readIfd(view, base, pointer.valueOffset, little);
  const latitude = readGpsCoordinate(view, base, gps.get(0x0002), little);
  const longitude = readGpsCoordinate(view, base, gps.get(0x0004), little);
  if (latitude === null || longitude === null) return null;
  const latitudeRef = readTagAscii(
    view,
    base,
    gps,
    0x0001,
    little,
  ).toUpperCase();
  const longitudeRef = readTagAscii(
    view,
    base,
    gps,
    0x0003,
    little,
  ).toUpperCase();
  const signedLatitude = latitudeRef === "S" ? -latitude : latitude;
  const signedLongitude = longitudeRef === "W" ? -longitude : longitude;
  if (
    !Number.isFinite(signedLatitude) ||
    signedLatitude < -90 ||
    signedLatitude > 90 ||
    !Number.isFinite(signedLongitude) ||
    signedLongitude < -180 ||
    signedLongitude > 180
  ) {
    return null;
  }
  return { latitude: signedLatitude, longitude: signedLongitude };
}

function readGpsCoordinate(
  view: DataView,
  base: number,
  entry: IfdEntry | undefined,
  little: boolean,
) {
  if (!entry || entry.count < 3) return null;
  if (entry.type !== 5 && entry.type !== 10) return null;
  const start = base + entry.valueOffset;
  if (start < 0 || start + 24 > view.byteLength) return null;
  const parts: number[] = [];
  for (let index = 0; index < 3; index += 1) {
    const numerator = view.getUint32(start + index * 8, little);
    const denominator = view.getUint32(start + index * 8 + 4, little);
    if (!denominator) return null;
    parts.push(numerator / denominator);
  }
  return parts[0] + parts[1] / 60 + parts[2] / 3600;
}
