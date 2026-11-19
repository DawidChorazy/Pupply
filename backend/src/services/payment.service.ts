import { AccountRole, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";
import { payuClient, PayuError, PayuOrder, PayuRefund } from "./payu.client";
import { cancellationFee, schedulePaymentCancellation } from "./payment-state.service";
import { requireVerifiedEmail } from "./account-access.service";

const paymentInclude = { refund: true, booking: { select: { id: true, status: true, startsAt: true, endsAt: true, ownerAccountId: true, sitterAccountId: true, paidPaymentId: true, pet: { select: { name: true } }, settlement: true } } };
const terminal = ["CANCELLED", "REJECTED", "EXPIRED"];
function requireUser(role: AccountRole) { if (role !== "USER") throw new AppError(403, "Wymagane konto użytkownika.", "FORBIDDEN"); }
function publicPayment(payment: Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>, accountId: string) {
  const { buyerEmail: _email, customerIp: _ip, leaseToken: _token, leaseUntil: _lease, attempts: _attempts, nextSyncAt: _sync, activeKey: _active, ...visible } = payment;
  return { ...visible, booking: { ...visible.booking, settlement: visible.booking.paidPaymentId === payment.id ? visible.booking.settlement : null },
    checkoutUrl: payment.booking.ownerAccountId === accountId ? payment.checkoutUrl : null };
}
async function participantPayment(accountId: string, role: AccountRole, id: string) {
  requireUser(role);
  const payment = await prisma.payment.findFirst({ where: { id, booking: { OR: [{ ownerAccountId: accountId }, { sitterAccountId: accountId }] } }, include: paymentInclude });
  if (!payment) throw new AppError(404, "Nie znaleziono płatności.", "PAYMENT_NOT_FOUND");
  return payment;
}
export async function getPayment(accountId: string, role: AccountRole, id: string) { return publicPayment(await participantPayment(accountId, role, id), accountId); }
export async function paymentHistory(accountId: string, role: AccountRole, perspective: "owner" | "sitter", page = 1) {
  requireUser(role);
  const bookingWhere = perspective === "owner" ? { ownerAccountId: accountId } : { sitterAccountId: accountId };
  const [items, total, settlements, sandboxSettlements] = await prisma.$transaction([
    prisma.payment.findMany({ where: { booking: bookingWhere }, include: paymentInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30, skip: (page - 1) * 30 }),
    prisma.payment.count({ where: { booking: bookingWhere } }),
    prisma.paymentSettlement.aggregate({ where: { booking: { ...bookingWhere, paidPayment: { environment: "production" } } }, _sum: { amountCents: true } }),
    prisma.paymentSettlement.aggregate({ where: { booking: { ...bookingWhere, paidPayment: { environment: "sandbox" } } }, _sum: { amountCents: true } })
  ]);
  return { items: items.map(payment => publicPayment(payment, accountId)), pagination: { page, pageSize: 30, total },
    grossSettledCents: settlements._sum.amountCents ?? 0, sandboxGrossSettledCents: sandboxSettlements._sum.amountCents ?? 0, payoutsSupported: false };
}

export async function createCheckout(accountId: string, role: AccountRole, bookingId: string, customerIp: string) {
  requireUser(role); await requireVerifiedEmail(accountId);
  if (!env.PAYU_ENABLED) throw new AppError(503, "Płatności PayU nie są jeszcze dostępne.", "PAYMENTS_UNAVAILABLE");
  const payment = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
    const booking = await tx.booking.findFirst({ where: { id: bookingId, ownerAccountId: accountId }, include: { owner: { select: { email: true } } } });
    if (!booking) throw new AppError(404, "Nie znaleziono rezerwacji.", "BOOKING_NOT_FOUND");
    if (!booking.paymentRequired) throw new AppError(409, "Ta rezerwacja nie wymaga płatności online.", "PAYMENT_NOT_REQUIRED");
    if (booking.paidPaymentId) return tx.payment.findUniqueOrThrow({ where: { id: booking.paidPaymentId } });
    if (booking.status !== "ACCEPTED" || !booking.paymentDueAt || booking.paymentDueAt <= new Date())
      throw new AppError(409, "Rezerwacja musi być zaakceptowana i opłacona przed upływem terminu płatności.", "PAYMENT_NOT_AVAILABLE");
    const existing = await tx.payment.findUnique({ where: { activeKey: booking.id } });
    if (existing) return existing;
    return tx.payment.create({ data: { bookingId, activeKey: bookingId, amountCents: booking.priceCents, environment: env.PAYU_ENVIRONMENT, customerIp, buyerEmail: booking.owner.email } });
  });
  await processPayment(payment.id);
  return getPayment(accountId, role, payment.id);
}

