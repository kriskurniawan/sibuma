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

export interface ServerSecretStatus {
  ready: boolean;
  message: string;
}

/**
 * Status konfigurasi tanpa membocorkan nilai secret. Dipakai health check agar
 * kegagalan deploy (mis. SESSION_SECRET belum diisi di Vercel) terlihat jelas.
 * Di pengembangan, fallback dev membuat aplikasi tetap siap.
 */
export function serverSecretStatus(): ServerSecretStatus {
  const configured = process.env.SESSION_SECRET?.trim() ?? "";
  if (process.env.NODE_ENV !== "production") {
    return {
      ready: true,
      message: configured ? "ok" : "mode pengembangan (fallback dev)",
    };
  }
  if (!configured) {
    return {
      ready: false,
      message: `SESSION_SECRET belum diisi. Isi minimal ${MIN_SECRET_LENGTH} karakter di environment produksi.`,
    };
  }
  if (configured.length < MIN_SECRET_LENGTH) {
    return {
      ready: false,
      message: `SESSION_SECRET minimal ${MIN_SECRET_LENGTH} karakter di produksi.`,
    };
  }
  if (configured === DEV_SECRET) {
    return { ready: false, message: "SESSION_SECRET masih memakai nilai pengembangan." };
  }
  return { ready: true, message: "ok" };
}

export function serverSecret() {
  const status = serverSecretStatus();
  if (!status.ready) throw new Error(status.message);
  return process.env.SESSION_SECRET?.trim() || DEV_SECRET;
}
