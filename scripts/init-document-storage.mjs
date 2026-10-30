import "./env.mjs";

import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutPublicAccessBlockCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const setting = (name, fallback) =>
  process.env[`DOCUMENTS_S3_${name}`]?.trim() ||
  (fallback ? process.env[fallback]?.trim() : "") ||
  "";

const endpoint = setting("ENDPOINT_URL", "AWS_ENDPOINT_URL_S3").replace(
  /\/$/,
  "",
);
const region = setting("REGION", "AWS_REGION");
const accessKeyId = setting("ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID");
const secretAccessKey = setting("SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY");
const bucket = process.env.DOCUMENTS_S3_BUCKET?.trim();
const forcePathStyle =
  process.env.DOCUMENTS_S3_FORCE_PATH_STYLE?.trim() !== "false";

const missing = [
  ["DOCUMENTS_S3_BUCKET", bucket],
  ["DOCUMENTS_S3_ENDPOINT_URL atau AWS_ENDPOINT_URL_S3", endpoint],
  ["DOCUMENTS_S3_REGION atau AWS_REGION", region],
  ["DOCUMENTS_S3_ACCESS_KEY_ID atau AWS_ACCESS_KEY_ID", accessKeyId],
  [
    "DOCUMENTS_S3_SECRET_ACCESS_KEY atau AWS_SECRET_ACCESS_KEY",
    secretAccessKey,
  ],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length > 0) {
  console.error(`Variabel berikut belum diatur: ${missing.join(", ")}`);
  process.exit(1);
}

if (bucket === process.env.NEON_STORAGE_BUCKET?.trim()) {
  console.error(
    "DOCUMENTS_S3_BUCKET harus berbeda dari NEON_STORAGE_BUCKET agar dokumen kerja tidak bercampur dengan bukti pekerjaan.",
  );
  process.exit(1);
}

const client = new S3Client({
  region,
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle,
  requestChecksumCalculation: "WHEN_REQUIRED",
});

try {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
} catch (error) {
  const status = error?.$metadata?.httpStatusCode;
  const notFound =
    status === 404 ||
    error?.name === "NotFound" ||
    error?.name === "NoSuchBucket";
  // Sebagian provider mengembalikan 403 untuk bucket yang belum ada.
  const forbidden =
    status === 403 ||
    error?.name === "AccessDenied" ||
    error?.name === "Forbidden";

  if (!notFound && !forbidden) {
    console.error(
      `Gagal memeriksa bucket "${bucket}": ${error?.message ?? error}`,
    );
    process.exit(1);
  }

  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (createError) {
    const alreadyExists =
      createError?.name === "BucketAlreadyOwnedByYou" ||
      createError?.name === "BucketAlreadyExists";
    if (!alreadyExists) {
      console.error(
        `Bucket "${bucket}" tidak dapat diperiksa atau dibuat (${createError?.name ?? createError?.$metadata?.httpStatusCode ?? "akses ditolak"}).`,
      );
      console.error(
        "Buat bucket tersebut lewat konsol penyedia atau beri izin CreateBucket pada kredensial, lalu jalankan ulang perintah ini.",
      );
      process.exit(1);
    }
  }
}

let publicAccessBlocked = true;
try {
  await client.send(
    new PutPublicAccessBlockCommand({
      Bucket: bucket,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        IgnorePublicAcls: true,
        BlockPublicPolicy: true,
        RestrictPublicBuckets: true,
      },
    }),
  );
} catch (error) {
  const status = error?.$metadata?.httpStatusCode;
  const unsupported =
    status === 501 ||
    status === 403 ||
    error?.name === "NotImplemented" ||
    error?.name === "AccessDenied" ||
    error?.name === "MalformedXML";
  if (!unsupported) throw error;
  publicAccessBlocked = false;
  console.warn(
    `Provider tidak mendukung Public Access Block (${error?.name ?? status}).`,
  );
  console.warn(
    "Pastikan bucket hanya dapat diakses memakai kredensial lewat konsol penyedia.",
  );
}

console.log(
  publicAccessBlocked
    ? `Bucket dokumen kerja "${bucket}" siap dipakai; akses publik diblokir (privat).`
    : `Bucket dokumen kerja "${bucket}" siap dipakai. Verifikasi status privat di konsol penyedia.`,
);

// Unggahan langsung dari browser memerlukan CORS bucket. Origin diambil dari
// DOCUMENTS_S3_CORS_ORIGINS (dipisah koma) atau NEXT_PUBLIC_APP_URL.
const corsOrigins = [
  ...new Set(
    (process.env.DOCUMENTS_S3_CORS_ORIGINS?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter(Boolean),
  ),
];

if (corsOrigins.length === 0) {
  console.warn(
    "CORS unggahan dilewati. Isi DOCUMENTS_S3_CORS_ORIGINS agar browser dapat mengunggah langsung ke bucket.",
  );
} else {
  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: corsOrigins,
              AllowedMethods: ["PUT"],
              AllowedHeaders: ["content-type"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
    console.log(
      `CORS unggahan diatur untuk: ${corsOrigins.join(", ")}.`,
    );
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    const unsupported =
      status === 501 ||
      status === 403 ||
      error?.name === "NotImplemented" ||
      error?.name === "AccessDenied" ||
      error?.name === "MalformedXML";
    if (!unsupported) throw error;
    console.warn(
      `Provider tidak mendukung pengaturan CORS lewat API (${error?.name ?? status}).`,
    );
    console.warn(
      `Atur CORS manual di konsol penyedia: izinkan PUT dari ${corsOrigins.join(", ")} dengan header content-type.`,
    );
  }
}
