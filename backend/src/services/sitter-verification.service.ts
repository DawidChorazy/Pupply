import { randomUUID } from "node:crypto";
import { AccountRole, Prisma, SitterProfile } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { createVerificationUpload, sealVerificationUpload, getVerificationImageUrl, deleteDocumentObject } from "./storage.service";
import { listSitterVerificationsSchema, reviewSitterVerificationSchema, submitSitterVerificationSchema, verificationFileSchema } from "../validation/sitter-verification.schemas";

const missing = () => new AppError(404, "Nie znaleziono pliku weryfikacji.", "VERIFICATION_FILE_NOT_FOUND");
const fileSelect = { id: true, purpose: true, uploadedAt: true, expiresAt: true, verificationVersion: true };
const adminAccount = { select: { role: true, email: true, emailVerifiedAt: true, blockedAt: true, deactivatedAt: true,
  userProfile: { select: { fullName: true } } } };
function requireUser(role: AccountRole) {
  if (role !== "USER") throw new AppError(403, "Weryfikacja jest dostępna dla opiekunów.", "FORBIDDEN");
}
async function lockedProfile(tx: Prisma.TransactionClient, accountId: string) {
  await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${accountId} FOR UPDATE`;
  const profile = await tx.sitterProfile.findUnique({ where: { accountId }, include: { account: adminAccount } });
  if (!profile) throw new AppError(404, "Najpierw zapisz profil opiekuna.", "SITTER_NOT_FOUND");
  return profile;
}
function eligible(profile: Awaited<ReturnType<typeof lockedProfile>>) {
  if (profile.account.role !== "USER" || profile.account.blockedAt || profile.account.deactivatedAt) throw new AppError(403, "Konto jest nieaktywne.", "ACCOUNT_UNAVAILABLE");
  if (!profile.account.emailVerifiedAt) throw new AppError(403, "Najpierw potwierdź adres e-mail.", "EMAIL_NOT_VERIFIED");
}
function editable(profile: SitterProfile) {
  if (!["UNVERIFIED", "REJECTED"].includes(profile.verificationStatus))
    throw new AppError(409, "Zgłoszenie już oczekuje na decyzję albo zostało zatwierdzone.", "SITTER_VERIFICATION_STATE");
}
function requireVersion(profile: SitterProfile, version: number) {
  if (profile.verificationVersion !== version) throw new AppError(409, "Status weryfikacji zmienił się. Odśwież dane.", "SITTER_VERIFICATION_CONFLICT");
}
export function sitterVerificationSummary(profile: SitterProfile, active = true) {
  return { status: profile.verificationStatus, version: profile.verificationVersion,
    submittedAt: profile.verificationSubmittedAt, reviewedAt: profile.verificationReviewedAt,
    reason: profile.verificationReason, canAcceptBookings: active && profile.verificationStatus === "VERIFIED" };
}
export async function getOwnSitterVerification(accountId: string, role: AccountRole) {
  requireUser(role);
  const profile = await prisma.sitterProfile.findUnique({ where: { accountId }, include: {
    account: adminAccount, verificationFiles: { where: { expiresAt: { gt: new Date() } }, select: fileSelect, orderBy: { createdAt: "desc" }, take: 12 }
  } });
  if (!profile) throw new AppError(404, "Najpierw zapisz profil opiekuna.", "SITTER_NOT_FOUND");
  return { verification: sitterVerificationSummary(profile, !!profile.account.emailVerifiedAt && !profile.account.blockedAt && !profile.account.deactivatedAt),
    fullName: profile.account.userProfile?.fullName ?? "", files: profile.verificationFiles };
}
export async function createSitterVerificationFile(accountId: string, role: AccountRole, input: z.infer<typeof verificationFileSchema>) {
  requireUser(role);
  return prisma.$transaction(async tx => {
    const profile = await lockedProfile(tx, accountId); eligible(profile); editable(profile);
    if (await tx.sitterVerificationFile.count({ where: { profileId: profile.id, expiresAt: { gt: new Date() } } }) >= 12)
      throw new AppError(409, "Osiągnięto limit plików. Usuń niewykorzystane zdjęcia przed kolejną próbą.", "VERIFICATION_FILE_LIMIT");
    const id = randomUUID();
    const file = await tx.sitterVerificationFile.create({ data: { id, profileId: profile.id, ...input,
      stagingKey: `sitter-verification/staging/${accountId}/${id}`, objectKey: `sitter-verification/sealed/${accountId}/${randomUUID()}`,
      expiresAt: new Date(Date.now() + 86_400_000) } });
    return { fileId: id, uploadUrl: await createVerificationUpload(file.stagingKey, file.contentType, file.sizeBytes), expiresIn: 600 };
  });
}
export async function completeSitterVerificationFile(accountId: string, role: AccountRole, fileId: string) {
  requireUser(role);
  return prisma.$transaction(async tx => {
    const profile = await lockedProfile(tx, accountId); eligible(profile);
    const file = await tx.sitterVerificationFile.findFirst({ where: { id: fileId, profileId: profile.id, expiresAt: { gt: new Date() } } });
    if (!file) throw missing();
    if (file.uploadedAt) return { id: file.id, purpose: file.purpose, uploadedAt: file.uploadedAt };
    editable(profile);
    await sealVerificationUpload(file);
    return tx.sitterVerificationFile.update({ where: { id: file.id }, data: { uploadedAt: new Date() }, select: fileSelect });
  }, { timeout: 20_000 });
}
export async function deleteSitterVerificationFile(accountId: string, role: AccountRole, fileId: string) {
  requireUser(role);
  await prisma.$transaction(async tx => {
    const profile = await lockedProfile(tx, accountId); editable(profile);
    const file = await tx.sitterVerificationFile.findFirst({ where: { id: fileId, profileId: profile.id, verificationVersion: null } });
    if (!file) throw missing();
    await tx.sitterVerificationFile.update({ where: { id: fileId }, data: { expiresAt: new Date() } });
  });
}
export async function submitSitterVerification(accountId: string, role: AccountRole, input: z.infer<typeof submitSitterVerificationSchema>) {
  requireUser(role);
  return prisma.$transaction(async tx => {
    const profile = await lockedProfile(tx, accountId); eligible(profile); requireVersion(profile, input.expectedVersion); editable(profile);
    const files = await tx.sitterVerificationFile.findMany({ where: { profileId: profile.id, id: { in: [input.documentFileId, input.faceFileId] },
      uploadedAt: { not: null }, verificationVersion: null, expiresAt: { gt: new Date() } } });
    if (files.length !== 2 || !files.some(f => f.id === input.documentFileId && f.purpose === "IDENTITY_DOCUMENT")
      || !files.some(f => f.id === input.faceFileId && f.purpose === "FACE_PHOTO"))
      throw new AppError(400, "Prześlij i zapisz zdjęcie dokumentu oraz osobne zdjęcie twarzy.", "VERIFICATION_FILES_REQUIRED");
    const fullName = profile.account.userProfile?.fullName?.trim();
    if (!fullName) throw new AppError(400, "Uzupełnij imię i nazwisko w profilu konta.", "IDENTITY_NAME_REQUIRED");
    const updated = await tx.sitterProfile.update({ where: { id: profile.id }, data: { verificationStatus: "PENDING",
      verificationVersion: { increment: 1 }, verificationSubmittedAt: new Date(), verificationReviewedAt: null,
      verificationReviewedBy: null, verificationReason: null, verificationFullName: fullName } });
    await tx.sitterVerificationFile.updateMany({ where: { id: { in: files.map(f => f.id) } }, data: {
      verificationVersion: updated.verificationVersion, expiresAt: new Date(Date.now() + 30 * 86_400_000) } });
    await tx.auditLog.create({ data: { actorAccountId: accountId, targetAccountId: accountId,
      action: "SITTER_VERIFICATION_SUBMITTED", reason: JSON.stringify({ version: updated.verificationVersion }) } });
    return sitterVerificationSummary(updated);
  });
}
export async function listSitterVerifications(input: z.infer<typeof listSitterVerificationsSchema>) {
  const where = { verificationStatus: input.status };
  const [items, total] = await prisma.$transaction([
    prisma.sitterProfile.findMany({ where, select: { accountId: true, verificationStatus: true, verificationVersion: true,
      verificationFullName: true, verificationSubmittedAt: true, verificationReason: true, account: adminAccount },
      orderBy: [{ verificationSubmittedAt: "asc" }, { id: "asc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    prisma.sitterProfile.count({ where })
  ]);
  return { items, pagination: { page: input.page, pageSize: input.pageSize, total } };
}
export async function getSitterVerificationForAdmin(accountId: string) {
  const profile = await prisma.sitterProfile.findUnique({ where: { accountId }, include: { account: adminAccount } });
  if (!profile) throw new AppError(404, "Nie znaleziono opiekuna.", "SITTER_NOT_FOUND");
  const files = profile.verificationStatus === "PENDING" ? await prisma.sitterVerificationFile.findMany({ where: {
    profileId: profile.id, verificationVersion: profile.verificationVersion, expiresAt: { gt: new Date() } }, select: fileSelect }) : [];
  return { accountId, account: profile.account, fullName: profile.verificationFullName, verification: sitterVerificationSummary(profile), files };
}
export async function readSitterVerificationFile(actorId: string, role: AccountRole, accountId: string, fileId: string) {
  if (actorId !== accountId && role !== "ADMIN") throw missing();
  const file = await prisma.sitterVerificationFile.findFirst({ where: { id: fileId, expiresAt: { gt: new Date() }, uploadedAt: { not: null }, profile: { accountId } }, include: { profile: true } });
  if (!file || (role === "ADMIN" && (file.profile.verificationStatus !== "PENDING" || file.verificationVersion !== file.profile.verificationVersion))) throw missing();
  const url = await getVerificationImageUrl(file);
  await prisma.auditLog.create({ data: { actorAccountId: actorId, targetAccountId: accountId, action: "SITTER_VERIFICATION_FILE_READ",
    reason: JSON.stringify({ fileId, version: file.verificationVersion, purpose: file.purpose }) } });
  return { url, expiresIn: 60 };
}
export async function reviewSitterVerification(actorId: string, accountId: string, input: z.infer<typeof reviewSitterVerificationSchema>) {
  if (actorId === accountId) throw new AppError(403, "Nie możesz zatwierdzić własnej tożsamości.", "FORBIDDEN");
  return prisma.$transaction(async tx => {
    const profile = await lockedProfile(tx, accountId); requireVersion(profile, input.expectedVersion);
    if (profile.verificationStatus !== "PENDING") throw new AppError(409, "Opiekun nie oczekuje na weryfikację.", "SITTER_VERIFICATION_STATE");
    if (input.decision === "APPROVE") {
      eligible(profile);
      if (profile.verificationFullName !== profile.account.userProfile?.fullName) throw new AppError(409, "Dane konta zmieniły się. Potrzebne jest nowe zgłoszenie.", "SITTER_VERIFICATION_CONFLICT");
      const count = await tx.sitterVerificationFile.count({ where: { profileId: profile.id, verificationVersion: profile.verificationVersion,
        uploadedAt: { not: null }, expiresAt: { gt: new Date() } } });
      if (count !== 2) throw new AppError(409, "Zdjęcia weryfikacyjne wygasły. Potrzebne jest nowe zgłoszenie.", "VERIFICATION_FILES_REQUIRED");
    }
    const updated = await tx.sitterProfile.update({ where: { id: profile.id }, data: { verificationStatus: input.decision === "APPROVE" ? "VERIFIED" : "REJECTED",
      verificationVersion: { increment: 1 }, verificationReviewedAt: new Date(), verificationReviewedBy: actorId, verificationReason: input.reason } });
    await tx.sitterVerificationFile.updateMany({ where: { profileId: profile.id, verificationVersion: profile.verificationVersion }, data: { expiresAt: new Date() } });
    await tx.auditLog.create({ data: { actorAccountId: actorId, targetAccountId: accountId, action: `SITTER_VERIFICATION_${updated.verificationStatus}`,
      reason: JSON.stringify({ ...input, fullName: profile.verificationFullName }) } });
    return sitterVerificationSummary(updated);
  });
}
export async function invalidateSitterVerification(tx: Prisma.TransactionClient, accountId: string, reason: string, actorId = accountId) {
  const profile = await tx.sitterProfile.findUnique({ where: { accountId } });
  if (!profile || profile.verificationStatus === "UNVERIFIED") return;
  await tx.sitterProfile.update({ where: { id: profile.id }, data: { verificationStatus: "UNVERIFIED", verificationVersion: { increment: 1 },
    verificationSubmittedAt: null, verificationReviewedAt: null, verificationReviewedBy: null, verificationFullName: null, verificationReason: reason } });
  await tx.sitterVerificationFile.updateMany({ where: { profileId: profile.id, verificationVersion: profile.verificationVersion }, data: { expiresAt: new Date() } });
  await tx.auditLog.create({ data: { actorAccountId: actorId, targetAccountId: accountId, action: "SITTER_VERIFICATION_INVALIDATED", reason } });
}
export async function cleanupExpiredVerificationFiles(now = new Date()) {
  const files = await prisma.sitterVerificationFile.findMany({ where: { expiresAt: { lte: now } }, take: 100 });
  for (const file of files) {
    await prisma.$transaction(async tx => {
      const parent = await tx.sitterProfile.findUnique({ where: { id: file.profileId }, select: { accountId: true } });
      if (!parent) return;
      const profile = await lockedProfile(tx, parent.accountId);
      const current = await tx.sitterVerificationFile.findUnique({ where: { id: file.id } });
      if (!current || current.expiresAt > now) return;
      if (profile.verificationStatus === "PENDING" && profile.verificationVersion === current.verificationVersion)
        await invalidateSitterVerification(tx, profile.accountId, "Zgłoszenie wygasło po 30 dniach. Prześlij zdjęcia ponownie.", "system:maintenance");
      await deleteDocumentObject(current.stagingKey); await deleteDocumentObject(current.objectKey);
      await tx.sitterVerificationFile.delete({ where: { id: current.id } });
    }, { timeout: 20_000 });
  }
}
