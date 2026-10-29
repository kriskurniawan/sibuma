import { z } from "zod";
import { MANUAL_WORK_MAX_ASSIGNEES } from "./manual-work-types";

const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Tanggal tidak ada di kalender.");

const id = z.string().trim().min(1, "Data yang dipilih tidak valid.").max(120);

const assigneeIds = z
  .array(id)
  .min(1, "Pilih minimal satu pekerja.")
  .max(
    MANUAL_WORK_MAX_ASSIGNEES,
    `Maksimal ${MANUAL_WORK_MAX_ASSIGNEES} pekerja per pekerjaan.`,
  )
  .refine(
    (values) => new Set(values).size === values.length,
    "Pekerja yang dipilih tidak boleh ganda.",
  );

const manualWorkFields = {
  title: z
    .string()
    .trim()
    .min(4, "Nama pekerjaan minimal 4 karakter.")
    .max(140, "Nama pekerjaan maksimal 140 karakter."),
  description: z
    .string()
    .trim()
    .min(10, "Deskripsi pekerjaan minimal 10 karakter.")
    .max(2_000, "Deskripsi maksimal 2.000 karakter."),
  locationId: z
    .string()
    .trim()
    .min(1, "Pilih lokasi pekerjaan.")
    .max(120, "Lokasi yang dipilih tidak valid."),
  safetyName: z
    .string()
    .trim()
    .max(120, "Nama petugas safety maksimal 120 karakter.")
    .optional()
    .default(""),
  startDate: dateOnly,
  targetDate: dateOnly.nullish(),
  requiresDocumentation: z.boolean().optional().default(true),
};

function checkDateRange(
  value: { startDate: string; targetDate?: string | null },
  ctx: z.RefinementCtx,
) {
  if (value.targetDate && value.targetDate < value.startDate) {
    ctx.addIssue({
      code: "custom",
      path: ["targetDate"],
      message: "Target selesai tidak boleh sebelum tanggal mulai.",
    });
  }
}

/** Atasan membuat pekerjaan untuk anggota timnya. */
export const manualWorkInputSchema = z
  .object({
    ...manualWorkFields,
    assigneeIds,
    followUpId: id.nullish(),
  })
  .superRefine(checkDateRange);

/**
 * Pekerja mencatat pekerjaan untuk dirinya dan rekan tim yang ikut
 * mengerjakan. Tautan tindak lanjut tetap diatur atasan.
 */
export const manualWorkSelfReportSchema = z
  .object({ ...manualWorkFields, assigneeIds })
  .superRefine(checkDateRange);

export const manualWorkActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mulai") }),
  z.object({
    action: z.literal("selesai"),
    resultNote: z
      .string()
      .trim()
      .max(2_000, "Catatan hasil maksimal 2.000 karakter.")
      .optional()
      .default(""),
  }),
  z.object({
    action: z.literal("batal"),
    reason: z
      .string()
      .trim()
      .min(10, "Alasan pembatalan minimal 10 karakter.")
      .max(500, "Alasan pembatalan maksimal 500 karakter."),
  }),
  z.object({
    action: z.literal("buka_kembali"),
    reason: z
      .string()
      .trim()
      .min(10, "Alasan membuka kembali minimal 10 karakter.")
      .max(500, "Alasan membuka kembali maksimal 500 karakter."),
  }),
]);
