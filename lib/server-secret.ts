import "server-only";

/**
 * Single source of truth for the server signing secret.
 *
 * Production must fail closed: a missing, short, or development secret is a
 * deployment error, not a reason to silently fall back. The check is lazy so
 * `next build` can import modules without requiring runtime secrets.
 */
const DEV_SECRET = "dev-only-secret-change-me-before-production-32chars";
const MIN_SECRET_LENGTH = 32;

export function serverSecret() {
  const configured = process.env.SESSION_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!configured || configured.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `SESSION_SECRET wajib diisi minimal ${MIN_SECRET_LENGTH} karakter di produksi.`,
      );
    }
    if (configured === DEV_SECRET) {
      throw new Error("SESSION_SECRET masih memakai nilai pengembangan.");
    }
    return configured;
  }
  return configured && configured.length > 0 ? configured : DEV_SECRET;
}
