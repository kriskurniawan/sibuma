import { z } from "zod";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const textSchema = (max: number, maxMessage: string) =>
  z
    .string()
    .max(max, maxMessage)
    .refine((value) => !value.includes("\u0000"), {
      message: "Teks mengandung karakter yang tidak didukung.",
    });

export const dailyReportSettingsSchema = z.object({
  date: z
    .string()
    .regex(DATE_PATTERN, "Tanggal laporan tidak valid.")
    .refine((value) => {
      const [year, month, day] = value.split("-").map(Number);
      const check = new Date(Date.UTC(year, month - 1, day));
      return (
        check.getUTCFullYear() === year &&
        check.getUTCMonth() === month - 1 &&
        check.getUTCDate() === day
      );
    }, "Tanggal laporan tidak valid."),
  title: textSchema(80, "Judul laporan maksimal 80 karakter.")
    .optional()
    .default(""),
  notes: textSchema(1_000, "Catatan maksimal 1.000 karakter.")
    .optional()
    .default(""),
});

export type DailyReportSettingsInput = z.infer<
  typeof dailyReportSettingsSchema
>;
