import { AccountRole } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";
import { createOpaqueToken, hashToken } from "../utils/tokens";
import { requirePetOwner } from "./document.service";
import { getDocumentUrl, getPetPhotoUrl } from "./storage.service";

const shareSelect = { id: true, label: true, includeDocuments: true, createdAt: true, expiresAt: true, revokedAt: true } as const;
const unavailable = () => new AppError(404, "Ten link jest nieprawidłowy, wygasł lub został cofnięty.", "SHARE_UNAVAILABLE");

export async function createPetShare(accountId: string, role: AccountRole, petId: string,
  input: { label?: string; includeDocuments: boolean }) {
  await requirePetOwner(accountId, role, petId);
  const token = createOpaqueToken();
  const now = new Date();
  const share = await prisma.$transaction(async tx => {
    // Serialize the per-pet limit, including simultaneous clicks from two devices.
    const owned = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Pet" WHERE id = ${petId} AND "accountId" = ${accountId} FOR UPDATE`;
    if (!owned.length) throw new AppError(404, "Nie znaleziono pupila", "PET_NOT_FOUND");
    const count = await tx.petShareLink.count({ where: { petId, revokedAt: null, expiresAt: { gt: now } } });
    if (count >= 20) throw new AppError(409, "Możesz mieć do 20 aktywnych linków dla jednego pupila. Cofnij jeden z nich.", "SHARE_LIMIT_REACHED");
    return tx.petShareLink.create({ data: {
      petId, tokenHash: hashToken(token), label: input.label?.trim() || null,
      includeDocuments: input.includeDocuments, expiresAt: new Date(now.getTime() + 7 * 86_400_000)
    }, select: shareSelect });
  });
  return { share, url: `${env.APP_PUBLIC_URL.replace(/\/$/, "")}/shared-pet#token=${encodeURIComponent(token)}` };
}

export async function listPetShares(accountId: string, role: AccountRole, petId: string) {
  await requirePetOwner(accountId, role, petId);
  // Always expose every active link so older capabilities remain revocable.
  const active = await prisma.petShareLink.findMany({
    where: { petId, revokedAt: null, expiresAt: { gt: new Date() } }, select: shareSelect, orderBy: { createdAt: "desc" }, take: 20
  });
  const recent = await prisma.petShareLink.findMany({
    where: { petId, id: { notIn: active.map(link => link.id) } }, select: shareSelect, orderBy: { createdAt: "desc" }, take: 100 - active.length
  });
  return [...active, ...recent];
}

export async function revokePetShare(accountId: string, role: AccountRole, petId: string, shareId: string) {
  await requirePetOwner(accountId, role, petId);
  const result = await prisma.petShareLink.updateMany({ where: { id: shareId, petId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!result.count && !await prisma.petShareLink.findFirst({ where: { id: shareId, petId }, select: { id: true } }))
    throw new AppError(404, "Nie znaleziono udostępnienia", "SHARE_NOT_FOUND");
}

async function validShare(token: string | undefined) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw unavailable();
  const share = await prisma.petShareLink.findFirst({
    where: { tokenHash: hashToken(token), revokedAt: null, expiresAt: { gt: new Date() },
      pet: { account: { blockedAt: null, deactivatedAt: null } } },
    include: { pet: true }
  });
  if (!share) throw unavailable();
  return share;
}

export async function getSharedPetCard(token: string | undefined) {
  const share = await validShare(token);
  const pet = share.pet;
  const documents = share.includeDocuments ? await prisma.petDocument.findMany({
    where: { petId: pet.id, uploadedAt: { not: null } },
    select: { id: true, name: true, sizeBytes: true, expiresAt: true }, orderBy: { createdAt: "asc" }
  }) : [];
  return {
    pet: {
      name: pet.name, age: pet.age, breed: pet.breed, weight: pet.weight, gender: pet.gender,
      photoUrl: pet.photoKey ? await getPetPhotoUrl(pet.photoKey) : pet.photoUrl,
      illnesses: pet.illnesses, allergies: pet.allergies, vaccines: pet.vaccines, vet: pet.vet, notes: pet.notes
    },
    documents, includeDocuments: share.includeDocuments, expiresAt: share.expiresAt
  };
}

export async function downloadSharedPetDocument(token: string | undefined, documentId: string) {
  const share = await validShare(token);
  if (!share.includeDocuments) throw unavailable();
  const document = await prisma.petDocument.findFirst({ where: { id: documentId, petId: share.petId, uploadedAt: { not: null } }, select: { objectKey: true } });
  if (!document) throw unavailable();
  // A URL never outlives the share itself. Revocation stops issuing further URLs.
  const expiresIn = Math.min(60, Math.floor((share.expiresAt.getTime() - Date.now()) / 1000));
  if (expiresIn < 1) throw unavailable();
  return { url: await getDocumentUrl(document.objectKey, expiresIn), expiresIn };
}
