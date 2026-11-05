import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../app";
import { prisma } from "../config/prisma";
import { signAccessToken } from "../utils/tokens";

const ids: string[] = [];
async function fixture() {
  const user = async () => {
    const account = await prisma.account.create({ data: { email: `${randomUUID()}@booking-reliability.test`, role: "USER", emailVerifiedAt: new Date() } });
    ids.push(account.id);
    return { id: account.id, auth: `Bearer ${signAccessToken(account.id, "USER")}` };
  };
  const sitter = await user(), owner = await user(), stranger = await user();
  const profile = await prisma.sitterProfile.create({ data: {
    accountId: sitter.id, bio: "Opiekun do testów niezawodności", city: "Warszawa", latitude: 52.23, longitude: 21.01,
    services: { create: { type: "DOG_WALK", durationMinutes: 30, priceCents: 3000 } }
  }, include: { services: true } });
  const pet = await prisma.pet.create({ data: { accountId: owner.id, name: "Figa", gender: "FEMALE" } });
  const start = Date.now() + 48 * 3_600_000;
  const interval = (from: number, to: number) => ({ startsAt: new Date(start + from * 60_000).toISOString(), endsAt: new Date(start + to * 60_000).toISOString() });
  const slot = async (from = 0, to = 240) => prisma.availabilitySlot.create({ data: { sitterProfileId: profile.id, startsAt: new Date(interval(from, to).startsAt), endsAt: new Date(interval(from, to).endsAt) } });
  const create = (availabilitySlotId: string, startsAt: string, key?: string, extra: object = {}) => {
    const pending = request(app).post("/api/bookings").set("Authorization", owner.auth);
    if (key) pending.set("Idempotency-Key", key);
    return pending.send({ petId: pet.id, sitterServiceId: profile.services[0].id, availabilitySlotId, startsAt, ...extra });
  };
  const publicUrl = `/api/sitters/${profile.id}/availability?sitterServiceId=${profile.services[0].id}`;
  return { sitter, owner, stranger, profile, pet, interval, slot, create, publicUrl };
}
afterEach(async () => {
  await prisma.booking.deleteMany({ where: { OR: [{ ownerAccountId: { in: ids } }, { sitterAccountId: { in: ids } }] } });
  await prisma.account.deleteMany({ where: { id: { in: ids.splice(0) } } });
});
afterAll(() => prisma.$disconnect());

