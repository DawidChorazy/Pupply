import { completePetFixture } from "../test-fixtures";
import { randomUUID, createHash } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../app";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { signAccessToken } from "../utils/tokens";
import { payuClient, PayuError, PayuOrder, PayuRefund } from "./payu.client";
import { applyPayuOrder, createCheckout, expireUnpaidBookings, processPayment } from "./payment.service";
import { setAccountState } from "./account.service";

const ids: string[] = [];
const initialEnv = { ...env };
const orders = new Map<string, PayuOrder>(), refunds = new Map<string, PayuRefund[]>();
async function account(role: "USER" | "ADMIN" | "CLINIC" = "USER") {
  const item = await prisma.account.create({ data: { email: `${randomUUID()}@payu.test`, role, emailVerifiedAt: new Date() } }); ids.push(item.id);
  return { id: item.id, auth: `Bearer ${signAccessToken(item.id, role)}` };
}
async function fixture(offsetMinutes = 5) {
  const owner = await account(), sitter = await account(), stranger = await account();
  const profile = await prisma.sitterProfile.create({ data: { verificationStatus: "VERIFIED", accountId: sitter.id, bio: "Test PayU", city: "Warszawa", latitude: 52, longitude: 21,
    services: { create: { type: "DOG_WALK", durationMinutes: 30, priceCents: 3001 } } }, include: { services: true } });
  const startsAt = new Date(Date.now() + offsetMinutes * 60_000), endsAt = new Date(startsAt.getTime() + 30 * 60_000);
  const slot = await prisma.availabilitySlot.create({ data: { sitterProfileId: profile.id, startsAt, endsAt } });
  const pet = await prisma.pet.create({ data: { ...completePetFixture(), accountId: owner.id, name: "Pies PayU", gender: "MALE" } });
  const booking = await prisma.booking.create({ data: { ownerAccountId: owner.id, sitterAccountId: sitter.id, petId: pet.id, pickupAddress: "Warszawa, Testowa 1", sitterServiceId: profile.services[0].id,
    availabilitySlotId: slot.id, status: "ACCEPTED", paymentRequired: true, paymentDueAt: new Date(Math.min(startsAt.getTime(), Date.now() + 30 * 60_000)), startsAt, endsAt, expiresAt: startsAt, priceCents: 3001 } });
  return { owner, sitter, stranger, booking, profile, slot, pet };
}
const checkout = (f: Awaited<ReturnType<typeof fixture>>, auth = f.owner.auth, input = {}) => request(app).post(`/api/bookings/${f.booking.id}/payment`).set("Authorization", auth).send(input);
async function notify(order: PayuOrder, extraWhitespace = false, signature?: string) {
  const body = extraWhitespace ? JSON.stringify({ order }, null, 2) : JSON.stringify({ order });
  const hash = signature ?? createHash("md5").update(body).update(env.PAYU_SECOND_KEY!).digest("hex");
  return request(app).post("/api/payments/payu/notify").set("Content-Type", "application/json").set("OpenPayu-Signature", `sender=checkout;signature=${hash};algorithm=MD5;content=DOCUMENT`).send(body);
}
async function paid(f: Awaited<ReturnType<typeof fixture>>) {
  const response = await checkout(f); expect(response.status).toBe(200);
  const order = { ...orders.get(response.body.payment.payuOrderId)!, status: "COMPLETED" as const }; orders.set(order.orderId, order);
  expect((await notify(order)).status).toBe(200);
  return { payment: response.body.payment, order };
}
beforeEach(() => {
  Object.assign(env, { PAYU_ENABLED: true, PAYU_ENVIRONMENT: "sandbox", PAYU_POS_ID: "999001", PAYU_CLIENT_ID: "999001", PAYU_CLIENT_SECRET: "test-client-secret", PAYU_SECOND_KEY: "test-second-key",
    PAYU_NOTIFY_URL: "https://test.example/api/payments/payu/notify", PAYU_CONTINUE_URL: "https://test.example/marketplace/payment" });
  orders.clear(); refunds.clear();
  vi.spyOn(payuClient, "createOrder").mockImplementation(async input => {
    const orderId = `order-${input.id}`;
    orders.set(orderId, { orderId, extOrderId: input.id, merchantPosId: env.PAYU_POS_ID!, totalAmount: String(input.amountCents), currencyCode: "PLN", status: "PENDING" });
    return { orderId, checkoutUrl: `https://secure.snd.payu.com/checkout/${orderId}` };
  });
  vi.spyOn(payuClient, "getOrder").mockImplementation(async id => { const order = orders.get(id); if (!order) throw new PayuError("PAYU_UNAVAILABLE"); return order; });
  vi.spyOn(payuClient, "cancelOrder").mockImplementation(async id => { orders.set(id, { ...orders.get(id)!, status: "CANCELED" }); });
  vi.spyOn(payuClient, "captureOrder").mockImplementation(async id => { orders.set(id, { ...orders.get(id)!, status: "COMPLETED" }); });
  vi.spyOn(payuClient, "getRefunds").mockImplementation(async id => refunds.get(id) ?? []);
  vi.spyOn(payuClient, "refund").mockImplementation(async (orderId, id, amount) => {
    const refund: PayuRefund = { refundId: `refund-${id}`, extRefundId: id, amount, currencyCode: "PLN", status: "PENDING" };
    refunds.set(orderId, [...refunds.get(orderId) ?? [], refund]); return refund;
  });
});
afterEach(async () => {
  vi.restoreAllMocks(); Object.assign(env, initialEnv);
  await prisma.booking.deleteMany({ where: { OR: [{ ownerAccountId: { in: ids } }, { sitterAccountId: { in: ids } }] } });
  await prisma.account.deleteMany({ where: { id: { in: ids.splice(0) } } });
});
afterAll(() => prisma.$disconnect());

