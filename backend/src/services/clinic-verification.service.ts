import { AccountRole, ClinicProfile, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { isValidNip } from "../utils/nip";
import { listClinicVerificationsSchema, reviewClinicVerificationSchema } from "../validation/clinic.schemas";
import { updateClinicProfileSchema } from "../validation/profile.schemas";

export const resetClinicVerification = {
  verificationStatus: "UNVERIFIED" as const,
  verificationVersion: { increment: 1 },
  verificationSubmittedAt: null,
  verificationReviewedAt: null,
  verificationReviewedBy: null,
  verificationReason: null,
  verificationEvidenceUrl: null
};

export function clinicVerificationSummary(profile: ClinicProfile, eligibleAccount: boolean) {
  const verified = eligibleAccount && profile.verificationStatus === "VERIFIED";
  return {
    status: profile.verificationStatus,
    version: profile.verificationVersion,
    submittedAt: profile.verificationSubmittedAt,
    reviewedAt: profile.verificationReviewedAt,
    reason: profile.verificationReason,
    canPublishServices: verified,
    canAcceptBookings: verified
  };
}

function requireClinicRole(role: AccountRole) {
  if (role !== "CLINIC") throw new AppError(403, "Ta operacja jest dostępna wyłącznie dla klinik.", "FORBIDDEN");
}

// Serialize profile edits, submissions, reviews and account state/email changes
// on the same account row. A review can never approve a stale profile snapshot.
async function lockedClinic(tx: Prisma.TransactionClient, accountId: string) {
  await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${accountId} FOR UPDATE`;
  const account = await tx.account.findUnique({ where: { id: accountId }, include: { clinicProfile: true } });
  if (!account || account.role !== "CLINIC" || !account.clinicProfile)
    throw new AppError(404, "Nie znaleziono kliniki.", "CLINIC_NOT_FOUND");
  return { account, profile: account.clinicProfile };
}

function requireActiveAccount(account: { emailVerifiedAt: Date | null; blockedAt: Date | null; deactivatedAt: Date | null }) {
  if (account.blockedAt || account.deactivatedAt)
    throw new AppError(409, "Konto kliniki jest nieaktywne.", "ACCOUNT_UNAVAILABLE");
  if (!account.emailVerifiedAt)
    throw new AppError(403, "Najpierw potwierdź adres e-mail kliniki.", "EMAIL_NOT_VERIFIED");
}

function requireCompleteProfile(profile: ClinicProfile) {
  if (!isValidNip(profile.nip) || !profile.address || !profile.registrationNumber)
    throw new AppError(400, "Uzupełnij poprawny NIP, adres placówki i numer wpisu do ewidencji zakładów leczniczych dla zwierząt.", "CLINIC_DETAILS_REQUIRED");
}

function requireVersion(profile: ClinicProfile, expectedVersion: number) {
  if (profile.verificationVersion !== expectedVersion)
    throw new AppError(409, "Dane lub status kliniki zmieniły się. Pobierz aktualne dane i spróbuj ponownie.", "CLINIC_VERIFICATION_CONFLICT");
}

export async function updateClinicDetails(accountId: string, role: AccountRole, input: z.infer<typeof updateClinicProfileSchema>) {
  requireClinicRole(role);
  return prisma.$transaction(async tx => {
    const { profile } = await lockedClinic(tx, accountId);
    if (!Object.entries(input).some(([key, value]) => value !== undefined && value !== profile[key as keyof ClinicProfile])) return;
    await tx.clinicProfile.update({ where: { accountId }, data: { ...input, ...resetClinicVerification } });
    if (profile.verificationStatus !== "UNVERIFIED") await tx.auditLog.create({ data: {
      actorAccountId: accountId, targetAccountId: accountId, action: "CLINIC_VERIFICATION_INVALIDATED",
      reason: "Zmiana danych profilu kliniki wymaga ponownej weryfikacji."
    } });
  });
}

export async function submitClinicVerification(accountId: string, role: AccountRole, expectedVersion: number) {
  requireClinicRole(role);
  return prisma.$transaction(async tx => {
    const { account, profile } = await lockedClinic(tx, accountId);
    requireActiveAccount(account);
    requireVersion(profile, expectedVersion);
    requireCompleteProfile(profile);
    if (!["UNVERIFIED", "REJECTED"].includes(profile.verificationStatus))
      throw new AppError(409, "Klinika została już zgłoszona lub zatwierdzona.", "CLINIC_VERIFICATION_STATE");
    const updated = await tx.clinicProfile.update({ where: { accountId }, data: {
      ...resetClinicVerification, verificationStatus: "PENDING", verificationSubmittedAt: new Date()
    } });
    await tx.auditLog.create({ data: { actorAccountId: accountId, targetAccountId: accountId,
      action: "CLINIC_VERIFICATION_SUBMITTED", reason: JSON.stringify({
        version: updated.verificationVersion, clinicName: updated.clinicName, nip: updated.nip,
        address: updated.address, registrationNumber: updated.registrationNumber, email: account.email, phone: updated.phone
      })
    } });
    return clinicVerificationSummary(updated, true);
  });
}

const adminInclude = { account: { select: { email: true, emailVerifiedAt: true, blockedAt: true, deactivatedAt: true } } };

export async function listClinicVerifications(input: z.infer<typeof listClinicVerificationsSchema>) {
  const where = { verificationStatus: input.status };
  const [items, total] = await prisma.$transaction([
    prisma.clinicProfile.findMany({ where, include: adminInclude,
      orderBy: [{ verificationSubmittedAt: "asc" }, { id: "asc" }],
      skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    prisma.clinicProfile.count({ where })
  ]);
  return { items, pagination: { page: input.page, pageSize: input.pageSize, total } };
}

export async function getClinicVerificationForAdmin(accountId: string) {
  const profile = await prisma.clinicProfile.findUnique({ where: { accountId }, include: adminInclude });
  if (!profile) throw new AppError(404, "Nie znaleziono kliniki.", "CLINIC_NOT_FOUND");
  return profile;
}

export async function reviewClinicVerification(actorAccountId: string, accountId: string, input: z.infer<typeof reviewClinicVerificationSchema>) {
  if (actorAccountId === accountId) throw new AppError(403, "Nie można zatwierdzać własnej placówki.", "FORBIDDEN");
  return prisma.$transaction(async tx => {
    const { account, profile } = await lockedClinic(tx, accountId);
    requireVersion(profile, input.expectedVersion);
    if (profile.verificationStatus !== "PENDING")
      throw new AppError(409, "Klinika nie oczekuje na weryfikację.", "CLINIC_VERIFICATION_STATE");
    if (input.decision === "APPROVE") { requireActiveAccount(account); requireCompleteProfile(profile); }
    const status = input.decision === "APPROVE" ? "VERIFIED" : "REJECTED";
    const updated = await tx.clinicProfile.update({ where: { accountId }, data: {
      verificationStatus: status, verificationVersion: { increment: 1 },
      verificationReviewedAt: new Date(), verificationReviewedBy: actorAccountId,
      verificationReason: input.reason,
      verificationEvidenceUrl: input.decision === "APPROVE" ? input.evidenceUrl : null
    } });
    await tx.auditLog.create({ data: { actorAccountId, targetAccountId: accountId,
      action: `CLINIC_VERIFICATION_${status}`, reason: JSON.stringify({
        ...input, clinicName: profile.clinicName, nip: profile.nip,
        address: profile.address, registrationNumber: profile.registrationNumber, email: account.email, phone: profile.phone
      })
    } });
    return clinicVerificationSummary(updated, Boolean(account.emailVerifiedAt && !account.blockedAt && !account.deactivatedAt));
  });
}
