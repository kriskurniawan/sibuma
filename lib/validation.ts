import { z } from "zod";
import { MAX_DAILY_MINUTES, MAX_WEEKLY_MINUTES } from "./constants";

const loginIdentifier = z.string().trim().min(5, "Email atau WhatsApp wajib diisi.").max(254);
export const otpRequestSchema = z.object({ identifier: loginIdentifier });

export const otpVerifySchema = z.object({
  identifier: loginIdentifier,
  challengeId: z.string().uuid("Permintaan OTP tidak valid. Minta kode baru."),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Kode OTP terdiri dari 6 digit."),
});

const localTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam tidak valid.");

export const spklInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(4, "Nama pekerjaan minimal 4 karakter.")
    .max(120, "Nama pekerjaan maksimal 120 karakter."),
  description: z
    .string()
    .trim()
    .min(10, "Deskripsi pekerjaan minimal 10 karakter.")
    .max(1_200, "Deskripsi maksimal 1.200 karakter."),
  divisionId: z.string().trim().min(1, "Pilih divisi."),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid."),
  startTime: localTime,
  endTime: localTime,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().trim().max(240).optional().default(""),
  radiusMeters: z
    .number()
    .int()
    .min(25, "Radius minimal 25 meter.")
    .max(2_000, "Radius maksimal 2.000 meter."),
  requiresDocumentation: z.boolean().default(false),
  workerIds: z
    .array(z.string().trim().min(1))
    .min(1, "Pilih minimal satu pekerja.")
    .max(100),
});

export type SpklInput = z.infer<typeof spklInputSchema>;

export const checkInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100_000),
});

const localDateTime = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/,
    "Format tanggal dan jam tidak valid.",
  );

export const correctionSchema = z.object({
  checkInLocal: localDateTime,
  checkOutLocal: localDateTime,
  reason: z
    .string()
    .trim()
    .min(10, "Alasan koreksi minimal 10 karakter.")
    .max(500, "Alasan koreksi maksimal 500 karakter."),
});

export const employeeInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nama minimal 3 karakter.")
    .max(100, "Nama maksimal 100 karakter."),
  nik: z
    .string()
    .trim()
    .min(3, "NIK minimal 3 karakter.")
    .max(40, "NIK maksimal 40 karakter."),
  phone: z.string().trim().min(8, "Nomor HP wajib diisi."),
  email: z.string().trim().toLowerCase().max(254).email("Format email tidak valid."),
  divisionId: z.string().trim().min(1, "Pilih divisi."),
});

export const employeeUpdateSchema = z.object({
  name: z.string().trim().min(3).max(100).optional(),
  nik: z.string().trim().min(3).max(40).optional(),
  phone: z.string().trim().min(8).optional(),
  email: z.string().trim().toLowerCase().max(254).email("Format email tidak valid.").optional(),
  divisionId: z.string().trim().min(1).optional(),
  active: z.boolean().optional(),
});

export const divisionInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama divisi minimal 2 karakter.")
    .max(60, "Nama divisi maksimal 60 karakter."),
  description: z
    .string()
    .trim()
    .max(200, "Deskripsi divisi maksimal 200 karakter.")
    .optional()
    .default(""),
});

export const divisionUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Nama divisi minimal 2 karakter.")
      .max(60, "Nama divisi maksimal 60 karakter.")
      .optional(),
    description: z
      .string()
      .trim()
      .max(200, "Deskripsi divisi maksimal 200 karakter.")
      .optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Tidak ada perubahan yang dikirim.",
  });

export const policySchema = z
  .object({
    roundingMinutes: z
      .number()
      .int()
      .refine((value) => [0, 5, 10, 15, 30].includes(value), {
        message: "Pembulatan harus 0, 5, 10, 15, atau 30 menit.",
      }),
    dailyLimitMinutes: z
      .number()
      .int()
      .min(60, "Batas harian minimal 60 menit.")
      .max(
        MAX_DAILY_MINUTES,
        `Batas harian maksimal ${MAX_DAILY_MINUTES} menit (8 jam).`,
      ),
    weeklyLimitMinutes: z
      .number()
      .int()
      .min(60, "Batas mingguan minimal 60 menit.")
      .max(
        MAX_WEEKLY_MINUTES,
        `Batas mingguan maksimal ${MAX_WEEKLY_MINUTES} menit (40 jam).`,
      ),
    docGraceMinutes: z
      .number()
      .int()
      .min(0, "Tenggang dokumentasi tidak boleh negatif.")
      .max(1_440, "Tenggang dokumentasi maksimal 1.440 menit."),
    requireDocumentation: z.boolean(),
    defaultRadiusMeters: z
      .number()
      .int()
      .min(25, "Radius default minimal 25 meter.")
      .max(2_000, "Radius default maksimal 2.000 meter."),
    maxGpsAccuracyMeters: z
      .number()
      .int()
      .min(10, "Akurasi GPS minimal 10 meter.")
      .max(1_000, "Akurasi GPS maksimal 1.000 meter."),
  })
  .superRefine((value, ctx) => {
    if (value.weeklyLimitMinutes < value.dailyLimitMinutes) {
      ctx.addIssue({
        code: "custom",
        path: ["weeklyLimitMinutes"],
        message:
          "Batas mingguan harus lebih besar atau sama dengan batas harian.",
      });
    }
  });