describe("booking reliability regressions", () => {
  it("accepts both simultaneous non-overlapping bookings on the same sitter and pet", async () => {
    const data = await fixture();
    for (let trial = 0; trial < 10; trial++) {
      const slot = await data.slot(trial * 1440, trial * 1440 + 240);
      const responses = await Promise.all([
        data.create(slot.id, slot.startsAt.toISOString()),
        data.create(slot.id, new Date(slot.startsAt.getTime() + 60 * 60_000).toISOString())
      ]);
      expect(responses.map(response => response.status)).toEqual([201, 201]);
    }
    expect(await prisma.booking.count({ where: { ownerAccountId: data.owner.id } })).toBe(20);
  });

  it("replays a lost response and concurrent retries exactly once, including after cancellation", async () => {
    const data = await fixture(), slot = await data.slot(), key = randomUUID();
    const responses = await Promise.all([data.create(slot.id, slot.startsAt.toISOString(), key), data.create(slot.id, slot.startsAt.toISOString(), key)]);
    expect(responses.map(response => response.status)).toEqual([201, 201]);
    expect(responses[0].body).toEqual(responses[1].body);
    expect(await prisma.booking.count({ where: { ownerAccountId: data.owner.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { accountId: data.sitter.id } })).toBe(1);
    const booking = responses[0].body.booking;
    expect((await request(app).patch(`/api/bookings/${booking.id}/status`).set("Authorization", data.owner.auth).send({ status: "CANCELLED" })).status).toBe(200);
    expect((await data.create(slot.id, slot.startsAt.toISOString(), key)).body).toEqual(responses[0].body);
    const recovered = await request(app).get(`/api/bookings/operations/${key}`).set("Authorization", data.owner.auth);
    expect(recovered.status).toBe(200); expect(recovered.body.bookings[0].id).toBe(booking.id);
    expect(recovered.headers["cache-control"]).toBe("no-store");
    expect((await request(app).get(`/api/bookings/operations/${key}`).set("Authorization", data.stranger.auth)).status).toBe(404);
    const reused = await data.create(slot.id, slot.startsAt.toISOString(), key, { note: "Different request" });
    expect(reused.status).toBe(409); expect(reused.body.error).toBe("IDEMPOTENCY_KEY_REUSED");
    expect((await data.create(slot.id, slot.startsAt.toISOString(), "short")).status).toBe(400);
  });

  it("replays a multi-day operation without duplicate bookings or notifications", async () => {
    const data = await fixture(), key = randomUUID();
    const first = await data.slot(), second = await data.slot(1440, 1680);
    const payload = { petId: data.pet.id, sitterServiceId: data.profile.services[0].id, durationMinutes: 60, expectedPriceCents: 6000,
      slots: [first, second].map(slot => ({ availabilitySlotId: slot.id, startsAt: slot.startsAt.toISOString() })) };
    const create = () => request(app).post("/api/bookings/batch").set("Authorization", data.owner.auth).set("Idempotency-Key", key).send(payload);
    const responses = await Promise.all([create(), create()]);
    expect(responses.map(response => response.status)).toEqual([201, 201]);
    expect(responses[0].body).toEqual(responses[1].body);
    expect(responses[0].body.totalPriceCents).toBe(12000);
    expect(await prisma.booking.count({ where: { ownerAccountId: data.owner.id } })).toBe(2);
    expect(await prisma.notification.count({ where: { accountId: data.sitter.id } })).toBe(2);
  });

  it("rolls back the operation key with a failed batch, allowing a later safe retry", async () => {
    const data = await fixture(), key = randomUUID();
    const first = await data.slot(), second = await data.slot(1440, 1680);
    const existing = await data.create(second.id, second.startsAt.toISOString());
    expect(existing.status).toBe(201);
    const payload = { petId: data.pet.id, sitterServiceId: data.profile.services[0].id,
      slots: [first, second].map(slot => ({ availabilitySlotId: slot.id, startsAt: slot.startsAt.toISOString() })) };
    const create = () => request(app).post("/api/bookings/batch").set("Authorization", data.owner.auth).set("Idempotency-Key", key).send(payload);
    expect((await create()).status).toBe(409);
    expect(await prisma.bookingOperation.count({ where: { accountId: data.owner.id } })).toBe(0);
    expect((await request(app).patch(`/api/bookings/${existing.body.booking.id}/status`).set("Authorization", data.owner.auth).send({ status: "CANCELLED" })).status).toBe(200);
    expect((await create()).status).toBe(201);
    expect(await prisma.booking.count({ where: { ownerAccountId: data.owner.id, status: "REQUESTED" } })).toBe(2);
  });

  it("allows closing or moving cancelled availability while preserving booking history", async () => {
    const data = await fixture(), slot = await data.slot();
    const created = await data.create(slot.id, data.interval(60, 90).startsAt);
    expect(created.status).toBe(201);
    const path = `/api/sitters/me/availability/${slot.id}`;
    expect((await request(app).delete(path).set("Authorization", data.sitter.auth)).status).toBe(409);
    expect((await request(app).patch(`/api/bookings/${created.body.booking.id}/status`).set("Authorization", data.owner.auth).send({ status: "CANCELLED" })).status).toBe(200);
    expect((await request(app).patch(path).set("Authorization", data.sitter.auth).send(data.interval(120, 240))).status).toBe(200);
    expect((await request(app).delete(path).set("Authorization", data.sitter.auth)).status).toBe(204);
    expect((await request(app).delete(path).set("Authorization", data.sitter.auth)).status).toBe(204);
    expect((await prisma.availabilitySlot.findUniqueOrThrow({ where: { id: slot.id } })).archivedAt).not.toBeNull();
    const history = await request(app).get(`/api/bookings/${created.body.booking.id}`).set("Authorization", data.owner.auth);
    expect(history.status).toBe(200); expect(history.body.booking.startsAt).toBe(data.interval(60, 90).startsAt);
    expect(history.body.booking.priceCents).toBe(3000);
    expect((await data.create(slot.id, data.interval(120, 150).startsAt)).status).toBe(404);
    const replacement = await request(app).post("/api/sitters/me/availability").set("Authorization", data.sitter.auth).send(data.interval(120, 240));
    expect(replacement.status).toBe(201);
    expect(replacement.body.slot.id).not.toBe(slot.id);
    expect((await request(app).get(data.publicUrl)).body.availability.every((item: { id: string }) => item.id !== slot.id)).toBe(true);
  });

  it("reads expired requests as free time without changing their rows or creating notifications", async () => {
    const data = await fixture(), slot = await data.slot();
    const created = await data.create(slot.id, data.interval(60, 90).startsAt);
    expect(created.status).toBe(201);
    await prisma.booking.update({ where: { id: created.body.booking.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const notifications = await prisma.notification.count({ where: { bookingId: created.body.booking.id } });
    const publicRead = await request(app).get(data.publicUrl);
    expect(publicRead.status).toBe(200); expect(publicRead.body.availability).toHaveLength(1);
    expect(publicRead.body.availability[0].startsAt).toBe(slot.startsAt.toISOString());
    const own = await request(app).get("/api/sitters/me").set("Authorization", data.sitter.auth);
    expect(own.body.profile.availability[0].bookings).toEqual([]);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: created.body.booking.id } })).status).toBe("REQUESTED");
    expect(await prisma.notification.count({ where: { bookingId: created.body.booking.id } })).toBe(notifications);
    const later = await data.slot(1440, 1680);
    expect((await data.create(later.id, later.startsAt.toISOString())).status).toBe(201);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: created.body.booking.id } })).status).toBe("REQUESTED");
    expect((await request(app).delete(`/api/sitters/me/availability/${slot.id}`).set("Authorization", data.sitter.auth)).status).toBe(204);
    const replacement = await data.slot();
    // The expired request still references an archived slot. A new reservation
    // must release that concrete conflict without a global cleanup beforehand.
    expect((await data.create(replacement.id, data.interval(60, 90).startsAt)).status).toBe(201);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: created.body.booking.id } })).status).toBe("EXPIRED");
  });

  it("bounds calendar reads by dates and paginates both public and private schedules", async () => {
    const data = await fixture();
    const slots = await Promise.all([data.slot(), data.slot(1440, 1680), data.slot(2880, 3120), data.slot(1440 * 90, 1440 * 90 + 240)]);
    const window = { from: data.interval(0, 1).startsAt, to: data.interval(0, 4320).endsAt, limit: 2 };
    const publicFirst = await request(app).get(data.publicUrl).query(window);
    expect(publicFirst.status).toBe(200); expect(publicFirst.body.availability).toHaveLength(2); expect(publicFirst.body.nextCursor).toBeTruthy();
    const publicLast = await request(app).get(data.publicUrl).query({ ...window, cursor: publicFirst.body.nextCursor });
    expect(publicLast.body.availability).toHaveLength(1); expect(publicLast.body.nextCursor).toBeNull();
    expect(new Set([...publicFirst.body.availability, ...publicLast.body.availability].map((item: { id: string }) => item.id)).size).toBe(3);
    const ownFirst = await request(app).get("/api/sitters/me/schedule").set("Authorization", data.sitter.auth).query(window);
    expect(ownFirst.status).toBe(200); expect(ownFirst.body.slots).toHaveLength(2);
    const ownLast = await request(app).get("/api/sitters/me/schedule").set("Authorization", data.sitter.auth).query({ ...window, cursor: ownFirst.body.nextCursor });
    expect(ownLast.body.slots).toHaveLength(1); expect(ownLast.body.nextCursor).toBeNull();
    expect((await request(app).get("/api/sitters/me/schedule").query(window)).status).toBe(401);
    expect((await request(app).get("/api/sitters/me/schedule").set("Authorization", data.stranger.auth).query(window)).status).toBe(404);
    const ownProfile = await request(app).get("/api/sitters/me").set("Authorization", data.sitter.auth);
    expect(ownProfile.body.profile.availability.some((item: { id: string }) => item.id === slots[3].id)).toBe(false);
    for (const invalid of [{ ...window, to: data.interval(0, 63 * 1440).endsAt }, { limit: 201 }, { from: window.from }]) {
      expect((await request(app).get(data.publicUrl).query(invalid)).status).toBe(400);
      expect((await request(app).get("/api/sitters/me/schedule").set("Authorization", data.sitter.auth).query(invalid)).status).toBe(400);
    }
  });
});