describe("PayU booking payments", () => {
  it("requires payment for new priced bookings even with disabled checkout, sets its deadline on acceptance and exempts free services", async () => {
    const f = await fixture(); await prisma.booking.delete({ where: { id: f.booking.id } }); env.PAYU_ENABLED = false;
    for (const priceCents of [3001, 0]) {
      await prisma.sitterService.update({ where: { id: f.profile.services[0].id }, data: { priceCents } });
      const created = await request(app).post("/api/bookings").set("Authorization", f.owner.auth).send({ petId: f.pet.id, pickupAddress: "Warszawa, Testowa 1", sitterServiceId: f.profile.services[0].id, availabilitySlotId: f.slot.id });
      expect(created.status).toBe(201); expect(created.body.booking.paymentRequired).toBe(priceCents > 0);
      const accepted = await request(app).patch(`/api/bookings/${created.body.booking.id}/status`).set("Authorization", f.sitter.auth).send({ status: "ACCEPTED" });
      expect(accepted.status).toBe(200);
      if (priceCents) expect(new Date(accepted.body.booking.paymentDueAt).getTime()).toBeLessThanOrEqual(f.booking.startsAt.getTime());
      else expect(accepted.body.booking.paymentDueAt).toBeNull();
      await prisma.booking.delete({ where: { id: created.body.booking.id } });
    }
  });
  it("starts one checkout concurrently, prices it on the server and blocks a walk until signed confirmation", async () => {
    const f = await fixture();
    const [first, second] = await Promise.all([checkout(f), checkout(f)]);
    expect([first.status, second.status]).toEqual([200, 200]); expect(first.body.payment.id).toBe(second.body.payment.id);
    expect(payuClient.createOrder).toHaveBeenCalledTimes(1);
    expect(payuClient.createOrder).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 3001, id: first.body.payment.id }));
    expect((await request(app).post(`/api/bookings/${f.booking.id}/walk/start`).set("Authorization", f.sitter.auth)).body.error).toBe("PAYMENT_REQUIRED");
    const order = { ...orders.get(`order-${first.body.payment.id}`)!, status: "COMPLETED" as const };
    expect((await notify(order, true)).status).toBe(200);
    expect((await notify(order)).status).toBe(200);
    expect((await request(app).post(`/api/bookings/${f.booking.id}/walk/start`).set("Authorization", f.sitter.auth)).status).toBe(200);
    expect(await prisma.notification.count({ where: { bookingId: f.booking.id, type: "PAYMENT_COMPLETED" } })).toBe(2);
    const detail = await request(app).get(`/api/bookings/${f.booking.id}`).set("Authorization", f.sitter.auth);
    expect(detail.body.booking.paidPaymentId).toBe(first.body.payment.id);
    expect(detail.body.booking.payments[0]).not.toHaveProperty("buyerEmail"); expect(detail.body.booking.payments[0]).not.toHaveProperty("checkoutUrl");
  });
  it("restricts checkout to a verified owner, keeps history private, and refuses client-controlled amounts", async () => {
    const f = await fixture();
    expect((await checkout(f, f.sitter.auth)).status).toBe(404); expect((await checkout(f, f.stranger.auth)).status).toBe(404);
    expect((await checkout(f, f.owner.auth, { amountCents: 1 })).status).toBe(400);
    await prisma.account.update({ where: { id: f.owner.id }, data: { emailVerifiedAt: null } });
    expect((await checkout(f)).body.error).toBe("EMAIL_NOT_VERIFIED");
    await prisma.account.update({ where: { id: f.owner.id }, data: { emailVerifiedAt: new Date() } });
    const saved = await checkout(f), id = saved.body.payment.id;
    expect((await request(app).get(`/api/payments/${id}`).set("Authorization", f.stranger.auth)).status).toBe(404);
    const sitterView = await request(app).get(`/api/payments/${id}`).set("Authorization", f.sitter.auth);
    expect(sitterView.body.payment.checkoutUrl).toBeNull();
    for (const key of ["buyerEmail", "customerIp", "leaseToken", "leaseUntil", "activeKey"]) expect(sitterView.body.payment).not.toHaveProperty(key);
    const history = await request(app).get("/api/payments").set("Authorization", f.stranger.auth); expect(history.body.items).toHaveLength(0);
    env.PAYU_ENABLED = false; expect((await checkout(f)).body.error).toBe("PAYMENTS_UNAVAILABLE");
  });
  it("verifies exact webhook bytes, merchant, amount, currency and provider order ID", async () => {
    const f = await fixture(), saved = await checkout(f), order = orders.get(saved.body.payment.payuOrderId)!;
    expect((await notify({ ...order, status: "COMPLETED" }, false, "0".repeat(32))).status).toBe(401);
    for (const changed of [{ ...order, merchantPosId: "other" }, { ...order, totalAmount: "1" }, { ...order, orderId: "foreign" }]) expect((await notify({ ...changed, status: "COMPLETED" })).status).toBe(409);
    const wrongCurrency = { ...order, currencyCode: "EUR", status: "COMPLETED" };
    const raw = JSON.stringify({ order: wrongCurrency }), sig = createHash("md5").update(raw).update(env.PAYU_SECOND_KEY!).digest("hex");
    expect((await request(app).post("/api/payments/payu/notify").set("Content-Type", "application/json").set("OpenPayu-Signature", `signature=${sig};algorithm=MD5;content=DOCUMENT`).send(raw)).status).toBe(400);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).paidPaymentId).toBeNull();
    expect((await notify({ ...order, extOrderId: "foreign-deployment" })).status).toBe(200);
  });
  it("never downgrades completed payments on stale notifications or creates another checkout after payment", async () => {
    const f = await fixture(), { payment, order } = await paid(f);
    for (const status of ["PENDING", "CANCELED", "WAITING_FOR_CONFIRMATION"] as const) expect((await notify({ ...order, status })).status).toBe(200);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("COMPLETED");
    expect((await checkout(f)).body.payment.id).toBe(payment.id); expect(payuClient.createOrder).toHaveBeenCalledTimes(1);
  });
  it("requires explicit confirmation of a late cancellation fee and queues exactly one partial refund", async () => {
    const f = await fixture(), { payment } = await paid(f);
    const quote = await request(app).get(`/api/bookings/${f.booking.id}/cancellation-quote`).set("Authorization", f.owner.auth);
    expect(quote.body).toMatchObject({ feeCents: 1501, refundCents: 1500 });
    const cancel = () => request(app).patch(`/api/bookings/${f.booking.id}/status`).set("Authorization", f.owner.auth);
    expect((await cancel().send({ status: "CANCELLED" })).body.error).toBe("CANCELLATION_FEE_CONFIRMATION_REQUIRED");
    expect((await cancel().send({ status: "CANCELLED", expectedCancellationFeeCents: 1501 })).status).toBe(200);
    await processPayment(payment.id); await processPayment(payment.id);
    expect(payuClient.refund).toHaveBeenCalledTimes(1);
    const refund = await prisma.paymentRefund.findUniqueOrThrow({ where: { paymentId: payment.id } }); expect(refund.amountCents).toBe(1500); expect(refund.status).toBe("PENDING");
    expect((await prisma.paymentSettlement.findUniqueOrThrow({ where: { bookingId: f.booking.id } })).amountCents).toBe(1501);
    const final = { ...refunds.get(payment.payuOrderId)![0], status: "FINALIZED" };
    const body = JSON.stringify({ orderId: payment.payuOrderId, extOrderId: payment.id, refund: final });
    const signature = createHash("md5").update(body).update(env.PAYU_SECOND_KEY!).digest("hex");
    const webhook = () => request(app).post("/api/payments/payu/notify").set("Content-Type", "application/json").set("OpenPayu-Signature", `signature=${signature};algorithm=MD5;content=DOCUMENT`).send(body);
    expect((await webhook()).status).toBe(200); expect((await webhook()).status).toBe(200);
    expect((await prisma.paymentRefund.findUniqueOrThrow({ where: { paymentId: payment.id } })).status).toBe("FINALIZED");
    expect(await prisma.notification.count({ where: { bookingId: f.booking.id, type: "PAYMENT_REFUNDED" } })).toBe(1);
  });
  it("fully refunds early owner cancellation, sitter cancellation and account deactivation", async () => {
    for (const scenario of ["early", "sitter", "deactivation"] as const) {
      const f = await fixture(scenario === "early" ? 2 * 24 * 60 : 5), { payment } = await paid(f);
      if (scenario === "deactivation") { const admin = await account("ADMIN"); await setAccountState(admin.id, f.sitter.id, "BLOCK"); }
      else expect((await request(app).patch(`/api/bookings/${f.booking.id}/status`).set("Authorization", scenario === "early" ? f.owner.auth : f.sitter.auth).send({ status: "CANCELLED" })).status).toBe(200);
      await processPayment(payment.id);
      expect((await prisma.paymentRefund.findUniqueOrThrow({ where: { paymentId: payment.id } })).amountCents).toBe(3001);
      expect(await prisma.paymentSettlement.findUnique({ where: { bookingId: f.booking.id } })).toBeNull();
    }
  });
  it("keeps an unknown creation result attached to the same attempt and never opens another charge", async () => {
    const f = await fixture();
    vi.mocked(payuClient.createOrder).mockRejectedValue(new PayuError("PAYU_UNAVAILABLE"));
    const first = await checkout(f), second = await checkout(f);
    expect(first.body.payment.id).toBe(second.body.payment.id); expect(first.body.payment.status).toBe("CREATING");
    const calls = vi.mocked(payuClient.createOrder).mock.calls; expect(calls[0][0].id).toBe(calls[1][0].id);
    expect(await prisma.payment.count({ where: { bookingId: f.booking.id } })).toBe(1);
  });
  it("does not demote a payment when a webhook commits before the creation response", async () => {
    const f = await fixture();
    vi.mocked(payuClient.createOrder).mockImplementationOnce(async input => {
      const order: PayuOrder = { orderId: `race-${input.id}`, extOrderId: input.id, merchantPosId: env.PAYU_POS_ID!, totalAmount: String(input.amountCents), currencyCode: "PLN", status: "COMPLETED" };
      orders.set(order.orderId, order); await applyPayuOrder(order);
      return { orderId: order.orderId, checkoutUrl: `https://secure.snd.payu.com/checkout/${order.orderId}` };
    });
    const result = await checkout(f); expect(result.body.payment.status).toBe("COMPLETED");
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).paidPaymentId).toBe(result.body.payment.id);
  });
  it("can retry the original attempt after OAuth configuration is repaired without inventing an unknown order", async () => {
    const f = await fixture(), create = vi.mocked(payuClient.createOrder), original = create.getMockImplementation()!;
    create.mockRejectedValue(new PayuError("PAYU_AUTH_FAILED"));
    const saved = await checkout(f); expect(saved.body.payment.status).toBe("CREATING");
    await prisma.payment.update({ where: { id: saved.body.payment.id }, data: { attempts: 8 } });
    create.mockImplementation(original);
    const repaired = await checkout(f); expect(repaired.body.payment.id).toBe(saved.body.payment.id); expect(repaired.body.payment.status).toBe("PENDING");
  });
  it("expires unpaid bookings and refunds late payments without resurrecting the booking", async () => {
    const f = await fixture(), result = await checkout(f), order = orders.get(result.body.payment.payuOrderId)!;
    await prisma.booking.update({ where: { id: f.booking.id }, data: { paymentDueAt: new Date(Date.now() - 1000) } });
    await expireUnpaidBookings();
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).status).toBe("EXPIRED");
    expect((await notify({ ...order, status: "COMPLETED" })).status).toBe(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).paidPaymentId).toBeNull();
    expect((await prisma.paymentRefund.findUniqueOrThrow({ where: { paymentId: result.body.payment.id } })).amountCents).toBe(3001);
    await processPayment(result.body.payment.id); expect(payuClient.refund).toHaveBeenCalledTimes(1);
  });
  it("handles completion after cancellation by refunding in full and blocks unconfirmed status completion", async () => {
    const f = await fixture(), result = await checkout(f), order = orders.get(result.body.payment.payuOrderId)!;
    const cancel = await request(app).patch(`/api/bookings/${f.booking.id}/status`).set("Authorization", f.owner.auth).send({ status: "CANCELLED" }); expect(cancel.status).toBe(200);
    await notify({ ...order, status: "COMPLETED" });
    const refund = await prisma.paymentRefund.findUniqueOrThrow({ where: { paymentId: result.body.payment.id } }); expect(refund.amountCents).toBe(3001);
    const other = await fixture(-31);
    expect((await request(app).patch(`/api/bookings/${other.booking.id}/status`).set("Authorization", other.sitter.auth).send({ status: "COMPLETED" })).body.error).toBe("PAYMENT_REQUIRED");
  });
  it("supports waiting-for-confirmation POS and releases settlement only after completed service", async () => {
    const f = await fixture(), result = await checkout(f), id = result.body.payment.id;
    orders.set(result.body.payment.payuOrderId, { ...orders.get(result.body.payment.payuOrderId)!, status: "WAITING_FOR_CONFIRMATION" });
    await processPayment(id); expect(payuClient.captureOrder).toHaveBeenCalledTimes(1);
    expect(await prisma.paymentSettlement.findUnique({ where: { bookingId: f.booking.id } })).toBeNull();
    expect((await request(app).post(`/api/bookings/${f.booking.id}/walk/start`).set("Authorization", f.sitter.auth)).status).toBe(200);
    expect((await request(app).post(`/api/bookings/${f.booking.id}/walk/finish`).set("Authorization", f.sitter.auth)).status).toBe(200);
    expect((await prisma.paymentSettlement.findUniqueOrThrow({ where: { bookingId: f.booking.id } })).amountCents).toBe(3001);
    const history = await request(app).get("/api/payments?perspective=sitter").set("Authorization", f.sitter.auth);
    expect(history.body.grossSettledCents).toBe(0); expect(history.body.sandboxGrossSettledCents).toBe(3001); expect(history.body.payoutsSupported).toBe(false);
  });
  it("allows a new attempt only after a definite cancellation, and refunds a late duplicate completion", async () => {
    const f = await fixture(), first = await checkout(f), firstOrder = orders.get(first.body.payment.payuOrderId)!;
    await notify({ ...firstOrder, status: "CANCELED" });
    const second = await paid(f); expect(second.payment.id).not.toBe(first.body.payment.id);
    await notify({ ...firstOrder, status: "COMPLETED" });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).paidPaymentId).toBe(second.payment.id);
    expect((await prisma.paymentRefund.findUniqueOrThrow({ where: { paymentId: first.body.payment.id } })).amountCents).toBe(3001);
  });
  it("uses the same refund identity after a timeout and reconciles an already accepted refund", async () => {
    const f = await fixture(), { payment } = await paid(f);
    await request(app).patch(`/api/bookings/${f.booking.id}/status`).set("Authorization", f.sitter.auth).send({ status: "CANCELLED" });
    vi.mocked(payuClient.refund).mockImplementationOnce(async (orderId, id, amount) => {
      refunds.set(orderId, [{ refundId: "refund-lost-response", extRefundId: id, amount, currencyCode: "PLN", status: "FINALIZED" }]);
      throw new PayuError("PAYU_UNAVAILABLE");
    });
    await processPayment(payment.id); await processPayment(payment.id);
    expect(payuClient.refund).toHaveBeenCalledTimes(1);
    expect((await prisma.paymentRefund.findUniqueOrThrow({ where: { paymentId: payment.id } })).status).toBe("FINALIZED");
  });
  it("lets administrators recover an unknown provider order only after verifying its identity", async () => {
    const f = await fixture(), admin = await account("ADMIN");
    vi.mocked(payuClient.createOrder).mockRejectedValueOnce(new PayuError("PAYU_ORDER_EXISTS"));
    const saved = await checkout(f), id = saved.body.payment.id;
    const order: PayuOrder = { orderId: `recovered-${id}`, extOrderId: id, merchantPosId: env.PAYU_POS_ID!, totalAmount: "3001", currencyCode: "PLN", status: "COMPLETED" }; orders.set(order.orderId, order);
    expect((await request(app).post(`/api/admin/payments/${id}/recover`).set("Authorization", f.owner.auth).send({ orderId: order.orderId })).status).toBe(403);
    expect((await request(app).post(`/api/admin/payments/${id}/recover`).set("Authorization", admin.auth).send({ orderId: order.orderId })).status).toBe(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).paidPaymentId).toBe(id);
    expect(await prisma.auditLog.count({ where: { action: "PAYU_ORDER_RECOVERED", targetAccountId: f.owner.id } })).toBe(1);
  });
});
