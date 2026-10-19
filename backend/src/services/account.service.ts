import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";
import { createOpaqueToken, hashToken } from "../utils/tokens";
import { hashPassword, verifyPassword } from "../utils/password";
import { assertMailAvailable, sendMail } from "./mail.service";

export async function changePassword(accountId: string, currentPassword: string, password: string) {
  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
  if (!account.passwordHash || !await verifyPassword(currentPassword, account.passwordHash))
    throw new AppError(401, "Obecne hasło jest nieprawidłowe", "INVALID_CREDENTIALS");
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async tx => {
    const changed = await tx.account.updateMany({ where: { id: accountId, passwordHash: account.passwordHash }, data: { passwordHash, authVersion: { increment: 1 } } });
    if (!changed.count) throw new AppError(409, "Dane konta zostały zmienione. Spróbuj ponownie.", "ACCOUNT_CONFLICT");
    await tx.refreshToken.updateMany({ where: { accountId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({ data: { actorAccountId: accountId, targetAccountId: accountId, action: "PASSWORD_CHANGED" } });
  });
}

export async function requestEmailChange(accountId: string, email: string, password: string) {
  assertMailAvailable();
  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
  if (!account.passwordHash || !await verifyPassword(password, account.passwordHash)) throw new AppError(401, "Potwierdź zmianę obecnym hasłem", "INVALID_CREDENTIALS");
  if (await prisma.account.findUnique({ where: { email } })) throw new AppError(409, "Adres e-mail jest już używany", "EMAIL_TAKEN");
  const token = createOpaqueToken();
  await prisma.$transaction([
    prisma.accountActionToken.updateMany({ where: { accountId, type: "EMAIL_CHANGE", usedAt: null }, data: { usedAt: new Date() } }),
    prisma.accountActionToken.create({ data: { accountId, type: "EMAIL_CHANGE", tokenHash: hashToken(token), pendingEmail: email, expiresAt: new Date(Date.now() + env.ACTION_TOKEN_TTL_MINUTES * 60_000) } })
  ]);
  const link = `${env.APP_PUBLIC_URL.replace(/\/$/, "")}/verify-email?kind=email-change&token=${encodeURIComponent(token)}`;
  const delivered = await sendMail(email, "Potwierdź nowy adres e-mail Pupply", `Potwierdź zmianę adresu: ${link}`);
  return env.NODE_ENV === "production" ? {} : { debugToken: token, delivered };
}

export async function confirmEmailChange(token: string) {
  await prisma.$transaction(async tx => {
    const record = await tx.accountActionToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!record || record.type !== "EMAIL_CHANGE" || !record.pendingEmail || record.usedAt || record.expiresAt <= new Date())
      throw new AppError(400, "Link zmiany adresu jest nieprawidłowy lub wygasł", "INVALID_ACTION_TOKEN");
    const claimed = await tx.accountActionToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (!claimed.count) throw new AppError(400, "Link został już użyty", "INVALID_ACTION_TOKEN");
    await tx.account.update({ where: { id: record.accountId }, data: { email: record.pendingEmail, emailVerifiedAt: new Date(), authVersion: { increment: 1 }, googleId: null } });
    await tx.refreshToken.updateMany({ where: { accountId: record.accountId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.accountActionToken.updateMany({ where: { accountId: record.accountId, usedAt: null }, data: { usedAt: new Date() } });
    await tx.auditLog.create({ data: { actorAccountId: record.accountId, targetAccountId: record.accountId, action: "EMAIL_CHANGED" } });
  });
}

async function cancelActiveBookings(tx: Prisma.TransactionClient, accountId: string) {
  const bookings = await tx.$queryRaw<{ id: string; ownerAccountId: string; sitterAccountId: string }[]>`
    UPDATE "Booking" SET status = 'CANCELLED', "activeSlotKey" = NULL, "updatedAt" = NOW()
    WHERE ("ownerAccountId" = ${accountId} OR "sitterAccountId" = ${accountId}) AND status IN ('REQUESTED', 'ACCEPTED')
    RETURNING id, "ownerAccountId", "sitterAccountId"`;
  if (bookings.length) await tx.notification.createMany({ data: bookings.map(booking => ({
    accountId: booking.ownerAccountId === accountId ? booking.sitterAccountId : booking.ownerAccountId,
    bookingId: booking.id, type: "BOOKING_CANCELLED" as const, title: "Rezerwacja anulowana", message: "Rezerwacja została anulowana z powodu dezaktywacji konta uczestnika."
  })) });
}

export async function setAccountState(actorAccountId: string, targetAccountId: string, action: "DEACTIVATE" | "BLOCK" | "RESTORE", reason?: string) {
  await prisma.$transaction(async tx => {
    const target = await tx.account.findUnique({ where: { id: targetAccountId } });
    if (!target) throw new AppError(404, "Nie znaleziono konta", "ACCOUNT_NOT_FOUND");
    if (target.role === "ADMIN") throw new AppError(403, "Konto administratora wymaga obsługi poza publicznym API", "FORBIDDEN");
    await tx.account.update({ where: { id: targetAccountId }, data: {
      authVersion: { increment: 1 },
      ...(action === "DEACTIVATE" ? { deactivatedAt: new Date() } : action === "BLOCK" ? { blockedAt: new Date() } : { blockedAt: null, deactivatedAt: null })
    } });
    await tx.refreshToken.updateMany({ where: { accountId: targetAccountId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.accountActionToken.updateMany({ where: { accountId: targetAccountId, usedAt: null }, data: { usedAt: new Date() } });
    if (action !== "RESTORE") {
      await tx.sitterProfile.updateMany({ where: { accountId: targetAccountId }, data: { isActive: false } });
      await tx.pushDevice.deleteMany({ where: { accountId: targetAccountId } });
      await cancelActiveBookings(tx, targetAccountId);
    }
    await tx.auditLog.create({ data: { actorAccountId, targetAccountId, action, reason } });
  });
}
