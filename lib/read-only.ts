import "server-only";
import { apiError } from "./http";
import type { SessionUser } from "./types";

export const READ_ONLY_MESSAGE =
  "Akun ini hanya dapat melihat data. Perubahan tidak diizinkan.";

/**
 * Guard terpusat untuk seluruh route mutasi. Dipanggil setelah sesi diperiksa
 * dan sebelum body multipart/JSON dibaca, agar akun "Hanya lihat" tidak pernah
 * menyentuh storage, notifikasi, maupun transaksi database.
 */
export function readOnlyWrite(user: Pick<SessionUser, "accessMode">) {
  return user.accessMode === "read_only" ? apiError(READ_ONLY_MESSAGE, 403) : null;
}
