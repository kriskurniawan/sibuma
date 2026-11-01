import { z } from "zod";
import { NOTE_MAX_DIVISIONS, NOTE_MAX_EMPLOYEES } from "./constants";

export const noteAudienceSchema = z.enum(["division", "employees"]);

const idSchema = z
  .string()
  .trim()
  .min(1, "Penerima tidak valid.")
  .max(160, "Penerima tidak valid.")
  .refine((value) => !/[\u0000-\u001F\u007F]/.test(value), {
    message: "Penerima tidak valid.",
  });

const textSchema = (
  min: number,
  max: number,
  minMessage: string,
  maxMessage: string,
) =>
  z
    .string()
    .trim()
    .min(min, minMessage)
    .max(max, maxMessage)
    .refine((value) => !value.includes("\u0000"), {
      message: "Teks mengandung karakter yang tidak didukung.",
    });

export const noteCreateSchema = z
  .object({
    title: textSchema(
      1,
      160,
      "Judul catatan wajib diisi.",
      "Judul catatan maksimal 160 karakter.",
    ),
    body: textSchema(
      1,
      2_000,
      "Isi catatan wajib diisi.",
      "Isi catatan maksimal 2.000 karakter.",
    ),
    audienceType: noteAudienceSchema,
    divisionIds: z
      .array(idSchema)
      .max(NOTE_MAX_DIVISIONS, `Pilih maksimal ${NOTE_MAX_DIVISIONS} divisi.`),
    employeeIds: z
      .array(idSchema)
      .max(NOTE_MAX_EMPLOYEES, `Pilih maksimal ${NOTE_MAX_EMPLOYEES} karyawan.`),
    clientRequestId: z
      .string()
      .trim()
      .regex(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        "Kunci permintaan tidak valid.",
      )
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.audienceType === "division") {
      if (value.divisionIds.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["divisionIds"],
          message: "Pilih minimal satu divisi tujuan.",
        });
      }
      if (value.employeeIds.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["employeeIds"],
          message: "Penerima divisi tidak boleh dicampur dengan karyawan.",
        });
      }
      return;
    }

    if (value.employeeIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["employeeIds"],
        message: "Pilih minimal satu karyawan.",
      });
    }
    if (value.divisionIds.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["divisionIds"],
        message: "Penerima karyawan tidak boleh memakai divisi.",
      });
    }
  });

export type NoteCreateInput = z.infer<typeof noteCreateSchema>;
