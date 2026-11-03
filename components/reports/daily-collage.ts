import {
  DEFAULT_DAILY_REPORT_TITLE,
  formatDailyReportDate,
} from "@/lib/daily-report-text";
import type { DailyReportPhoto } from "@/lib/daily-report-types";

export const DAILY_COLLAGE_PHOTO_LIMIT = 9;

const WIDTH = 1080;
const HEIGHT = 1350;
const PADDING = 40;
const GAP = 14;
const HEADER_HEIGHT = 170;
const FOOTER_HEIGHT = 70;
const FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

export interface CollageBuildOptions {
  date: string;
  /** Judul manual laporan; fallback ke judul bawaan. */
  title?: string;
  /** Catatan manual yang tampil di pojok kanan atas kolase. */
  notes?: string;
}

function cleanText(value?: string) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function cleanTitle(value?: string) {
  const cleaned = cleanText(value)
    .replace(/^\*+\s*/, "")
    .replace(/\s*\*+$/, "");
  return cleaned || DEFAULT_DAILY_REPORT_TITLE;
}

export interface DailyCollage {
  index: number;
  total: number;
  width: number;
  height: number;
  url: string;
  fileName: string;
  photoCount: number;
}

interface LoadedPhoto {
  photo: DailyReportPhoto;
  image: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
}

export function dailyReportPhotoUrl(
  photo: Pick<DailyReportPhoto, "id" | "source">,
  date: string,
) {
  return `/api/laporan-harian/foto/${photo.source}/${photo.id}?tanggal=${encodeURIComponent(date)}`;
}

export function collageFileName(date: string, index: number) {
  return `laporan-harian-${date}-kolase-${String(index + 1).padStart(2, "0")}.jpg`;
}

