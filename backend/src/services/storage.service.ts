import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";

import { env } from "../config/env";
import { AppError } from "../utils/app-error";

const storageConfigured = Boolean(
  env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
);

const storageClientOptions = storageConfigured
  ? {
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!
      }
    }
  : null;

const client = storageClientOptions
  ? new S3Client({ ...storageClientOptions, endpoint: env.S3_ENDPOINT })
  : null;

const uploadClient = storageClientOptions
  ? new S3Client({ ...storageClientOptions, endpoint: env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT })
  : null;

function getStorage() {
  if (!client || !env.S3_BUCKET) {
    throw new AppError(503, "Object storage is not configured", "STORAGE_NOT_CONFIGURED");
  }
  return { client, bucket: env.S3_BUCKET };
}

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export async function createPetPhotoUpload(accountId: string, contentType: string, sizeBytes: number) {
  const extension = extensions[contentType];
  if (!extension) throw new AppError(400, "Unsupported image type", "UNSUPPORTED_MEDIA_TYPE");
  if (sizeBytes > env.PET_PHOTO_MAX_BYTES) {
    throw new AppError(413, "Pet photo is too large", "PHOTO_TOO_LARGE");
  }
  const { bucket } = getStorage();
  if (!uploadClient) {
    throw new AppError(503, "Object storage is not configured", "STORAGE_NOT_CONFIGURED");
  }
  const photoKey = `pets/${accountId}/${crypto.randomUUID()}.${extension}`;
  const uploadUrl = await getSignedUrl(
    uploadClient,
    new PutObjectCommand({ Bucket: bucket, Key: photoKey, ContentType: contentType, ContentLength: sizeBytes }),
    { expiresIn: 600 }
  );
  return { uploadUrl, photoKey, expiresIn: 600 };
}

export function assertOwnedPhotoKey(accountId: string, photoKey: string) {
  if (!photoKey.startsWith(`pets/${accountId}/`) || photoKey.includes("..")) {
    throw new AppError(403, "Photo does not belong to this account", "FORBIDDEN");
  }
}

export async function assertPhotoExists(accountId: string, photoKey: string) {
  assertOwnedPhotoKey(accountId, photoKey);
  const { client: s3, bucket } = getStorage();
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: photoKey }));
  } catch (_error) {
    throw new AppError(400, "Uploaded photo was not found", "PHOTO_NOT_FOUND");
  }
}

export async function getPetPhotoUrl(photoKey: string | null) {
  if (!photoKey) return null;
  if (env.S3_PUBLIC_BASE_URL) {
    const encodedKey = photoKey.split("/").map(encodeURIComponent).join("/");
    return `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${encodedKey}`;
  }
  const { client: s3, bucket } = getStorage();
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: photoKey }), { expiresIn: 3600 });
}

export async function deletePetPhoto(photoKey: string | null) {
  if (!photoKey || !storageConfigured) return;
  const { client: s3, bucket } = getStorage();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: photoKey }));
}
