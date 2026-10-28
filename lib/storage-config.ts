import "server-only";

export const S3_REQUIRED_ENV = [
  "AWS_ENDPOINT_URL_S3",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "NEON_STORAGE_BUCKET",
] as const;

export function storageEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function isS3Configured() {
  return S3_REQUIRED_ENV.every((name) => Boolean(storageEnv(name)));
}

export function storageConfigMessage() {
  return `Penyimpanan dokumentasi belum dikonfigurasi. Isi ${S3_REQUIRED_ENV.join(", ")}.`;
}
