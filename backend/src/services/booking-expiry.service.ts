import { prisma } from "../config/prisma";

export async function expireBookingRequests(now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const expired = await tx.$queryRaw<{ id: string; ownerAccountId: string; sitterAccountId: string }[]>`
      UPDATE "Booking" SET status = 'EXPIRED', "activeSlotKey" = NULL, "updatedAt" = ${now}
      WHERE status = 'REQUESTED' AND ("expiresAt" <= ${now} OR "startsAt" <= ${now})
      RETURNING id, "ownerAccountId", "sitterAccountId"
    `;
    if (expired.length) await tx.notification.createMany({ data: expired.flatMap(booking =>
      [booking.ownerAccountId, booking.sitterAccountId].map(accountId => ({
        accountId, bookingId: booking.id, type: "BOOKING_EXPIRED" as const,
        title: "Prośba o rezerwację wygasła", message: "Termin został zwolniony, ponieważ prośba nie została zaakceptowana na czas."
      }))
    ) });
    return expired.length;
  });
}