export async function syncPayment(accountId: string, role: AccountRole, id: string) {
  await participantPayment(accountId, role, id);
  await processPayment(id);
  return getPayment(accountId, role, id);
}

export async function getCancellationQuote(accountId: string, role: AccountRole, bookingId: string) {
  requireUser(role);
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, OR: [{ ownerAccountId: accountId }, { sitterAccountId: accountId }] } });
  if (!booking) throw new AppError(404, "Nie znaleziono rezerwacji.", "BOOKING_NOT_FOUND");
  if (!["REQUESTED", "ACCEPTED"].includes(booking.status)) throw new AppError(409, "Tej rezerwacji nie można już anulować.", "INVALID_BOOKING_TRANSITION");
  const feeCents = cancellationFee(booking, accountId);
  return { feeCents, refundCents: booking.paidPaymentId ? booking.priceCents - feeCents : 0, currency: "PLN" };
}

async function expireLocked(tx: Prisma.TransactionClient, id: string) {
  const booking = await tx.booking.update({ where: { id }, data: { status: "EXPIRED", activeSlotKey: null } });
  await tx.notification.createMany({ data: [booking.ownerAccountId, booking.sitterAccountId].map(accountId => ({ accountId, bookingId: id, type: "BOOKING_EXPIRED" as const,
    title: "Upłynął termin płatności", message: "Rezerwacja wygasła, ponieważ płatność nie została potwierdzona na czas. Ewentualna spóźniona wpłata zostanie zwrócona." })) });
  return booking;
}

export async function applyPayuOrder(order: PayuOrder) {
  const found = await prisma.payment.findUnique({ where: { id: order.extOrderId } });
  // A single POS can serve more than one deployment; do not adopt foreign orders.
  if (!found) return;
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${found.bookingId} FOR UPDATE`;
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: found.id } });
    let booking = await tx.booking.findUniqueOrThrow({ where: { id: payment.bookingId } });
    if (payment.environment !== env.PAYU_ENVIRONMENT || order.merchantPosId !== env.PAYU_POS_ID || Number(order.totalAmount) !== payment.amountCents
      || order.currencyCode !== payment.currency || (payment.payuOrderId && payment.payuOrderId !== order.orderId))
      throw new AppError(409, "Dane operatora nie zgadzają się z płatnością.", "PAYMENT_MISMATCH");
    if (payment.status === "COMPLETED") return; // completed is authoritative, including stale cancel notifications
    const status = order.status === "WAITING_FOR_CONFIRMATION" ? "AUTHORIZED" : order.status === "NEW" ? "PENDING" : order.status;
    if (status !== "COMPLETED" && ["CANCELED", "FAILED"].includes(payment.status)) return;
    if (status === "PENDING" && payment.status === "AUTHORIZED") return;
    await tx.payment.update({ where: { id: payment.id }, data: { payuOrderId: order.orderId, status, lastErrorCode: null,
      ...(status === "COMPLETED" ? { completedAt: new Date(), activeKey: null } : status === "CANCELED" ? { activeKey: null } : {}), nextSyncAt: new Date() } });
    if (status === "COMPLETED") {
      if (booking.status === "ACCEPTED" && !booking.paidPaymentId && booking.paymentDueAt && booking.paymentDueAt <= new Date()) booking = await expireLocked(tx, booking.id);
      const canAttach = booking.status === "ACCEPTED" && !booking.paidPaymentId;
      if (canAttach) booking = await tx.booking.update({ where: { id: booking.id }, data: { paidPaymentId: payment.id } });
      else await tx.paymentRefund.upsert({ where: { paymentId: payment.id }, update: {}, create: { paymentId: payment.id, amountCents: payment.amountCents } });
      await tx.notification.create({ data: { accountId: booking.ownerAccountId, bookingId: booking.id, type: "PAYMENT_COMPLETED", title: "PayU potwierdziło płatność",
        message: canAttach ? "Rezerwacja została opłacona." : "Płatność dotarła po zamknięciu rezerwacji lub została zdublowana. Zleciliśmy zwrot." } });
      if (canAttach) await tx.notification.create({ data: { accountId: booking.sitterAccountId, bookingId: booking.id, type: "PAYMENT_COMPLETED", title: "Rezerwacja opłacona", message: "Właściciel opłacił usługę. Możesz zrealizować rezerwację." } });
      await tx.payment.updateMany({ where: { bookingId: booking.id, id: { not: payment.id } }, data: { nextSyncAt: new Date() } });
    }
  });
}

export async function applyPayuRefund(paymentId: string, orderId: string, incoming: PayuRefund) {
  const found = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!found) return;
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${found.bookingId} FOR UPDATE`;
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const refund = await tx.paymentRefund.findUnique({ where: { paymentId } });
    if (!refund || payment.environment !== env.PAYU_ENVIRONMENT || payment.payuOrderId !== orderId || refund.id !== incoming.extRefundId
      || refund.amountCents !== incoming.amount || incoming.currencyCode !== payment.currency || (refund.payuRefundId && refund.payuRefundId !== incoming.refundId))
      throw new AppError(409, "Dane zwrotu nie zgadzają się ze zleceniem.", "REFUND_MISMATCH");
    if (refund.status === "FINALIZED" || (refund.status === "CANCELED" && incoming.status === "PENDING")) return;
    await tx.paymentRefund.update({ where: { id: refund.id }, data: { status: incoming.status, payuRefundId: incoming.refundId, lastErrorCode: null } });
    if (incoming.status === "FINALIZED") {
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: payment.bookingId } });
      await tx.notification.create({ data: { accountId: booking.ownerAccountId, bookingId: booking.id, type: "PAYMENT_REFUNDED", title: "PayU potwierdziło zwrot", message: `Zwrócono ${(refund.amountCents / 100).toFixed(2)} zł za rezerwację.` } });
    }
  });
}

