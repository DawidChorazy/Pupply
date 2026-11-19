import { AccountRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { requireVerifiedEmail } from "./account-access.service";
import { createBookingIssueSchema, listBookingIssuesSchema, reviewBookingIssueSchema } from "../validation/booking-issue.schemas";

const privateIssue = { id: true, bookingId: true, category: true, description: true, status: true,
  version: true, resolution: true, createdAt: true, updatedAt: true } as const;

export async function getBookingIssue(accountId: string, role: AccountRole, bookingId: string) {
  if (role !== "USER" || !await prisma.booking.findFirst({ where: { id: bookingId, ownerAccountId: accountId } }))
    throw new AppError(404, "Nie znaleziono rezerwacji.", "BOOKING_NOT_FOUND");
  return prisma.bookingIssue.findUnique({ where: { bookingId }, select: privateIssue });
}

export async function createBookingIssue(accountId: string, role: AccountRole, bookingId: string, raw: z.infer<typeof createBookingIssueSchema>) {
  if (role !== "USER") throw new AppError(403, "Zgłoszenie może wysłać właściciel zwierzęcia.", "FORBIDDEN");
  await requireVerifiedEmail(accountId);
  const input = createBookingIssueSchema.parse(raw);
  return prisma.$transaction(async tx => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Booking" WHERE id = ${bookingId} AND "ownerAccountId" = ${accountId} FOR UPDATE`;
    if (!locked.length) throw new AppError(404, "Nie znaleziono rezerwacji.", "BOOKING_NOT_FOUND");
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { issue: true } });
    if (booking.issue) {
      if (booking.issue.category === input.category && booking.issue.description === input.description)
        return tx.bookingIssue.findUniqueOrThrow({ where: { bookingId }, select: privateIssue });
      throw new AppError(409, "Ta rezerwacja ma już zgłoszenie. Sprawdź jego status.", "ISSUE_ALREADY_EXISTS");
    }
    if (!["COMPLETED", "CANCELLED"].includes(booking.status) && !(booking.status === "ACCEPTED" && booking.startsAt <= new Date()))
      throw new AppError(409, "Problem można zgłosić od terminu rozpoczęcia lub po anulowaniu usługi.", "ISSUE_NOT_AVAILABLE");
    const issue = await tx.bookingIssue.create({ data: { bookingId, reporterAccountId: accountId, ...input }, select: privateIssue });
    await tx.auditLog.create({ data: { actorAccountId: accountId, targetAccountId: accountId, action: "BOOKING_ISSUE_CREATED", reason: JSON.stringify({ issueId: issue.id, bookingId, category: input.category }) } });
    return issue;
  });
}

export async function listBookingIssues(input: z.infer<typeof listBookingIssuesSchema>) {
  const where = { status: input.status };
  const [items, total] = await prisma.$transaction([
    prisma.bookingIssue.findMany({ where, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: (input.page - 1) * 20, take: 20,
      select: { ...privateIssue, booking: { select: { startsAt: true, status: true, owner: { select: { email: true } }, sitter: { select: { email: true } } } } } }),
    prisma.bookingIssue.count({ where })
  ]);
  return { items, pagination: { page: input.page, pageSize: 20, total } };
}

export async function reviewBookingIssue(adminId: string, issueId: string, raw: z.infer<typeof reviewBookingIssueSchema>) {
  const input = reviewBookingIssueSchema.parse(raw);
  return prisma.$transaction(async tx => {
    // Also check role inside the transaction: service calls cannot bypass authorization.
    await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${adminId} FOR SHARE`;
    const admin = await tx.account.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== "ADMIN" || admin.blockedAt || admin.deactivatedAt) throw new AppError(403, "Wymagane konto administratora.", "FORBIDDEN");
    const changed = await tx.bookingIssue.updateMany({ where: { id: issueId, version: input.version, status: { in: ["OPEN", "IN_REVIEW"] } },
      data: { status: input.status, resolution: input.resolution, reviewedBy: adminId, version: { increment: 1 } } });
    if (!changed.count) throw new AppError(409, "Zgłoszenie zmieniło się albo zostało już zamknięte. Odśwież listę.", "ISSUE_CONFLICT");
    const issue = await tx.bookingIssue.findUniqueOrThrow({ where: { id: issueId } });
    await tx.auditLog.create({ data: { actorAccountId: adminId, targetAccountId: issue.reporterAccountId, action: "BOOKING_ISSUE_REVIEWED", reason: JSON.stringify({ issueId, status: input.status, version: issue.version }) } });
    await tx.notification.create({ data: { accountId: issue.reporterAccountId, bookingId: issue.bookingId, type: "ISSUE_UPDATED", title: "Aktualizacja zgłoszenia", message: input.resolution } });
    return tx.bookingIssue.findUniqueOrThrow({ where: { id: issueId }, select: privateIssue });
  });
}
