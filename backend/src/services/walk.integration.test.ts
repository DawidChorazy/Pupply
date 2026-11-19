import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../app";
import { prisma } from "../config/prisma";
import { signAccessToken } from "../utils/tokens";
import { setAccountState } from "./account.service";

const ids: string[] = [];
async function account(role: "USER" | "ADMIN" | "CLINIC" = "USER") {
  const row = await prisma.account.create({ data: { role, email: `${randomUUID()}@gps.test`, emailVerifiedAt: new Date() } });
  ids.push(row.id); return { id: row.id, auth: `Bearer ${signAccessToken(row.id, role)}` };
}
async function fixture() {
  const owner = await account(), sitter = await account(), stranger = await account();
  const profile = await prisma.sitterProfile.create({ data: { verificationStatus: "VERIFIED", accountId: sitter.id, bio: "Spacery", city: "Warszawa", latitude: 52, longitude: 21,
    services: { create: { type: "DOG_WALK", durationMinutes: 30, priceCents: 3000 } } }, include: { services: true } });
  const slot = await prisma.availabilitySlot.create({ data: { sitterProfileId: profile.id, startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 86_400_000) } });
  const pet = await prisma.pet.create({ data: { accountId: owner.id, name: "Pies", gender: "MALE" } });
  const makeBooking = (offset = -5) => prisma.booking.create({ data: { ownerAccountId: owner.id, sitterAccountId: sitter.id, petId: pet.id,
    pickupAddress: "Warszawa, Testowa 1", sitterServiceId: profile.services[0].id, availabilitySlotId: slot.id, status: "ACCEPTED", startsAt: new Date(Date.now() + offset * 60_000),
    endsAt: new Date(Date.now() + (offset + 30) * 60_000), expiresAt: new Date(), priceCents: 3000 } });
  return { owner, sitter, stranger, profile, booking: await makeBooking(), makeBooking };
}
const api = (id: string) => `/api/bookings/${id}/walk`;
const start = (id: string, auth: string) => request(app).post(`${api(id)}/start`).set("Authorization", auth).send({});
const finish = (id: string, auth: string) => request(app).post(`${api(id)}/finish`).set("Authorization", auth).send({});
const send = (id: string, auth: string, points: object[]) => request(app).post(`${api(id)}/points`).set("Authorization", auth).send({ points });
const point = (capturedAt: number, latitude = 52, longitude = 21) => ({ clientPointId: randomUUID(), capturedAt: new Date(capturedAt).toISOString(), latitude, longitude, accuracy: 5 });
async function started(f: Awaited<ReturnType<typeof fixture>>) {
  expect((await start(f.booking.id, f.sitter.auth)).status).toBe(200);
  const at = Date.now() - 60_000;
  await prisma.walkSession.update({ where: { bookingId: f.booking.id }, data: { startedAt: new Date(at) } });
  return at;
}
afterEach(async () => {
  await prisma.booking.deleteMany({ where: { OR: [{ ownerAccountId: { in: ids } }, { sitterAccountId: { in: ids } }] } });
  await prisma.account.deleteMany({ where: { id: { in: ids.splice(0) } } });
});
afterAll(() => prisma.$disconnect());

