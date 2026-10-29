/**
 * Avatar selalu dibaca lewat route ber-sesi, bukan URL object storage.
 * Kunci objek dipakai sebagai versi agar unggahan baru langsung terlihat.
 */
export function avatarUrl(
  employeeId: string,
  avatarKey?: string | null,
): string | undefined {
  if (!avatarKey) return undefined;
  return `/api/avatars/${encodeURIComponent(employeeId)}?v=${encodeURIComponent(avatarKey)}`;
}
