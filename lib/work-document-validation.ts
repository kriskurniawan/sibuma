import { z } from "zod";
import {
  WORK_DOCUMENT_EXTENSIONS,
  WORK_DOCUMENT_HARD_MAX_BYTES,
} from "./work-document-types";

export const workDocumentSettingsSchema = z
  .object({
    uploadsEnabled: z.boolean(),
    maxFileMb: z
      .number()
      .int("Ukuran maksimal harus bilangan bulat.")
      .min(1, "Ukuran maksimal minimal 1 MB.")
      .max(
        WORK_DOCUMENT_HARD_MAX_BYTES / 1024 / 1024,
        "Ukuran maksimal tidak boleh melebihi 100 MB.",
      ),
    quotaMb: z
      .number()
      .int("Kuota harus bilangan bulat.")
      .min(1, "Kuota minimal 1 MB.")
      .max(102_400, "Kuota maksimal 100 GB."),
    maxVideoMb: z
      .number()
      .int("Ukuran video maksimal harus bilangan bulat.")
      .min(1, "Ukuran video maksimal minimal 1 MB.")
      .max(
        WORK_DOCUMENT_HARD_MAX_BYTES / 1024 / 1024,
        "Ukuran video maksimal tidak boleh melebihi 100 MB.",
      ),
    allowedExtensions: z
      .array(z.enum(WORK_DOCUMENT_EXTENSIONS))
      .min(1, "Pilih minimal satu jenis berkas.")
      .refine(
        (values) => new Set(values).size === values.length,
        "Jenis berkas tidak boleh ganda.",
      ),
    trashRetentionDays: z
      .number()
      .int("Masa simpan sampah harus bilangan bulat.")
      .min(1, "Masa simpan sampah minimal 1 hari.")
      .max(365, "Masa simpan sampah maksimal 365 hari."),
    shareToDivision: z.boolean(),
    shareToSupervisor: z.boolean(),
  })
  .refine((value) => value.quotaMb >= value.maxFileMb, {
    path: ["quotaMb"],
    message: "Kuota per pengguna tidak boleh lebih kecil dari ukuran maksimal berkas.",
  });

export type WorkDocumentSettingsInput = z.infer<
  typeof workDocumentSettingsSchema
>;

export const workDocumentUpdateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Nama dokumen wajib diisi.")
    .max(160, "Nama dokumen maksimal 160 karakter."),
  description: z
    .string()
    .trim()
    .max(1_000, "Keterangan maksimal 1.000 karakter.")
    .optional()
    .default(""),
});

export const workDocumentUploadMetaSchema = z.object({
  title: z
    .string()
    .trim()
    .max(160, "Nama dokumen maksimal 160 karakter.")
    .optional()
    .default(""),
  description: z
    .string()
    .trim()
    .max(1_000, "Keterangan maksimal 1.000 karakter.")
    .optional()
    .default(""),
  folderId: z
    .string()
    .regex(/^fld_[a-z0-9-]{36}$/, "Folder tidak valid.")
    .nullable()
    .optional()
    .default(null),
});

const UPLOAD_KEY_PATTERN = new RegExp(
  `^documents/[A-Za-z0-9_-]+/[0-9a-f-]{36}\\.(${WORK_DOCUMENT_EXTENSIONS.join("|")})$`,
);

export const workDocumentUploadPrepareSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, "Pilih berkas yang akan diunggah.")
    .max(200, "Nama berkas maksimal 200 karakter."),
  sizeBytes: z
    .number()
    .int("Ukuran berkas tidak valid.")
    .positive("Berkas kosong tidak dapat diunggah.")
    .max(
      WORK_DOCUMENT_HARD_MAX_BYTES,
      "Ukuran berkas melebihi batas keras 100 MB.",
    ),
});

export const workDocumentUploadCompleteSchema =
  workDocumentUploadPrepareSchema
    .extend({
      key: z
        .string()
        .regex(UPLOAD_KEY_PATTERN, "Kunci unggahan tidak valid."),
      // Video besar tidak di-hash di perangkat; server memakai ETag objek.
      checksumSha256: z
        .string()
        .regex(/^[a-f0-9]{64}$/i, "Checksum berkas tidak valid.")
        .optional(),
    })
    .merge(workDocumentUploadMetaSchema);

const DIVISION_ID_PATTERN = /^div_[A-Za-z0-9-]{1,64}$/;
const EMPLOYEE_ID_PATTERN = /^emp_[A-Za-z0-9-]{1,64}$/;

function uniqueIds(values: string[]) {
  return new Set(values).size === values.length;
}

export const workDocumentShareSchema = z.object({
  divisionIds: z
    .array(z.string().regex(DIVISION_ID_PATTERN, "Divisi tidak valid."))
    .max(200, "Terlalu banyak divisi yang dipilih.")
    .refine(uniqueIds, "Divisi yang dipilih tidak boleh ganda.")
    .optional()
    .default([]),
  supervisorIds: z
    .array(z.string().regex(EMPLOYEE_ID_PATTERN, "Atasan tidak valid."))
    .max(200, "Terlalu banyak atasan yang dipilih.")
    .refine(uniqueIds, "Atasan yang dipilih tidak boleh ganda.")
    .optional()
    .default([]),
});

export type WorkDocumentShareInput = z.infer<typeof workDocumentShareSchema>;

export const workDocumentFolderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama folder wajib diisi.")
    .max(120, "Nama folder maksimal 120 karakter."),
  description: z
    .string()
    .trim()
    .max(1_000, "Deskripsi folder maksimal 1.000 karakter.")
    .optional()
    .default(""),
});

export const workDocumentMoveSchema = z.object({
  folderId: z
    .string()
    .regex(/^fld_[a-z0-9-]{36}$/, "Folder tidak valid.")
    .nullable(),
});

export type WorkDocumentFolderInput = z.infer<typeof workDocumentFolderSchema>;
