import { Booking, Prisma } from "@prisma/client";
import { AppError } from "../utils/app-error";

export async function assertBookingPaid(tx: Prisma.TransactionClient, booking: Booking) {
  if (!booking.paymentRequired) return;
  const payment = booking.paidPaymentId ? await tx.payment.findUnique({ where: { id: booking.paidPaymentId } }) : null;
  if (!payment || payment.bookingId !== booking.id || payment.status !== "COMPLETED" || payment.amountCents !== booking.priceCents)
    throw new AppError(409, "Właściciel musi opłacić rezerwację przed rozpoczęciem usługi.", "PAYMENT_REQUIRED");
}

export function cancellationFee(booking: Booking, accountId: string, now = new Date()) {
  return booking.paymentRequired && booking.paidPaymentId && booking.status === "ACCEPTED" && accountId === booking.ownerAccountId
    && booking.startsAt.getTime() - now.getTime() < 24 * 3_600_000 ? Math.ceil(booking.priceCents / 2) : 0;
}

export async function settleBooking(tx: Prisma.TransactionClient, booking: Booking) {
  if (!booking.paymentRequired || !booking.paidPaymentId) return;
  const amountCents = booking.status === "COMPLETED" ? booking.priceCents : booking.cancellationFeeCents;
  if (amountCents > 0) await tx.paymentSettlement.upsert({ where: { bookingId: booking.id }, update: {},
    create: { bookingId: booking.id, amountCents, kind: booking.status === "COMPLETED" ? "SERVICE" : "CANCELLATION_FEE" } });
}

export async function schedulePaymentCancellation(tx: Prisma.TransactionClient, booking: Booking) {
  const payments = await tx.payment.findMany({ where: { bookingId: booking.id } });
  for (const payment of payments) {
    if (payment.status === "COMPLETED") {
      const amountCents = payment.amountCents - (booking.paidPaymentId === payment.id ? booking.cancellationFeeCents : 0);
      if (amountCents > 0) await tx.paymentRefund.upsert({ where: { paymentId: payment.id }, update: {}, create: { paymentId: payment.id, amountCents } });
    }
  }
  await tx.payment.updateMany({ where: { bookingId: booking.id }, data: { nextSyncAt: new Date() } });
  await settleBooking(tx, booking);
}
