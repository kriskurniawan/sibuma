export interface WatermarkOptions {
  /**
   * Baris pertama tampil tebal (judul), baris berikutnya lebih kecil.
   * Kosongkan untuk melewati watermark.
   */
  lines: string[];
  /** Nama file cadangan bila nama asli tidak punya bagian sebelum ekstensi. */
  fallbackName?: string;
}

const WATERMARK_FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function applyFont(
  context: CanvasRenderingContext2D,
  size: number,
  weight: number,
) {
  context.font = `${weight} ${size}px ${WATERMARK_FONT}`;
}

/**
 * Perkecil font sampai teks muat, lalu potong dengan elipsis bila tetap
 * terlalu panjang. Watermark tidak boleh menutupi seluruh foto.
 */
function fitLine(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  initialSize: number,
  weight: number,
) {
  let size = initialSize;
  applyFont(context, size, weight);
  while (size > 11 && context.measureText(text).width > maxWidth) {
    size -= 1;
    applyFont(context, size, weight);
  }
  if (context.measureText(text).width <= maxWidth) return { text, size };

  let truncated = text;
  while (
    truncated.length > 1 &&
    context.measureText(`${truncated}…`).width > maxWidth
  ) {
    truncated = truncated.slice(0, -1);
  }
  return { text: `${truncated.trimEnd()}…`, size };
}

function drawWatermark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: WatermarkOptions,
) {
  const lines = options.lines.map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return;

  const padding = Math.round(
    clamp(Math.min(width * 0.032, height * 0.05), 10, 56),
  );
  const base = Math.min(width, height * 1.5);
  const titleSize = Math.round(clamp(base * 0.03, 13, 42));
  const metaSize = Math.round(clamp(base * 0.023, 11, 32));
  const maxWidth = width - padding * 2;

  const title = fitLine(context, lines[0], maxWidth, titleSize, 700);
  const meta = lines
    .slice(1)
    .map((line) => fitLine(context, line, maxWidth, metaSize, 500));
  const gap = Math.round(Math.max(title.size, metaSize) * 0.34);
  const textHeight =
    title.size +
    meta.reduce((total, line) => total + gap + line.size, 0);
  const gradientHeight = textHeight + padding * 2.2;
  const gradientTop = Math.max(0, height - gradientHeight);

  // Gradasi gelap menjaga teks tetap terbaca tanpa menutupi objek kerja.
  const gradient = context.createLinearGradient(0, gradientTop, 0, height);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.55, "rgba(0,0,0,0.35)");
  gradient.addColorStop(1, "rgba(0,0,0,0.8)");
  context.fillStyle = gradient;
  context.fillRect(0, gradientTop, width, height - gradientTop);

  context.save();
  context.textBaseline = "top";
  context.shadowColor = "rgba(0,0,0,0.55)";
  context.shadowBlur = Math.max(2, Math.round(title.size * 0.12));
  context.shadowOffsetY = 1;

  let y = height - padding - textHeight;
  context.fillStyle = "rgba(255,255,255,0.98)";
  applyFont(context, title.size, 700);
  context.fillText(title.text, padding, y);
  y += title.size;

  context.fillStyle = "rgba(255,255,255,0.86)";
  for (const line of meta) {
    y += gap;
    applyFont(context, line.size, 500);
    context.fillText(line.text, padding, y);
    y += line.size;
  }
  context.restore();
}

export async function compressImage(
  file: File,
  maxBytes: number,
  watermark?: WatermarkOptions,
) {
  // Tanpa watermark, JPEG kecil boleh dipakai apa adanya. Dengan watermark,
  // gambar wajib digambar ulang ke canvas agar teks benar-benar tercetak.
  if (!watermark && file.size <= maxBytes && file.type === "image/jpeg") {
    return file;
  }
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const maxDimension = 1600;
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    if (watermark) {
      drawWatermark(context, canvas.width, canvas.height, watermark);
    }

    let quality = 0.84;
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (!blob || blob.size <= maxBytes) break;
      quality -= 0.12;
    }

    if (!blob) return file;
    const baseName =
      file.name.replace(/\.[^.]+$/, "") ||
      watermark?.fallbackName ||
      "checklist";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      // Compression runs in an event handler, never during render.
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
