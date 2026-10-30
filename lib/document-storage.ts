import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  documentStorageBucket,
  documentStorageConfigMessage,
  documentStorageEnv,
  documentStorageForcePathStyle,
  isDocumentStorageConfigured,
} from "./document-storage-config";

function assertConfigured() {
  if (!isDocumentStorageConfigured()) {
    throw new Error(documentStorageConfigMessage());
  }
}

let documentS3Client: S3Client | null = null;

function s3() {
  assertConfigured();
  if (!documentS3Client) {
    documentS3Client = new S3Client({
      region: documentStorageEnv("REGION"),
      endpoint: documentStorageEnv("ENDPOINT_URL").replace(/\/$/, ""),
      credentials: {
        accessKeyId: documentStorageEnv("ACCESS_KEY_ID"),
        secretAccessKey: documentStorageEnv("SECRET_ACCESS_KEY"),
      },
      forcePathStyle: documentStorageForcePathStyle(),
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
  }
  return documentS3Client;
}

function bucket() {
  assertConfigured();
  return documentStorageBucket();
}

/** Kunci objek tidak pernah memakai nama asli berkas pengguna. */
export function documentStorageKey(ownerId: string, extension: string) {
  const owner = ownerId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `documents/${owner}/${crypto.randomUUID()}.${extension}`;
}

export const DOCUMENT_UPLOAD_URL_TTL_SECONDS = 15 * 60;

/**
 * URL unggah sementara untuk klien. Hanya operasi PUT yang ditandatangani;
 * pratinjau dan unduhan tetap melewati route aplikasi agar akses dapat
 * dicabut seketika. Batas ukuran dan isi berkas diverifikasi ulang sebelum
 * baris dokumen dibuat.
 */
export async function presignDocumentUpload(
  key: string,
  contentType: string,
  contentLength: number,
) {
  const uploadUrl = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
      // Ikut ditandatangani agar storage menolak berkas yang ukurannya
      // berbeda dari yang diperiksa server.
      ContentLength: contentLength,
    }),
    { expiresIn: DOCUMENT_UPLOAD_URL_TTL_SECONDS },
  );
  return { uploadUrl, expiresIn: DOCUMENT_UPLOAD_URL_TTL_SECONDS };
}

/**
 * Ukuran objek dibaca lewat daftar objek karena storage RustFS menolak HEAD.
 * Kunci objek selalu unik, jadi satu hasil dengan kunci yang sama persis
 * cukup; kunci yang tidak ada berarti unggahan belum selesai.
 */
export async function statDocumentObject(key: string) {
  const response = await s3().send(
    new ListObjectsV2Command({
      Bucket: bucket(),
      Prefix: key,
      MaxKeys: 1,
    }),
  );
  const match = response.Contents?.find((object) => object.Key === key);
  if (!match) return null;
  return {
    contentLength: match.Size ?? null,
    etag: match.ETag?.replaceAll('"', "") ?? null,
  };
}

/**
 * URL baca sementara untuk video. Pratinjau gambar dan PDF tetap melewati
 * route aplikasi; khusus video, byte dialirkan langsung dari storage agar
 * tidak melewati batas dan biaya Vercel. Header Range dari browser bekerja
 * pada URL ini (diuji: 206 Partial Content).
 */
export async function presignDocumentView(
  key: string,
  expiresIn = 15 * 60,
  responseContentDisposition?: string,
) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: responseContentDisposition,
    }),
    { expiresIn },
  );
}

/**
 * Hanya beberapa byte awal yang dibaca untuk memeriksa magic bytes. Rentang
 * byte tidak dipakai karena RustFS menolak GET dengan header Range, jadi
 * aliran dihentikan setelah potongan pertama yang cukup.
 */
export async function readDocumentObjectPrefix(key: string, length = 16) {
  const response = await s3().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
  );
  if (!response.Body) throw new Error("Isi berkas tidak tersedia.");

  const reader = response.Body.transformToWebStream().getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < length) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    // Sisa berkas tidak perlu diunduh; batalkan agar koneksi ditutup.
    await reader.cancel().catch(() => {});
  }

  const bytes = new Uint8Array(Math.min(total, length));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= bytes.length) break;
    const slice = chunk.subarray(0, bytes.length - offset);
    bytes.set(slice, offset);
    offset += slice.byteLength;
  }
  return bytes;
}

export async function getDocumentObjectStream(key: string) {
  const response = await s3().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
  );
  if (!response.Body) throw new Error("Isi berkas tidak tersedia.");
  // Dialirkan, bukan dibaca penuh, agar berkas besar tidak melewati batas
  // payload respons fungsi serverless dan memori tetap rendah.
  return {
    stream: response.Body.transformToWebStream(),
    contentLength: response.ContentLength ?? null,
  };
}

export async function deleteDocumentObject(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