async function decodeBlob(blob: Blob): Promise<{
  image: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      // Safari lama dapat menolak sebagian JPEG; fallback ke elemen gambar.
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return {
      image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      dispose: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function loadPhoto(
  photo: DailyReportPhoto,
  date: string,
): Promise<LoadedPhoto> {
  const response = await fetch(dailyReportPhotoUrl(photo, date), {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Foto tidak dapat dimuat (${response.status}).`);
  }
  const blob = await response.blob();
  const decoded = await decodeBlob(blob);
  return { photo, ...decoded };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.max(
    0,
    Math.min(radius, width / 2, height / 2),
  );
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.arcTo(x + width, y, x + width, y + safeRadius, safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.arcTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
    safeRadius,
  );
  context.lineTo(x + safeRadius, y + height);
  context.arcTo(x, y + height, x, y + height - safeRadius, safeRadius);
  context.lineTo(x, y + safeRadius);
  context.arcTo(x, y, x + safeRadius, y, safeRadius);
  context.closePath();
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (imageWidth <= 0 || imageHeight <= 0) return;
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  context.drawImage(
    image,
    (imageWidth - sourceWidth) / 2,
    (imageHeight - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

function ellipsize(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
) {
  if (!value) return "";
  if (context.measureText(value).width <= maxWidth) return value;
  let low = 0;
  let high = value.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${value.slice(0, middle).trimEnd()}…`;
    if (context.measureText(candidate).width <= maxWidth) low = middle;
    else high = middle - 1;
  }
  return `${value.slice(0, low).trimEnd()}…`;
}

function drawTile(
  context: CanvasRenderingContext2D,
  photo: LoadedPhoto,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.save();
  roundedRect(context, x, y, width, height, 18);
  context.clip();

  context.fillStyle = "#1e293b";
  context.fillRect(x, y, width, height);
  drawCover(
    context,
    photo.image,
    photo.width,
    photo.height,
    x,
    y,
    width,
    height,
  );

  context.restore();
}

/**
 * Kolase 1080x1350 (rasio 4:5). Baris terakhir melebar otomatis sehingga tidak
 * ada slot kosong saat jumlah foto tidak habis dibagi kolom.
 */
function drawCollage(
  canvas: HTMLCanvasElement,
  photos: LoadedPhoto[],
  options: CollageBuildOptions,
  index: number,
  total: number,
) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas tidak tersedia di perangkat ini.");

  context.fillStyle = "#0b1220";
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = "#38bdf8";
  context.fillRect(0, 0, WIDTH, 6);

  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.font = `600 18px ${FONT}`;
  context.fillStyle = "#38bdf8";
  context.fillText("SIBUMA", PADDING, 48);

  context.textAlign = "right";
  context.fillStyle = "#94a3b8";
  context.font = `500 19px ${FONT}`;
  const note = cleanText(options.notes);
  if (note) {
    context.fillText(
      ellipsize(context, note, WIDTH - PADDING * 2 - 260),
      WIDTH - PADDING,
      48,
    );
  }

  context.textAlign = "left";
  context.font = `700 38px ${FONT}`;
  context.fillStyle = "#f8fafc";
  context.fillText(
    ellipsize(context, cleanTitle(options.title), WIDTH - PADDING * 2),
    PADDING,
    110,
  );

  const dateLabel = formatDailyReportDate(options.date);
  context.font = `500 24px ${FONT}`;
  context.fillStyle = "#cbd5e1";
  context.fillText(
    dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1),
    PADDING,
    148,
  );

  const count = photos.length;
  const columns = count <= 3 ? 1 : count === 4 ? 2 : count <= 6 ? 2 : 3;
  const rows = Math.ceil(count / columns);
  const availableWidth = WIDTH - PADDING * 2;
  const availableHeight = HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT;
  const cellHeight = (availableHeight - GAP * (rows - 1)) / rows;

  let cursorX = PADDING;
  let cursorY = HEADER_HEIGHT;
  let drawableIndex = 0;

  for (let row = 0; row < rows; row += 1) {
    const remaining = count - row * columns;
    const inRow = Math.min(columns, remaining);
    const cellWidth = (availableWidth - GAP * (inRow - 1)) / inRow;
    cursorX = PADDING;
    for (let column = 0; column < inRow; column += 1) {
      const photo = photos[drawableIndex];
      if (photo) {
        drawTile(context, photo, cursorX, cursorY, cellWidth, cellHeight);
      }
      drawableIndex += 1;
      cursorX += cellWidth + GAP;
    }
    cursorY += cellHeight + GAP;
  }

  context.textAlign = "left";
  context.font = `500 18px ${FONT}`;
  context.fillStyle = "#94a3b8";
  context.fillText(
    `${count} foto • Kolase ${index + 1} dari ${total}`,
    PADDING,
    HEIGHT - 28,
  );

  context.textAlign = "right";
  context.fillStyle = "#64748b";
  context.fillText(
    `${index + 1}/${total}`,
    WIDTH - PADDING,
    HEIGHT - 28,
  );
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Kolase gagal dibuat."));
      },
      "image/jpeg",
      0.9,
    );
  });
}

export async function buildDailyCollages(
  photos: readonly DailyReportPhoto[],
  options: CollageBuildOptions,
): Promise<DailyCollage[]> {
  const chunks: DailyReportPhoto[][] = [];
  for (let index = 0; index < photos.length; index += DAILY_COLLAGE_PHOTO_LIMIT) {
    chunks.push(
      photos.slice(index, index + DAILY_COLLAGE_PHOTO_LIMIT),
    );
  }

  const total = chunks.length;
  const collages: DailyCollage[] = [];

  try {
    for (let index = 0; index < chunks.length; index += 1) {
      const results = await Promise.allSettled(
        chunks[index].map((photo) => loadPhoto(photo, options.date)),
      );
      const loaded = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      const failure = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );

      // Satu foto gagal membuat kolase tidak lengkap; bersihkan yang sudah
      // ter-decode agar memori dan object URL tidak tertinggal.
      if (failure) {
        for (const photo of loaded) photo.dispose();
        throw failure.reason;
      }

      try {
        const canvas = document.createElement("canvas");
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        drawCollage(canvas, loaded, options, index, total);
        const blob = await canvasToBlob(canvas);
        collages.push({
          index,
          total,
          width: WIDTH,
          height: HEIGHT,
          url: URL.createObjectURL(blob),
          fileName: collageFileName(options.date, index),
          photoCount: loaded.length,
        });
      } finally {
        for (const photo of loaded) photo.dispose();
      }
    }

    return collages;
  } catch (error) {
    for (const collage of collages) URL.revokeObjectURL(collage.url);
    throw error;
  }
}
