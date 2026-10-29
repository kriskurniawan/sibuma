export function manualWorkErrorMessage(error: unknown, duplicate?: string) {
  const code = (error as { code?: string }).code;
  if (code === "23505") return duplicate ?? "Data serupa sudah ada.";
  if (code === "23503") return "Data terkait tidak ditemukan atau sudah dihapus.";
  if (error instanceof Error && error.message) return error.message;
  return "Terjadi kesalahan. Silakan coba lagi.";
}
