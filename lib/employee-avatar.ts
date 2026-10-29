import "server-only";

import { randomUUID } from "node:crypto";
import { insertAudit } from "./audit";
import { query, transaction } from "./db";
import { deleteObject, putObject } from "./storage";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type AvatarContentType = keyof typeof EXTENSIONS;

function hasMagicBytes(bytes: Uint8Array, contentType: AvatarContentType) {
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
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
  return (
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  );
}

async function readAvatarUpload(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Pilih foto terlebih dahulu.");
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("Ukuran foto maksimal 2 MB.");
  }
  const extension = EXTENSIONS[file.type as AvatarContentType];
  if (!extension) {
    throw new Error("Format foto harus JPEG, PNG, atau WebP.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasMagicBytes(bytes, file.type as AvatarContentType)) {
    throw new Error("Isi berkas tidak cocok dengan format foto.");
  }
  return { bytes, extension, contentType: file.type };
}

interface AvatarActor {
  id: string;
  name: string;
}

export async function saveEmployeeAvatar(input: {
  employeeId: string;
  file: FormDataEntryValue | null;
  actor: AvatarActor;
  summary: string;
}) {
  const upload = await readAvatarUpload(input.file);
  const key = `avatars/${input.employeeId}/${randomUUID()}.${upload.extension}`;
  await putObject(key, upload.bytes, upload.contentType);

  let previousKey: string | null = null;
  try {
    await transaction(async (connection) => {
      const [employee] = await query<{
        avatar_key: string | null;
        name: string;
      }>(
        "SELECT avatar_key,name FROM employees WHERE id=$1 FOR UPDATE",
        [input.employeeId],
        connection,
      );
      if (!employee) throw new Error("Akun tidak ditemukan.");
      previousKey = employee.avatar_key;

      await query(
        "UPDATE employees SET avatar_key=$2,updated_at=$3 WHERE id=$1",
        [input.employeeId, key, new Date().toISOString()],
        connection,
      );
      await insertAudit(connection, {
        actorId: input.actor.id,
        actorName: input.actor.name,
        action: "foto_profil_diubah",
        objectType: "karyawan",
        objectId: input.employeeId,
        summary: input.summary,
        before: { avatarKey: previousKey },
        after: { avatarKey: key },
      });
    });
  } catch (error) {
    await deleteObject(key, "s3").catch((cleanupError) => {
      console.error(`Gagal membersihkan avatar baru ${key}:`, cleanupError);
    });
    throw error;
  }

  if (previousKey && previousKey !== key) {
    await deleteObject(previousKey, "s3").catch((error) => {
      console.error(`Gagal menghapus avatar lama ${previousKey}:`, error);
    });
  }

  return { avatarKey: key };
}

export async function removeEmployeeAvatar(input: {
  employeeId: string;
  actor: AvatarActor;
  summary: string;
}) {
  const previousKey = await transaction(async (connection) => {
    const [employee] = await query<{ avatar_key: string | null }>(
      "SELECT avatar_key FROM employees WHERE id=$1 FOR UPDATE",
      [input.employeeId],
      connection,
    );
    if (!employee) throw new Error("Akun tidak ditemukan.");
    if (!employee.avatar_key) return null;

    await query(
      "UPDATE employees SET avatar_key=NULL,updated_at=$2 WHERE id=$1",
      [input.employeeId, new Date().toISOString()],
      connection,
    );
    await insertAudit(connection, {
      actorId: input.actor.id,
      actorName: input.actor.name,
      action: "foto_profil_dihapus",
      objectType: "karyawan",
      objectId: input.employeeId,
      summary: input.summary,
      before: { avatarKey: employee.avatar_key },
      after: { avatarKey: null },
    });
    return employee.avatar_key;
  });

  if (previousKey) {
    await deleteObject(previousKey, "s3").catch((error) => {
      console.error(`Gagal menghapus avatar ${previousKey}:`, error);
    });
  }
  return { avatarKey: null };
}
