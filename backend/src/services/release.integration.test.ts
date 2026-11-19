import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../app";
import { prisma } from "../config/prisma";
import { signAccessToken } from "../utils/tokens";
import { completePetFixture } from "../test-fixtures";
import { vaccinationDateCutoff } from "./pets.service";

const ids: string[] = [];
async function account(role: "USER" | "ADMIN" = "USER") {
  const item = await prisma.account.create({ data: { email: `${randomUUID()}@release.test`, role, emailVerifiedAt: new Date() } });
  ids.push(item.id); return { id: item.id, auth: `Bearer ${signAccessToken(item.id, role)}` };
}
async function fixture(priceCents = 2500, latitude = 52.23, startsAt = new Date(Date.now() + 48 * 3_600_000)) {
  const owner = await account(), sitter = await account(), stranger = await account(), admin = await account("ADMIN");
  const pet = await prisma.pet.create({ data: { ...completePetFixture(), accountId: owner.id, name: "Figa", gender: "FEMALE" } });
  const profile = await prisma.sitterProfile.create({ data: { verificationStatus: "VERIFIED", accountId: sitter.id, bio: "Opieka nad zwierzętami testowa", city: "Warszawa", latitude, longitude: 21.01, serviceRadiusKm: 100,
    services: { create: { type: "DOG_WALK", durationMinutes: 30, priceCents } } }, include: { services: true } });
  const slot = await prisma.availabilitySlot.create({ data: { sitterProfileId: profile.id, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000) } });
  const payload = { petId: pet.id, sitterServiceId: profile.services[0].id, availabilitySlotId: slot.id, pickupAddress: "Warszawa, Testowa 17" };
  const create = (body = payload, key = randomUUID()) => request(app).post("/api/bookings").set("Authorization", owner.auth).set("Idempotency-Key", key).send(body);
  return { owner, sitter, stranger, admin, pet, profile, slot, payload, create };
}
afterEach(async () => {
  await prisma.bookingIssue.deleteMany({ where: { reporterAccountId: { in: ids } } });
  await prisma.booking.deleteMany({ where: { OR: [{ ownerAccountId: { in: ids } }, { sitterAccountId: { in: ids } }] } });
  await prisma.account.deleteMany({ where: { id: { in: ids.splice(0) } } });
});
afterAll(() => prisma.$disconnect());

