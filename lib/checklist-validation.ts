import { z } from "zod";
import {
  CHECKLIST_MAX_ASSIGNEES,
  CHECKLIST_MAX_GROUPS,
  CHECKLIST_MAX_ITEMS,
} from "./checklist-types";

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

export const checklistLocationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama lokasi minimal 2 karakter.")
    .max(80, "Nama lokasi maksimal 80 karakter."),
  description: z
    .string()
    .trim()
    .max(300, "Keterangan lokasi maksimal 300 karakter.")
    .optional()
    .default(""),
  publicDescription: z
    .string()
    .trim()
    .max(300, "Keterangan publik maksimal 300 karakter.")
    .optional()
    .default(""),
  publicEnabled: z.boolean().optional(),
  parentId: id.nullish(),
  active: z.boolean().optional(),
});

export const checklistLocationUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(300).optional(),
  publicDescription: z.string().trim().max(300).optional(),
  publicEnabled: z.boolean().optional(),
  parentId: id.nullish(),
  active: z.boolean().optional(),
});

export const checklistPhotoPolicySchema = z.enum([
  "opsional",
  "wajib",
  "wajib_saat_masalah",
]);

export const checklistTemplateItemSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(3, "Item checklist minimal 3 karakter.")
    .max(300, "Item checklist maksimal 300 karakter."),
  guidance: z
    .string()
    .trim()
    .max(600, "Panduan maksimal 600 karakter.")
    .optional()
    .default(""),
  required: z.boolean().optional().default(true),
  photoPolicy: checklistPhotoPolicySchema.optional().default("opsional"),
  requireNoteOnIssue: z.boolean().optional().default(true),
  publicVisible: z.boolean().optional().default(false),
  itemType: z.enum(["grup", "item"]).optional().default("item"),
  parentIndex: z.number().int().min(0).nullable().optional().default(null),
});

/**
 * Flat, depth-first list: a group must appear before its children and
 * `parentIndex` points at the group in this same array. Only leaf items are
 * answered; a group without a child is rejected.
 */
export const checklistTemplateItemsSchema = z
  .array(checklistTemplateItemSchema)
  .min(1, "Tambahkan minimal satu item checklist.")
  .max(
    CHECKLIST_MAX_ITEMS + CHECKLIST_MAX_GROUPS,
    `Maksimal ${CHECKLIST_MAX_ITEMS} item dan ${CHECKLIST_MAX_GROUPS} grup per template.`,
  )
  .superRefine((items, ctx) => {
    const leaves = items.filter((item) => item.itemType === "item");
    const groups = items.filter((item) => item.itemType === "grup");

    if (leaves.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Tambahkan minimal satu item checklist.",
      });
    }
    if (leaves.length > CHECKLIST_MAX_ITEMS) {
      ctx.addIssue({
        code: "custom",
        message: `Maksimal ${CHECKLIST_MAX_ITEMS} item per template.`,
      });
    }
    if (groups.length > CHECKLIST_MAX_GROUPS) {
      ctx.addIssue({
        code: "custom",
        message: `Maksimal ${CHECKLIST_MAX_GROUPS} grup per template.`,
      });
    }

    const groupNames = new Set<string>();
    for (const [index, item] of items.entries()) {
      const label = item.prompt.trim() || `Grup ${index + 1}`;
      if (item.itemType === "grup") {
        if (item.parentIndex !== null) {
          ctx.addIssue({
            code: "custom",
            path: [index, "parentIndex"],
            message: "Grup tidak bisa berada di dalam grup lain.",
          });
        }
        const name = item.prompt.trim().toLowerCase();
        if (groupNames.has(name)) {
          ctx.addIssue({
            code: "custom",
            path: [index, "prompt"],
            message: `Nama grup "${item.prompt.trim()}" dipakai lebih dari sekali.`,
          });
        }
        groupNames.add(name);
        if (!items.some((child) => child.parentIndex === index)) {
          ctx.addIssue({
            code: "custom",
            path: [index, "prompt"],
            message: `Grup "${label}" belum punya sub-item.`,
          });
        }
        continue;
      }

      if (item.parentIndex === null) continue;
      if (item.parentIndex >= index) {
        ctx.addIssue({
          code: "custom",
          path: [index, "parentIndex"],
          message: "Sub-item harus berada setelah grupnya.",
        });
        continue;
      }
      const parent = items[item.parentIndex];
      if (!parent || parent.itemType !== "grup") {
        ctx.addIssue({
          code: "custom",
          path: [index, "parentIndex"],
          message: "Induk sub-item harus berupa grup.",
        });
      }
    }
  });

export const checklistTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nama template minimal 3 karakter.")
    .max(100, "Nama template maksimal 100 karakter."),
  category: z
    .string()
    .trim()
    .min(2, "Kategori minimal 2 karakter.")
    .max(60, "Kategori maksimal 60 karakter."),
  description: z
    .string()
    .trim()
    .max(500, "Deskripsi maksimal 500 karakter.")
    .optional()
    .default(""),
  items: checklistTemplateItemsSchema,
});

