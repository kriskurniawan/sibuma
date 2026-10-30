import "server-only";

/**
 * Dokumen kerja memakai bucket terpisah dari dokumentasi bukti pekerjaan.
 * Endpoint dan kredensial boleh memakai ulang variabel AWS_* yang sudah ada,
 * tetapi nama bucket wajib diisi eksplisit agar bukti pekerjaan tidak
 * tercampur dengan berkas pribadi.
 */
const DOCUMENT_ENV_FALLBACKS = {
  ENDPOINT_URL: "AWS_ENDPOINT_URL_S3",
  REGION: "AWS_REGION",
  ACCESS_KEY_ID: "AWS_ACCESS_KEY_ID",
  SECRET_ACCESS_KEY: "AWS_SECRET_ACCESS_KEY",
} as const;

export type DocumentStorageSetting = keyof typeof DOCUMENT_ENV_FALLBACKS;

export function documentStorageEnv(name: DocumentStorageSetting) {
  return (
    process.env[`DOCUMENTS_S3_${name}`]?.trim() ||
    process.env[DOCUMENT_ENV_FALLBACKS[name]]?.trim() ||
    ""
  );
}

export function documentStorageBucket() {
  return process.env.DOCUMENTS_S3_BUCKET?.trim() ?? "";
}

export function documentStorageForcePathStyle() {
  return process.env.DOCUMENTS_S3_FORCE_PATH_STYLE?.trim() !== "false";
}

export function isDocumentStorageConfigured() {
  return Boolean(
    documentStorageBucket() &&
      documentStorageEnv("ENDPOINT_URL") &&
      documentStorageEnv("REGION") &&
      documentStorageEnv("ACCESS_KEY_ID") &&
      documentStorageEnv("SECRET_ACCESS_KEY"),
  );
}

export function documentStorageConfigMessage() {
  return "Penyimpanan dokumen kerja belum dikonfigurasi. Isi DOCUMENTS_S3_BUCKET, lalu DOCUMENTS_S3_ENDPOINT_URL, DOCUMENTS_S3_REGION, DOCUMENTS_S3_ACCESS_KEY_ID, dan DOCUMENTS_S3_SECRET_ACCESS_KEY (atau gunakan variabel AWS_* yang sudah ada).";
}