/** No provider request runs inside a database transaction. A lease bounds parallel workers;
 * persisted extOrderId/extRefundId prevent duplicate charges/refunds after a lost response. */
export async function processPayment(id: string) {
  const leaseToken = randomUUID(), now = new Date();
  const claimed = await prisma.payment.updateMany({ where: { id, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
    data: { leaseUntil: new Date(now.getTime() + 90_000), leaseToken, attempts: { increment: 1 } } });
  if (!claimed.count) return;
  let retryAfter = 30_000;
  try {
    let payment = await prisma.payment.findUniqueOrThrow({ where: { id }, include: { booking: true, refund: true } });
    if (payment.environment !== env.PAYU_ENVIRONMENT) throw new PayuError("PAYMENT_ENVIRONMENT_CHANGED", false);
    const booking = payment.booking;
    const closed = terminal.includes(booking.status) || (booking.paidPaymentId !== null && booking.paidPaymentId !== id)
      || (booking.status === "ACCEPTED" && !booking.paidPaymentId && !!booking.paymentDueAt && booking.paymentDueAt <= now);
    if (!payment.payuOrderId && payment.status === "CREATING") {
      if (closed && payment.attempts === 1) {
        await prisma.payment.update({ where: { id }, data: { status: "CANCELED", activeKey: null } }); return;
      }
      const uncertain = ["PAYU_ORDER_EXISTS", "PAYU_UNAVAILABLE", "PAYU_INVALID_RESPONSE", "ORDER_RECOVERY_REQUIRED", "PAYU_ORDER_MISMATCH", "INVALID_CHECKOUT_URL"];
      if (payment.attempts > 6 && uncertain.includes(payment.lastErrorCode ?? "")) throw new PayuError("ORDER_RECOVERY_REQUIRED", false);
      const created = await payuClient.createOrder({ id, amountCents: payment.amountCents, email: payment.buyerEmail, customerIp: payment.customerIp,
        validitySeconds: Math.max(1, Math.floor(((booking.paymentDueAt?.getTime() ?? now.getTime() + 1800_000) - Date.now()) / 1000)) });
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${booking.id} FOR UPDATE`;
        const current = await tx.payment.findUniqueOrThrow({ where: { id } });
        if (current.payuOrderId && current.payuOrderId !== created.orderId) throw new PayuError("PAYU_ORDER_MISMATCH", false);
        await tx.payment.update({ where: { id }, data: { payuOrderId: created.orderId, checkoutUrl: created.checkoutUrl,
          ...(current.status === "CREATING" ? { status: "PENDING" } : {}) } });
      });
      payment = await prisma.payment.findUniqueOrThrow({ where: { id }, include: { booking: true, refund: true } });
    }
    if (payment.payuOrderId && !["COMPLETED", "CANCELED", "FAILED"].includes(payment.status)) {
      const order = await payuClient.getOrder(payment.payuOrderId);
      if (order.extOrderId !== payment.id) throw new PayuError("PAYU_ORDER_MISMATCH", false);
      await applyPayuOrder(order);
      const latestBooking = await prisma.booking.findUniqueOrThrow({ where: { id: payment.bookingId } });
      const noLongerNeeded = terminal.includes(latestBooking.status) || (!!latestBooking.paidPaymentId && latestBooking.paidPaymentId !== id)
        || (!latestBooking.paidPaymentId && !!latestBooking.paymentDueAt && latestBooking.paymentDueAt <= new Date())
        || (!payment.checkoutUrl && Date.now() - payment.createdAt.getTime() > 60_000);
      if (["NEW", "PENDING", "WAITING_FOR_CONFIRMATION"].includes(order.status) && noLongerNeeded) {
        await payuClient.cancelOrder(payment.payuOrderId);
        await applyPayuOrder(await payuClient.getOrder(payment.payuOrderId));
      } else if (order.status === "WAITING_FOR_CONFIRMATION") {
        await payuClient.captureOrder(payment.payuOrderId);
        await applyPayuOrder(await payuClient.getOrder(payment.payuOrderId));
      }
    }
    payment = await prisma.payment.findUniqueOrThrow({ where: { id }, include: { booking: true, refund: true } });
    if (payment.status === "COMPLETED" && terminal.includes(payment.booking.status)) {
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${payment.bookingId} FOR UPDATE`;
        await schedulePaymentCancellation(tx, await tx.booking.findUniqueOrThrow({ where: { id: payment.bookingId } }));
      });
      payment = await prisma.payment.findUniqueOrThrow({ where: { id }, include: { booking: true, refund: true } });
    }
    if (payment.payuOrderId && payment.refund && ["REQUESTED", "PENDING"].includes(payment.refund.status)) {
      // Reconcile first: a previous refund POST may have committed before timing out.
      const known = (await payuClient.getRefunds(payment.payuOrderId)).find(refund => refund.extRefundId === payment.refund!.id);
      const refund = known ?? await payuClient.refund(payment.payuOrderId, payment.refund.id, payment.refund.amountCents);
      await applyPayuRefund(id, payment.payuOrderId, refund);
    }
    await prisma.payment.updateMany({ where: { id, leaseToken }, data: { lastErrorCode: null } });
    const final = await prisma.payment.findUniqueOrThrow({ where: { id }, include: { refund: true, booking: true } });
    if (["CANCELED", "FAILED"].includes(final.status) || (final.status === "COMPLETED" && (!final.refund || ["FINALIZED", "CANCELED"].includes(final.refund.status)))) retryAfter = 86_400_000;
  } catch (error) {
    const code = error instanceof PayuError ? error.code : error instanceof AppError ? error.code : "PAYU_INVALID_RESPONSE";
    const definitiveReject = error instanceof PayuError && !error.retryable && code === "PAYU_REJECTED";
    if (definitiveReject) await prisma.payment.updateMany({ where: { id, leaseToken, status: "CREATING", payuOrderId: null }, data: { status: "FAILED", activeKey: null } });
    await prisma.payment.updateMany({ where: { id, leaseToken }, data: { lastErrorCode: code } });
    const row = await prisma.payment.findUnique({ where: { id } });
    retryAfter = error instanceof PayuError && !error.retryable ? 86_400_000 : Math.min(3_600_000, 30_000 * 2 ** Math.min(row?.attempts ?? 0, 6));
  } finally {
    await prisma.payment.updateMany({ where: { id, leaseToken }, data: { leaseUntil: null, leaseToken: null, nextSyncAt: new Date(Date.now() + retryAfter) } });
  }
}