export const checklistTemplateUpdateSchema = z.object({
  name: z.string().trim().min(3).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  active: z.boolean().optional(),
});

export const checklistVersionSchema = z.object({
  notes: z
    .string()
    .trim()
    .max(500, "Catatan versi maksimal 500 karakter.")
    .optional()
    .default(""),
  items: checklistTemplateItemsSchema,
});

export const checklistScheduleSchema = z.object({
  templateId: id,
  locationId: id,
  intervalUnit: z.enum(["hari", "minggu", "bulan"]),
  intervalCount: z
    .number()
    .int("Interval harus bilangan bulat.")
    .min(1, "Interval minimal 1.")
    .max(365, "Interval maksimal 365."),
  anchorDate: dateOnly,
  dueDays: z
    .number()
    .int("Deadline harus bilangan bulat.")
    .min(0, "Deadline minimal 0 hari.")
    .max(90, "Deadline maksimal 90 hari."),
  assigneeIds: z
    .array(id)
    .min(1, "Pilih minimal satu anggota tim.")
    .max(
      CHECKLIST_MAX_ASSIGNEES,
      `Maksimal ${CHECKLIST_MAX_ASSIGNEES} anggota per jadwal.`,
    ),
  active: z.boolean().optional().default(true),
});

export const checklistScheduleUpdateSchema = checklistScheduleSchema
  .omit({ templateId: true, locationId: true })
  .partial()
  .extend({
    templateId: id.optional(),
    locationId: id.optional(),
    active: z.boolean().optional(),
  });

export const checklistAnswerSchema = z.object({
  condition: z.string().trim().min(1).max(64).nullable(),
  note: z
    .string()
    .trim()
    .max(2_000, "Catatan maksimal 2.000 karakter.")
    .optional()
    .default(""),
  expectedVersion: z
    .number()
    .int("Versi item tidak valid.")
    .min(0, "Versi item tidak valid."),
});

export const checklistReopenSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Alasan membuka kembali minimal 10 karakter.")
    .max(500, "Alasan maksimal 500 karakter."),
});

export const checklistFollowUpSchema = z.object({
  inspectionId: id,
  answerId: id.nullish(),
  title: z
    .string()
    .trim()
    .min(4, "Judul tindak lanjut minimal 4 karakter.")
    .max(140, "Judul tindak lanjut maksimal 140 karakter."),
  description: z
    .string()
    .trim()
    .max(2_000, "Deskripsi maksimal 2.000 karakter.")
    .optional()
    .default(""),
  picId: id.nullish(),
  priority: z
    .enum(["rendah", "sedang", "tinggi", "mendesak"])
    .optional()
    .default("sedang"),
  dueDate: dateOnly.nullish(),
});

export const checklistFollowUpUpdateSchema = z.object({
  status: z.enum([
    "terbuka",
    "diproses",
    "tertunda",
    "selesai",
    "dibatalkan",
  ]),
  progressNote: z
    .string()
    .trim()
    .max(2_000, "Catatan progres maksimal 2.000 karakter.")
    .optional()
    .default(""),
  cancelReason: z
    .string()
    .trim()
    .max(500, "Alasan pembatalan maksimal 500 karakter.")
    .nullish(),
  resultNote: z
    .string()
    .trim()
    .max(2_000, "Hasil tindak lanjut maksimal 2.000 karakter.")
    .optional()
    .default(""),
  dueDate: dateOnly.nullish(),
});

export const checklistConditionSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, "Nama status minimal 2 karakter.")
    .max(40, "Nama status maksimal 40 karakter."),
  tone: z
    .enum(["success", "warning", "danger", "neutral"])
    .optional()
    .default("neutral"),
  isIssue: z.boolean().optional().default(false),
  requiresNote: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
});

export const checklistConditionUpdateSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, "Nama status minimal 2 karakter.")
    .max(40, "Nama status maksimal 40 karakter.")
    .optional(),
  tone: z.enum(["success", "warning", "danger", "neutral"]).optional(),
  isIssue: z.boolean().optional(),
  requiresNote: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const checklistConditionOrderSchema = z.object({
  ids: z
    .array(id)
    .min(1, "Tidak ada status yang diurutkan.")
    .max(100, "Terlalu banyak status."),
});

export const checklistQrSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Nama QR minimal 3 karakter.")
      .max(80, "Nama QR maksimal 80 karakter."),
    mode: z.enum(["pilih_area", "langsung"]),
    locationId: id.nullish(),
    active: z.boolean().optional().default(true),
  })
  .refine((value) => value.mode !== "langsung" || Boolean(value.locationId), {
    message: "Pilih area tujuan untuk QR langsung.",
    path: ["locationId"],
  });

export const checklistQrUpdateSchema = z.object({
  name: z.string().trim().min(3).max(80).optional(),
  mode: z.enum(["pilih_area", "langsung"]).optional(),
  locationId: id.nullish(),
  active: z.boolean().optional(),
});