describe("private GPS walk tracking", () => {
  it("records actual time, route and server distance, completes the booking and sends one notification per transition", async () => {
    const f = await fixture(), at = await started(f);
    const points = [point(at + 1000), point(at + 31_000, 52.0005)];
    const uploaded = await send(f.booking.id, f.sitter.auth, points);
    expect(uploaded.status).toBe(200); expect(uploaded.body.session.lastSequence).toBe(2);
    expect(uploaded.body.session.distanceMeters).toBeCloseTo(55.6, 0);
    const route = await request(app).get(api(f.booking.id)).set("Authorization", f.owner.auth);
    expect(route.status).toBe(200); expect(route.headers["cache-control"]).toBe("no-store");
    expect(route.body.points.map((p: { segmentStart: boolean }) => p.segmentStart)).toEqual([true, false]);
    expect((await finish(f.booking.id, f.sitter.auth)).body.session.endReason).toBe("COMPLETED");
    expect((await finish(f.booking.id, f.sitter.auth)).status).toBe(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).status).toBe("COMPLETED");
    expect(await prisma.notification.count({ where: { bookingId: f.booking.id, type: "WALK_STARTED" } })).toBe(1);
    expect(await prisma.notification.count({ where: { bookingId: f.booking.id, type: "BOOKING_COMPLETED" } })).toBe(1);
    expect((await send(f.booking.id, f.sitter.auth, points)).status).toBe(200);
    expect((await send(f.booking.id, f.sitter.auth, [point(Date.now())])).body.error).toBe("WALK_ENDED");
  });
  it("allows reading only by participants, and recording only by the sitter, with active verified accounts", async () => {
    const f = await fixture(), clinic = await account("CLINIC");
    expect((await request(app).get(api(f.booking.id))).status).toBe(401);
    expect((await start(f.booking.id, f.owner.auth)).status).toBe(403);
    expect((await start(f.booking.id, f.stranger.auth)).status).toBe(404);
    expect((await start(f.booking.id, clinic.auth)).status).toBe(403);
    expect((await request(app).get(api(f.booking.id)).set("Authorization", f.stranger.auth)).status).toBe(404);
    await started(f);
    expect((await send(f.booking.id, f.owner.auth, [point(Date.now())])).status).toBe(403);
    expect((await finish(f.booking.id, f.owner.auth)).status).toBe(403);
    await prisma.account.update({ where: { id: f.sitter.id }, data: { emailVerifiedAt: null } });
    expect((await start(f.booking.id, f.sitter.auth)).body.error).toBe("EMAIL_NOT_VERIFIED");
    await prisma.account.update({ where: { id: f.owner.id }, data: { blockedAt: new Date() } });
    expect((await request(app).get(api(f.booking.id)).set("Authorization", f.owner.auth)).status).toBe(401);
  });
  it("does not start unaccepted, closed, future, stale or non-walk reservations", async () => {
    const f = await fixture();
    for (const status of ["REQUESTED", "REJECTED", "CANCELLED", "COMPLETED", "EXPIRED"] as const) {
      await prisma.booking.update({ where: { id: f.booking.id }, data: { status } });
      expect((await start(f.booking.id, f.sitter.auth)).status).toBe(409);
    }
    await prisma.booking.update({ where: { id: f.booking.id }, data: { status: "ACCEPTED", startsAt: new Date(Date.now() + 3_600_000), endsAt: new Date(Date.now() + 5_400_000) } });
    expect((await start(f.booking.id, f.sitter.auth)).body.error).toBe("WALK_OUTSIDE_WINDOW");
    await prisma.booking.update({ where: { id: f.booking.id }, data: { startsAt: new Date(Date.now() - 6 * 3_600_000), endsAt: new Date(Date.now() - 5 * 3_600_000) } });
    expect((await start(f.booking.id, f.sitter.auth)).body.error).toBe("WALK_OUTSIDE_WINDOW");
    await prisma.sitterService.update({ where: { id: f.profile.services[0].id }, data: { type: "DROP_IN" } });
    expect((await start(f.booking.id, f.sitter.auth)).body.error).toBe("NOT_A_WALK");
    expect(await prisma.walkSession.count({ where: { bookingId: f.booking.id } })).toBe(0);
  });
  it("starts and uploads idempotently under concurrent retries, rejecting changed point IDs atomically", async () => {
    const f = await fixture();
    const starts = await Promise.all([start(f.booking.id, f.sitter.auth), start(f.booking.id, f.sitter.auth)]);
    expect(starts.map(r => r.status)).toEqual([200, 200]); expect(starts[0].body.session.id).toBe(starts[1].body.session.id);
    const at = await started(f), p = point(at + 1000);
    const uploads = await Promise.all([send(f.booking.id, f.sitter.auth, [p]), send(f.booking.id, f.sitter.auth, [p])]);
    expect(uploads.map(r => r.status)).toEqual([200, 200]);
    const conflict = await send(f.booking.id, f.sitter.auth, [point(at + 2000), { ...p, latitude: 53 }]);
    expect(conflict.body.error).toBe("POINT_ID_REUSED");
    expect((await prisma.walkSession.findUniqueOrThrow({ where: { bookingId: f.booking.id } })).lastSequence).toBe(1);
  });
  it("validates coordinates, accuracy, batch bounds, chronology, and server-derived times without partial writes", async () => {
    const f = await fixture(), at = await started(f), p = point(at + 1000);
    for (const points of [[], Array.from({ length: 101 }, () => p), [{ ...p, latitude: 91 }], [{ ...p, longitude: -181 }],
      [{ ...p, accuracy: 101 }], [{ ...p, accuracy: -1 }], [{ ...p, clientPointId: "bad" }], [{ ...p, distanceMeters: 999 }],
      [{ ...p, capturedAt: "bad" }], [point(Date.now() + 60_000)], [point(at - 20_000)], [p, point(at - 20_000)]]) {
      expect((await send(f.booking.id, f.sitter.auth, points)).status).toBe(400);
    }
    expect((await send(f.booking.id, f.sitter.auth, [p])).status).toBe(200);
    expect((await send(f.booking.id, f.sitter.auth, [point(at + 500)])).body.error).toBe("INVALID_POINT_TIME");
    expect((await prisma.walkSession.findUniqueOrThrow({ where: { bookingId: f.booking.id } })).lastSequence).toBe(1);
  });
  it("marks GPS outages and impossible jumps as separate segments and excludes their distances", async () => {
    const f = await fixture(); await started(f);
    const at = Date.now() - 600_000;
    await prisma.walkSession.update({ where: { bookingId: f.booking.id }, data: { startedAt: new Date(at) } });
    const result = await send(f.booking.id, f.sitter.auth, [point(at + 1000), point(at + 1001, 53), point(at + 300_000, 54), point(at + 330_000, 54.0005)]);
    expect(result.status).toBe(200); expect(result.body.session.distanceMeters).toBeCloseTo(55.6, 0);
    const route = await request(app).get(api(f.booking.id)).set("Authorization", f.owner.auth);
    expect(route.body.points.map((p: { segmentStart: boolean }) => p.segmentStart)).toEqual([true, true, true, false]);
  });
  it("permits only one active walk per sitter and releases the slot after finishing", async () => {
    const f = await fixture(), second = await f.makeBooking(-40);
    const results = await Promise.all([start(f.booking.id, f.sitter.auth), start(second.id, f.sitter.auth)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    const firstId = results[0].status === 200 ? f.booking.id : second.id, otherId = firstId === f.booking.id ? second.id : f.booking.id;
    expect((await finish(firstId, f.sitter.auth)).status).toBe(200);
    expect((await start(otherId, f.sitter.auth)).status).toBe(200);
  });
  it("accumulates slow movement across upload batches without counting stationary jitter", async () => {
    const f = await fixture(), at = await started(f);
    const sample = (offset: number, lat: number) => ({ ...point(at + offset, lat), accuracy: 20 });
    await send(f.booking.id, f.sitter.auth, [sample(1000, 52), sample(6000, 52.00001)]);
    const still = await send(f.booking.id, f.sitter.auth, [sample(11000, 52.00002)]);
    expect(still.body.session.distanceMeters).toBe(0);
    const walking = await send(f.booking.id, f.sitter.auth, [sample(16000, 52.00005), sample(21000, 52.0001)]);
    expect(walking.body.session.distanceMeters).toBeCloseTo(11.12, 0);
  });
  it("closes tracking atomically on cancellation and prevents further location uploads", async () => {
    const f = await fixture(), at = await started(f);
    await send(f.booking.id, f.sitter.auth, [point(at + 1000)]);
    const cancelled = await request(app).patch(`/api/bookings/${f.booking.id}/status`).set("Authorization", f.owner.auth).send({ status: "CANCELLED" });
    expect(cancelled.status).toBe(200); expect(cancelled.body.booking.walkSession.endReason).toBe("CANCELLED");
    expect((await send(f.booking.id, f.sitter.auth, [point(Date.now())])).status).toBe(409);
    expect((await start(f.booking.id, f.sitter.auth)).status).toBe(409);
    expect((await request(app).get(api(f.booking.id)).set("Authorization", f.owner.auth)).body.points).toHaveLength(1);
  });
  it("stops tracking on account deactivation and guards legacy completion while GPS is active", async () => {
    const f = await fixture(); await started(f);
    await prisma.booking.update({ where: { id: f.booking.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    const legacy = await request(app).patch(`/api/bookings/${f.booking.id}/status`).set("Authorization", f.sitter.auth).send({ status: "COMPLETED" });
    expect(legacy.body.error).toBe("WALK_ACTIVE");
    const admin = await account("ADMIN"); await setAccountState(admin.id, f.owner.id, "DEACTIVATE");
    expect((await prisma.walkSession.findUniqueOrThrow({ where: { bookingId: f.booking.id } })).endReason).toBe("CANCELLED");
  });
  it("serializes finish versus upload without recording points after closure", async () => {
    const f = await fixture(), at = await started(f);
    const [upload, ended] = await Promise.all([send(f.booking.id, f.sitter.auth, [point(at + 1000)]), finish(f.booking.id, f.sitter.auth)]);
    expect([200, 409]).toContain(upload.status); expect(ended.status).toBe(200);
    const session = await prisma.walkSession.findUniqueOrThrow({ where: { bookingId: f.booking.id } });
    expect(session.lastSequence).toBe(upload.status === 200 ? 1 : 0); expect(session.endedAt).not.toBeNull();
  });
  it("paginates the route by sequence without exposing it in booking lists or public sitter search", async () => {
    const f = await fixture(), at = await started(f);
    const session = await prisma.walkSession.findUniqueOrThrow({ where: { bookingId: f.booking.id } });
    await prisma.walkPoint.createMany({ data: Array.from({ length: 501 }, (_, index) => ({ ...point(at + index), capturedAt: new Date(at + index), sessionId: session.id, sequence: index + 1, segmentStart: index === 0 })) });
    await prisma.walkSession.update({ where: { id: session.id }, data: { lastSequence: 501 } });
    const first = await request(app).get(api(f.booking.id)).set("Authorization", f.owner.auth);
    expect(first.body.points).toHaveLength(500); expect(first.body.nextAfter).toBe(500);
    const second = await request(app).get(`${api(f.booking.id)}?after=500`).set("Authorization", f.owner.auth);
    expect(second.body.points).toHaveLength(1); expect(second.body.points[0].sequence).toBe(501); expect(second.body.nextAfter).toBeNull();
    const list = await request(app).get("/api/bookings").set("Authorization", f.owner.auth);
    expect(list.body.items[0].walkSession).not.toHaveProperty("points");
    expect((await request(app).get(`${api(f.booking.id)}?after=-1`).set("Authorization", f.owner.auth)).status).toBe(400);
  });
  it("preserves the offline finish timestamp and replays it without extending the walk", async () => {
    const f = await fixture(), at = await started(f);
    await send(f.booking.id, f.sitter.auth, [point(at + 1000), point(at + 30_000, 52.0001)]);
    const endedAt = new Date(at + 40_000).toISOString();
    const finishAt = (value: string) => request(app).post(`${api(f.booking.id)}/finish`).set("Authorization", f.sitter.auth).send({ endedAt: value });
    const first = await finishAt(endedAt); expect(first.status).toBe(200); expect(first.body.session.endedAt).toBe(endedAt);
    const retry = await finishAt(new Date().toISOString()); expect(retry.status).toBe(200); expect(retry.body.session.endedAt).toBe(endedAt);
    expect(await prisma.notification.count({ where: { bookingId: f.booking.id, type: "BOOKING_COMPLETED" } })).toBe(1);
  });
  it("rejects end timestamps before start, before the final sample, in the future or malformed, without completing the booking", async () => {
    const f = await fixture(), at = await started(f);
    await send(f.booking.id, f.sitter.auth, [point(at + 30_000)]);
    for (const value of [new Date(at - 1).toISOString(), new Date(at + 20_000).toISOString(), new Date(Date.now() + 60_000).toISOString(), "wrong"]) {
      const response = await request(app).post(`${api(f.booking.id)}/finish`).set("Authorization", f.sitter.auth).send({ endedAt: value });
      expect(response.status).toBe(400);
    }
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).status).toBe("ACCEPTED");
    expect((await prisma.walkSession.findUniqueOrThrow({ where: { bookingId: f.booking.id } })).endedAt).toBeNull();
  });
});
