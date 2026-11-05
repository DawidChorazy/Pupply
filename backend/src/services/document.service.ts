import crypto from "node:crypto";
import { AccountRole } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { assertDocumentUploaded, createDocumentUpload, deleteDocumentObject, getDocumentUrl } from "./storage.service";

export async function requirePetOwner(accountId: string, role: AccountRole, petId: string) {
  if (role !== "USER") throw new AppError(403, "Only users can manage pet documents", "FORBIDDEN");
  if (!await prisma.pet.findFirst({ where: { id: petId, accountId } })) throw new AppError(404, "Pet not found", "PET_NOT_FOUND");
}

export async function listDocuments(accountId: string, role: AccountRole, petId: string) {
  await requirePetOwner(accountId, role, petId);
  return prisma.petDocument.findMany({ where: { petId, uploadedAt: { not: null } }, orderBy: { createdAt: "asc" } });
}

export async function prepareDocument(accountId: string, role: AccountRole, petId: string, input: { name: string; sizeBytes: number }) {
  await requirePetOwner(accountId, role, petId);
  const objectKey = `documents/${accountId}/${crypto.randomUUID()}.pdf`;
  const upload = await createDocumentUpload(objectKey, input.sizeBytes);
  const document = await prisma.petDocument.create({ data: { petId, objectKey, ...input } });
  return { document, ...upload };
}

export async function findDocument(accountId: string, role: AccountRole, petId: string, documentId: string) {
  await requirePetOwner(accountId, role, petId);
  const document = await prisma.petDocument.findFirst({ where: { id: documentId, petId } });
  if (!document) throw new AppError(404, "Document not found", "DOCUMENT_NOT_FOUND");
  return document;
}

export async function saveDocument(accountId: string, role: AccountRole, petId: string, documentId: string,
  input: { expiresAt?: Date | null; reminderDaysBefore?: number }) {
  const document = await findDocument(accountId, role, petId, documentId);
  if (!document.uploadedAt) await assertDocumentUploaded(document.objectKey, document.sizeBytes);
  const changed = (input.expiresAt !== undefined && input.expiresAt?.getTime() !== document.expiresAt?.getTime()) ||
    (input.reminderDaysBefore !== undefined && input.reminderDaysBefore !== document.reminderDaysBefore);
  return prisma.petDocument.update({ where: { id: document.id }, data: {
    ...input, uploadedAt: document.uploadedAt ?? new Date(), ...(changed ? { reminderSentAt: null } : {})
  } });
}

export async function downloadDocument(accountId: string, role: AccountRole, petId: string, documentId: string) {
  const document = await findDocument(accountId, role, petId, documentId);
  if (!document.uploadedAt) throw new AppError(404, "Document upload is not complete", "DOCUMENT_NOT_FOUND");
  return { url: await getDocumentUrl(document.objectKey), expiresIn: 300 };
}

export async function removeDocument(accountId: string, role: AccountRole, petId: string, documentId: string) {
  const document = await findDocument(accountId, role, petId, documentId);
  // Keep the row when storage is unavailable, allowing the operation to be retried.
  await deleteDocumentObject(document.objectKey);
  await prisma.petDocument.deleteMany({ where: { id: document.id, petId } });
}
