import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { Prisma } from "@prisma/client";

export async function requireVerifiedEmail(accountId: string) {
  const account = await prisma.account.findUnique({ where: { id: accountId }, select: { emailVerifiedAt: true } });
  if (!account?.emailVerifiedAt) throw new AppError(403, "Potwierdź adres e-mail przed korzystaniem z rezerwacji i oferowaniem opieki.", "EMAIL_NOT_VERIFIED");
}

// Pass the transaction that publishes a clinic service or accepts a visit.
export async function requireVerifiedClinic(accountId: string, client: Prisma.TransactionClient) {
  await client.$queryRaw`SELECT id FROM "Account" WHERE id = ${accountId} FOR SHARE`;
  const account = await client.account.findUnique({ where: { id: accountId }, include: { clinicProfile: true } });
  if (!account || account.role !== "CLINIC") throw new AppError(403, "Wymagane konto kliniki.", "FORBIDDEN");
  if (account.blockedAt || account.deactivatedAt) throw new AppError(403, "Konto kliniki jest nieaktywne.", "ACCOUNT_UNAVAILABLE");
  if (!account.emailVerifiedAt) throw new AppError(403, "Najpierw potwierdź adres e-mail kliniki.", "EMAIL_NOT_VERIFIED");
  if (account.clinicProfile?.verificationStatus !== "VERIFIED")
    throw new AppError(403, "Klinika wymaga zatwierdzenia przez administratora.", "CLINIC_NOT_VERIFIED");
  return account.clinicProfile;
}
