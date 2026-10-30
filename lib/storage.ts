import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  isS3Configured,
  storageConfigMessage,
  storageEnv as env,
} from "./storage-config";
import type { StorageProvider } from "./types";

function assertConfigured() {
  if (!isS3Configured()) throw new Error(storageConfigMessage());
}

let s3Client: S3Client | null = null;

function s3() {
  assertConfigured();
  if (!s3Client) {
    s3Client = new S3Client({
      region: env("AWS_REGION"),
      endpoint: env("AWS_ENDPOINT_URL_S3").replace(/\/$/, ""),
      credentials: {
        accessKeyId: env("AWS_ACCESS_KEY_ID"),
        secretAccessKey: env("AWS_SECRET_ACCESS_KEY"),
      },
      forcePathStyle: true,
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
  }
  return s3Client;
}

function bucket() {
  assertConfigured();
  return env("NEON_STORAGE_BUCKET");
}

function assertS3Provider(provider: StorageProvider) {
  if (provider !== "s3") {
    throw new Error(
      "Dokumentasi lama belum dipindahkan ke object storage S3. Penyimpanan lokal tidak tersedia.",
    );
  }
}

export async function putObject(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<"s3"> {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return "s3";
}

export async function getObject(
  key: string,
  provider: StorageProvider,
): Promise<{ bytes: Uint8Array; contentType?: string; contentLength?: number }> {
  assertS3Provider(provider);
  const response = await s3().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
  );
  if (!response.Body) throw new Error("Isi berkas tidak tersedia.");
  const bytes = await response.Body.transformToByteArray();
  return {
    bytes,
    contentType: response.ContentType,
    contentLength: bytes.byteLength,
  };
}

export async function assertObjectsExist(keys: string[]): Promise<void> {
  for (const key of new Set(keys)) {
    await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
  }
}

export async function deleteObject(
  key: string,
  provider: StorageProvider,
): Promise<void> {
  assertS3Provider(provider);
  await s3().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: key }),
  );
}

/** Video dokumentasi: unggah langsung dari browser, tidak lewat Vercel. */
export const VIDEO_UPLOAD_URL_TTL_SECONDS = 15 * 60;
/** Pemutaran: URL pendek, diterbitkan ulang setiap kali pemutaran dimulai. */
export const VIDEO_VIEW_URL_TTL_SECONDS = 15 * 60;

export async function headObject(key: string) {
  const response = await s3().send(
    new HeadObjectCommand({ Bucket: bucket(), Key: key }),
  );
  return {
    contentLength: response.ContentLength ?? 0,
    contentType: response.ContentType ?? null,
    etag: response.ETag?.replaceAll('"', "") ?? null,
  };
}

/**
 * Ukuran dan tipe ikut ditandatangani agar storage menolak berkas yang
 * berbeda dari yang diperiksa server.
 */
export async function presignObjectUpload(
  key: string,
  contentType: string,
  contentLength: number,
  expiresIn = VIDEO_UPLOAD_URL_TTL_SECONDS,
) {
  const uploadUrl = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn },
  );
  return { uploadUrl, expiresIn };
}

export async function presignObjectView(
  key: string,
  expiresIn = VIDEO_VIEW_URL_TTL_SECONDS,
) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn },
  );
}

/**
 * Hanya dipakai untuk memeriksa beberapa byte awal. Rentang ditandatangani
 * langsung oleh SDK karena bucket utama mendukung GET dengan header Range.
 */
export async function readObjectRange(key: string, start: number, end: number) {
  const response = await s3().send(
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      Range: `bytes=${start}-${end}`,
    }),
  );
  if (!response.Body) throw new Error("Isi berkas tidak tersedia.");
  return response.Body.transformToByteArray();
}