describe("release booking and pet flows", () => {
  it("treats document dates as Polish calendar days across UTC midnight and DST", () => {
    expect(vaccinationDateCutoff(new Date("2026-11-17T23:30:00Z")).toISOString()).toBe("2026-11-18T00:00:00.000Z");
    expect(vaccinationDateCutoff(new Date("2026-06-17T22:30:00Z")).toISOString()).toBe("2026-06-18T00:00:00.000Z");
  });
  it("requires a pickup address, keeps it private and includes it in idempotency", async () => {
    const f = await fixture(), key = randomUUID();
    for (const pickupAddress of [undefined, "   ", "abcd", "x".repeat(501)]) expect((await f.create({ ...f.payload, pickupAddress } as typeof f.payload)).status).toBe(400);
    const created = await f.create(f.payload, key); expect(created.status).toBe(201);
    const id = created.body.booking.id;
    for (const auth of [f.owner.auth, f.sitter.auth]) {
      const detail = await request(app).get(`/api/bookings/${id}`).set("Authorization", auth);
      expect(detail.body.booking.pickupAddress).toBe(f.payload.pickupAddress); expect(detail.headers["cache-control"]).toBe("no-store");
    }
    expect((await request(app).get(`/api/bookings/${id}`).set("Authorization", f.stranger.auth)).status).toBe(404);
    expect((await f.create({ ...f.payload, pickupAddress: "Kraków, Inna 2" }, key)).body.error).toBe("IDEMPOTENCY_KEY_REUSED");
    const publicProfile = await request(app).get("/api/sitters").query({ latitude: 52.23, longitude: 21.01 });
    expect(JSON.stringify(publicProfile.body)).not.toContain(f.payload.pickupAddress);
  });

  it("shares current care instructions with participants during an accepted free walk", async () => {
    const f = await fixture(0, 52.23, new Date(Date.now() + 10 * 60_000));
    const created = await f.create();
    expect(created.status).toBe(201);
    expect(created.body.booking.paymentRequired).toBe(false);
    const base = `/api/bookings/${created.body.booking.id}`;
    const detail = (auth: string) => request(app).get(base).set("Authorization", auth);
    const summary = { id: f.pet.id, name: f.pet.name, breed: f.pet.breed };
    expect((await detail(f.sitter.auth)).body.booking.pet).toEqual(summary);
    await request(app).patch(`${base}/status`).set("Authorization", f.sitter.auth).send({ status: "ACCEPTED" }).expect(200);

    const care = { temperament: "Spokojna", mobilityRestrictions: "Unikać schodów", careInstructions: "Zabierz wodę" };
    expect((await detail(f.sitter.auth)).body.booking.pet.careInstructions).toBeNull();
    await request(app).patch(`/api/pets/${f.pet.id}`).set("Authorization", f.owner.auth).send(care).expect(200);
    for (const auth of [f.owner.auth, f.sitter.auth]) {
      const response = await detail(auth).expect(200);
      expect(response.headers["cache-control"]).toContain("no-store");
      expect(response.body.booking.pet).toEqual({ ...summary, ...care });
    }
    await detail(f.stranger.auth).expect(404);
    await request(app).get(base).expect(401);
    const list = await request(app).get("/api/bookings").set("Authorization", f.sitter.auth).expect(200);
    expect(list.body.items[0].pet).toEqual(summary);

    await request(app).post(`${base}/walk/start`).set("Authorization", f.sitter.auth).expect(200);
    const point = { clientPointId: randomUUID(), latitude: 52.23, longitude: 21.01, accuracy: 5, capturedAt: new Date().toISOString() };
    await request(app).post(`${base}/walk/points`).set("Authorization", f.sitter.auth).send({ points: [point] }).expect(200);
    await request(app).post(`${base}/walk/finish`).set("Authorization", f.sitter.auth).send({}).expect(200);
    expect((await detail(f.owner.auth)).body.booking.status).toBe("COMPLETED");
    expect((await detail(f.sitter.auth)).body.booking.pet).toEqual(summary);
  });

  it("allows a draft pet, blocks an incomplete profile and checks vaccination validity on the booked day", async () => {
    const f = await fixture();
    await prisma.pet.update({ where: { id: f.pet.id }, data: { size: null, temperament: null } });
    let response = await f.create(); expect(response.status).toBe(409); expect(response.body.error).toBe("PET_PROFILE_INCOMPLETE");
    expect(response.body.message).toContain("temperament");
    await prisma.pet.update({ where: { id: f.pet.id }, data: { size: "MEDIUM", temperament: "Spokojny" } });
    await prisma.petDocument.updateMany({ where: { petId: f.pet.id }, data: { expiresAt: new Date(Date.now() + 86_400_000) } });
    response = await f.create(); expect(response.body.error).toBe("PET_PROFILE_INCOMPLETE");
    await prisma.petDocument.updateMany({ where: { petId: f.pet.id }, data: { expiresAt: null } });
    expect((await f.create()).status).toBe(201);
    const draft = await request(app).post("/api/pets").set("Authorization", f.owner.auth).send({ name: "Luna", gender: "FEMALE" });
    expect(draft.status).toBe(201); expect(draft.body.pet.missingFields).toContain("potwierdzenie szczepień");
  });

  it("uploads a private vaccination image, validates bytes and seals it against later PUT reuse", async () => {
    const f = await fixture(), base = `/api/pets/${f.pet.id}/documents`, bytes = Buffer.from([255, 216, 255, 217]);
    const prepared = await request(app).post(`${base}/upload`).set("Authorization", f.owner.auth).send({ name: "Szczepienia.jpg", sizeBytes: bytes.length, contentType: "image/jpeg", purpose: "VACCINATION" });
    expect(prepared.status).toBe(201);
    const file = prepared.body.document;
    expect((await request(app).patch(`${base}/${file.id}`).set("Authorization", f.stranger.auth).send({})).status).toBe(404);
    expect((await request(app).patch(`${base}/${file.id}`).set("Authorization", f.owner.auth).send({})).body.error).toBe("INVALID_DOCUMENT_UPLOAD");
    expect((await fetch(prepared.body.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: bytes })).status).toBe(200);
    const confirmed = await request(app).patch(`${base}/${file.id}`).set("Authorization", f.owner.auth).send({}); expect(confirmed.status).toBe(200);
    await fetch(prepared.body.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: Buffer.from([255, 216, 255, 0]) });
    expect((await request(app).patch(`${base}/${file.id}`).set("Authorization", f.owner.auth).send({})).status).toBe(200);
    const link = await request(app).get(`${base}/${file.id}/download`).set("Authorization", f.owner.auth);
    const downloaded = await fetch(link.body.url); expect(downloaded.headers.get("content-type")).toBe("image/jpeg");
    expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(bytes);
    expect((await fetch(link.body.url.split("?")[0])).status).toBe(403);
    expect((await request(app).get(`${base}/${file.id}/download`).set("Authorization", f.stranger.auth)).status).toBe(404);
  });

  it("filters by the matching service price and actual completed walks before pagination", async () => {
    const near = await fixture(1000), far = await fixture(3000, 52.24);
    await prisma.sitterService.create({ data: { sitterProfileId: far.profile.id, type: "DROP_IN", durationMinutes: 30, priceCents: 500 } });
    const query = { latitude: 52.23, longitude: 21.01, radiusKm: 100, serviceType: "DOG_WALK", pageSize: 1 };
    const search = (extra: Record<string, number>) => request(app).get("/api/sitters").query({ ...query, ...extra });
    expect((await search({ minPriceCents: 1500, maxPriceCents: 4000 })).body.items[0].id).toBe(far.profile.id);
    expect((await search({ maxPriceCents: 1500 })).body.items[0].id).toBe(near.profile.id);
    expect((await search({ minPriceCents: 4000, maxPriceCents: 1500 })).status).toBe(400);
    expect((await search({ minCompletedWalks: 1 })).body.pagination.total).toBe(0);
    await prisma.booking.create({ data: { ownerAccountId: far.owner.id, sitterAccountId: far.sitter.id, petId: far.pet.id, sitterServiceId: far.profile.services[0].id,
      availabilitySlotId: far.slot.id, status: "COMPLETED", startsAt: new Date(Date.now() - 3_600_000), endsAt: new Date(Date.now() - 60_000), expiresAt: new Date(), priceCents: 3000 } });
    const experienced = await search({ minCompletedWalks: 1 }); expect(experienced.body.pagination.total).toBe(1); expect(experienced.body.items[0].id).toBe(far.profile.id);
    expect((await search({ page: 2 })).body.items[0].id).toBe(far.profile.id);
  });

  it("keeps reports private, deduplicates retries and audits versioned admin decisions", async () => {
    const f = await fixture(), created = await f.create(); expect(created.status).toBe(201);
    const id = created.body.booking.id, base = `/api/bookings/${id}/issue`;
    const input = { category: "NO_SHOW", description: "Opiekun nie pojawił się na miejscu." };
    const send = (auth = f.owner.auth, body = input) => request(app).post(base).set("Authorization", auth).send(body);
    expect((await send()).body.error).toBe("ISSUE_NOT_AVAILABLE");
    await prisma.booking.update({ where: { id }, data: { status: "CANCELLED", activeSlotKey: null } });
    expect((await send(f.stranger.auth)).status).toBe(404); expect((await send(f.sitter.auth)).status).toBe(404);
    const sent = await Promise.all([send(), send()]); expect(sent.map(result => result.status)).toEqual([201, 201]);
    const issue = sent[0].body.issue; expect(sent[1].body.issue.id).toBe(issue.id);
    expect((await send(f.owner.auth, { ...input, description: "Inne zgłoszenie dotyczące usługi." })).status).toBe(409);
    expect((await request(app).get(base).set("Authorization", f.sitter.auth)).status).toBe(404);
    expect((await request(app).get("/api/admin/issues").set("Authorization", f.owner.auth)).status).toBe(403);
    const list = await request(app).get("/api/admin/issues").set("Authorization", f.admin.auth).query({ status: "OPEN" });
    expect(list.body.items.some((item: { id: string }) => item.id === issue.id)).toBe(true); expect(list.headers["cache-control"]).toBe("no-store");
    const decide = (version: number, status = "RESOLVED") => request(app).patch(`/api/admin/issues/${issue.id}`).set("Authorization", f.admin.auth).send({ version, status, resolution: "Sprawdziliśmy zgłoszenie i skontaktowaliśmy się z opiekunem." });
    expect((await decide(1, "IN_REVIEW")).status).toBe(200); expect((await decide(1)).status).toBe(409);
    expect((await decide(2)).status).toBe(200); expect((await decide(3, "IN_REVIEW")).status).toBe(409);
    expect((await request(app).get(base).set("Authorization", f.owner.auth)).body.issue.status).toBe("RESOLVED");
    expect(await prisma.auditLog.count({ where: { targetAccountId: f.owner.id, action: "BOOKING_ISSUE_REVIEWED" } })).toBe(2);
    expect(await prisma.notification.count({ where: { accountId: f.owner.id, type: "ISSUE_UPDATED" } })).toBe(2);
  });
});
