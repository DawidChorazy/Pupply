import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";

import { env } from "../config/env";
import { AppError } from "../utils/app-error";
import { prisma } from "../config/prisma";

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

async function createPhotoUpload(accountId: string, contentType: string, sizeBytes: number, purpose: "pets" | "sitters") {
  const extension = extensions[contentType];
  if (!extension) throw new AppError(400, "Unsupported image type", "UNSUPPORTED_MEDIA_TYPE");
  if (sizeBytes > env.PET_PHOTO_MAX_BYTES) {
    throw new AppError(413, "Pet photo is too large", "PHOTO_TOO_LARGE");
  }
  const { bucket } = getStorage();
  if (!uploadClient) {
    throw new AppError(503, "Object storage is not configured", "STORAGE_NOT_CONFIGURED");
  }
  const photoKey = `${purpose}/${accountId}/${crypto.randomUUID()}.${extension}`;
  const uploadUrl = await getSignedUrl(
    uploadClient,
    new PutObjectCommand({ Bucket: bucket, Key: photoKey, ContentType: contentType, ContentLength: sizeBytes }),
    { expiresIn: 600 }
  );
  return { uploadUrl, photoKey, expiresIn: 600 };
}

export function createPetPhotoUpload(accountId: string, contentType: string, sizeBytes: number) {
  return createPhotoUpload(accountId, contentType, sizeBytes, "pets");
}

export function createSitterPhotoUpload(accountId: string, contentType: string, sizeBytes: number) {
  return createPhotoUpload(accountId, contentType, sizeBytes, "sitters");
}

export function assertOwnedPhotoKey(accountId: string, photoKey: string, purpose: "pets" | "sitters" = "pets") {
  if (!photoKey.startsWith(`${purpose}/${accountId}/`) || photoKey.includes("..")) {
    throw new AppError(403, "Photo does not belong to this account", "FORBIDDEN");
  }
}

export async function assertPhotoExists(accountId: string, photoKey: string, purpose: "pets" | "sitters" = "pets") {
  assertOwnedPhotoKey(accountId, photoKey, purpose);
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
  return getSignedUrl(uploadClient ?? s3, new GetObjectCommand({ Bucket: bucket, Key: photoKey }), { expiresIn: 3600 });
}

export async function deletePetPhoto(photoKey: string | null) {
  if (!photoKey || !storageConfigured) return;
  const { client: s3, bucket } = getStorage();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: photoKey }));
}

export async function createDocumentUpload(objectKey: string, sizeBytes: number) {
  getStorage();
  if (sizeBytes > env.DOCUMENT_MAX_BYTES) throw new AppError(413, "PDF is too large", "DOCUMENT_TOO_LARGE");
  const uploadUrl = await getSignedUrl(uploadClient!, new PutObjectCommand({
    Bucket: env.S3_DOCUMENT_BUCKET, Key: objectKey, ContentType: "application/pdf", ContentLength: sizeBytes
  }), { expiresIn: 600 });
  return { uploadUrl, expiresIn: 600 };
}

export async function assertDocumentUploaded(objectKey: string, sizeBytes: number) {
  const { client: s3 } = getStorage();
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: env.S3_DOCUMENT_BUCKET, Key: objectKey }));
    if (head.ContentLength !== sizeBytes || head.ContentType !== "application/pdf") throw new Error("Invalid PDF metadata");
    const object = await s3.send(new GetObjectCommand({ Bucket: env.S3_DOCUMENT_BUCKET, Key: objectKey, Range: "bytes=0-4" }));
    if (!object.Body || Buffer.from(await object.Body.transformToByteArray()).toString() !== "%PDF-") throw new Error("Invalid PDF signature");
  } catch {
    throw new AppError(400, "PDF upload is missing or invalid", "INVALID_DOCUMENT_UPLOAD");
  }
}

export async function getDocumentUrl(objectKey: string, expiresIn = 300) {
  getStorage();
  return getSignedUrl(uploadClient!, new GetObjectCommand({
    Bucket: env.S3_DOCUMENT_BUCKET, Key: objectKey,
    ResponseContentType: "application/pdf", ResponseContentDisposition: "attachment"
  }), { expiresIn });
}

export async function deleteDocumentObject(objectKey: string) {
  const { client: s3 } = getStorage();
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_DOCUMENT_BUCKET, Key: objectKey }));
}

export async function cleanupOrphanedObjects(now = new Date()) {
  if (!storageConfigured) return;
  const { client: s3, bucket } = getStorage();
  const cutoff = now.getTime() - 86_400_000;
  for (const [targetBucket, prefix] of [[bucket, "pets/"], [bucket, "sitters/"], [env.S3_DOCUMENT_BUCKET, "documents/"]] as const) {
    let token: string | undefined;
    do {
      const page = await s3.send(new ListObjectsV2Command({ Bucket: targetBucket, Prefix: prefix, ContinuationToken: token, MaxKeys: 100 }));
      for (const object of page.Contents ?? []) {
        if (!object.Key || !object.LastModified || object.LastModified.getTime() > cutoff) continue;
        const referenced = prefix === "documents/"
          ? await prisma.petDocument.count({ where: { objectKey: object.Key } })
          : prefix === "pets/" ? await prisma.pet.count({ where: { photoKey: object.Key } })
            : await prisma.sitterProfile.count({ where: { photoKey: object.Key } });
        if (!referenced) await s3.send(new DeleteObjectCommand({ Bucket: targetBucket, Key: object.Key }));
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }
}
