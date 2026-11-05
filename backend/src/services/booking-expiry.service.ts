import { prisma } from "../config/prisma";
import { Prisma } from "@prisma/client";

type ExpiryScope = { accountId?: string; conflict?: { sitterAccountId: string; petId: string; startsAt: Date; endsAt: Date } };

async function expireInTransaction(tx: Prisma.TransactionClient, now: Date, scope: ExpiryScope) {
  const expired = await tx.$queryRaw<{ id: string; ownerAccountId: string; sitterAccountId: string }[]>`
    WITH candidates AS (
      SELECT id FROM "Booking"
      WHERE status = 'REQUESTED' AND ("expiresAt" <= ${now} OR "startsAt" <= ${now})
      ${scope.accountId ? Prisma.sql`AND ("ownerAccountId" = ${scope.accountId} OR "sitterAccountId" = ${scope.accountId})` : Prisma.empty}
      ${scope.conflict ? Prisma.sql`AND ("sitterAccountId" = ${scope.conflict.sitterAccountId} OR "petId" = ${scope.conflict.petId})
        AND tsrange("startsAt", "endsAt", '[)') && tsrange(
          (${scope.conflict.startsAt}::timestamptz AT TIME ZONE 'UTC'),
          (${scope.conflict.endsAt}::timestamptz AT TIME ZONE 'UTC'), '[)')` : Prisma.empty}
      ORDER BY "expiresAt", id LIMIT 500 FOR UPDATE SKIP LOCKED
    )
    UPDATE "Booking" SET status = 'EXPIRED', "activeSlotKey" = NULL, "updatedAt" = ${now}
    WHERE id IN (SELECT id FROM candidates)
    RETURNING id, "ownerAccountId", "sitterAccountId"
  `;
  if (expired.length) await tx.notification.createMany({ data: expired.flatMap(booking =>
    [booking.ownerAccountId, booking.sitterAccountId].map(accountId => ({
      accountId, bookingId: booking.id, type: "BOOKING_EXPIRED" as const,
      title: "Prośba o rezerwację wygasła", message: "Termin został zwolniony, ponieważ prośba nie została zaakceptowana na czas."
    }))
  ) });
  return expired.length;
}

export async function expireBookingRequests(now = new Date(), scope: ExpiryScope = {}) {
  return prisma.$transaction(tx => expireInTransaction(tx, now, scope));
}

export function expireConflictingBookingRequests(tx: Prisma.TransactionClient, now: Date, conflict: NonNullable<ExpiryScope["conflict"]>) {
  return expireInTransaction(tx, now, { conflict });
}

export function activeBookingWhere(now = new Date()): Prisma.BookingWhereInput {
  return { OR: [
    { status: "ACCEPTED" },
    { status: "REQUESTED", startsAt: { gt: now }, expiresAt: { gt: now } }
  ] };
}
