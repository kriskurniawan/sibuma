import "./env.mjs";

import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutPublicAccessBlockCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const endpoint = process.env.AWS_ENDPOINT_URL_S3?.trim().replace(/\/$/, "");
const region = process.env.AWS_REGION?.trim();
const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
const bucket = process.env.NEON_STORAGE_BUCKET?.trim();

const missing = [
  ["AWS_ENDPOINT_URL_S3", endpoint],
  ["AWS_REGION", region],
  ["AWS_ACCESS_KEY_ID", accessKeyId],
  ["AWS_SECRET_ACCESS_KEY", secretAccessKey],
  ["NEON_STORAGE_BUCKET", bucket],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length > 0) {
  console.error(`Variabel berikut belum diatur: ${missing.join(", ")}`);
  process.exit(1);
}

const client = new S3Client({
  region,
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
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

  if (!notFound) {
    console.error(
      `Gagal memeriksa bucket "${bucket}": ${error?.message ?? error}`,
    );
    process.exit(1);
  }

  await client.send(new CreateBucketCommand({ Bucket: bucket }));
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
    error?.name === "NotImplemented" ||
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
    ? `Bucket "${bucket}" siap dipakai; akses publik diblokir (privat).`
    : `Bucket "${bucket}" siap dipakai. Verifikasi status privat di konsol penyedia.`,
);