export async function expireUnpaidBookings(now = new Date()) {
  const candidates = await prisma.booking.findMany({ where: { status: "ACCEPTED", paymentRequired: true, paidPaymentId: null, paymentDueAt: { lte: now } }, take: 100, orderBy: { paymentDueAt: "asc" } });
  for (const candidate of candidates) await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${candidate.id} FOR UPDATE`;
    const current = await tx.booking.findUniqueOrThrow({ where: { id: candidate.id } });
    if (current.status !== "ACCEPTED" || current.paidPaymentId || !current.paymentDueAt || current.paymentDueAt > now) return;
    const closed = await expireLocked(tx, current.id); await schedulePaymentCancellation(tx, closed);
  });
}
export async function maintainPayments() {
  await expireUnpaidBookings();
  if (!env.PAYU_POS_ID || !env.PAYU_CLIENT_SECRET || !env.PAYU_SECOND_KEY) return;
  const due = await prisma.payment.findMany({ where: { nextSyncAt: { lte: new Date() }, OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date() } }] }, select: { id: true }, take: 20, orderBy: { nextSyncAt: "asc" } });
  for (let offset = 0; offset < due.length; offset += 4) await Promise.all(due.slice(offset, offset + 4).map(payment => processPayment(payment.id)));
}

export function startPaymentMaintenance() {
  let running: Promise<void> | undefined, stopped = false;
  const tick = () => {
    if (running || stopped) return;
    running = maintainPayments().catch(() => { console.error(JSON.stringify({ event: "payment_maintenance_failed" })); }).finally(() => { running = undefined; });
  };
  tick(); const timer = setInterval(tick, 15_000); timer.unref();
  return async () => { stopped = true; clearInterval(timer); await running; };
}

export async function recoverPayuOrder(paymentId: string, orderId: string) {
  const order = await payuClient.getOrder(orderId);
  if (order.extOrderId !== paymentId) throw new AppError(409, "Zamówienie należy do innej płatności.", "PAYMENT_MISMATCH");
  await applyPayuOrder(order); await processPayment(paymentId);
}
