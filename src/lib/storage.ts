import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "mock-key",
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "mock-secret",
  },
});

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || "school-erp-documents";

/**
 * Generate a presigned PUT URL for client-side direct upload
 * Zero server bandwidth consumed
 */
export async function generatePresignedUploadUrl(
  schoolId: string,
  fileName: string,
  contentType: string
): Promise<{ uploadUrl: string; fileKey: string; publicUrl: string }> {
  const extension = fileName.split(".").pop() || "bin";
  const fileKey = `${schoolId}/${crypto.randomUUID()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL || "https://assets.schoolerp.internal";
  const publicUrl = `${publicBaseUrl}/${fileKey}`;

  return { uploadUrl, fileKey, publicUrl };
}

/**
 * Generate a presigned GET URL for temporary private downloads
 */
export async function generatePresignedDownloadUrl(fileKey: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
  });

  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}
