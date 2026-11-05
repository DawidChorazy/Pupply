import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../app";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { signAccessToken } from "../utils/tokens";
import { expireBookingRequests } from "./booking-expiry.service";
import { sendDocumentReminders } from "./maintenance.service";

const ids: string[] = [];
async function user(verified = true) {
  const account = await prisma.account.create({ data: {
    email: `${randomUUID()}@reliability.test`, role: "USER", emailVerifiedAt: verified ? new Date() : null,
    userProfile: { create: { fullName: "Test User", phone: "+48123456789" } }
  } });
  ids.push(account.id);
  return { id: account.id, auth: `Bearer ${signAccessToken(account.id, "USER")}` };
}
async function fixture() {
  const owner = await user(), sitter = await user();
  const pet = await prisma.pet.create({ data: { accountId: owner.id, name: "Figa", gender: "FEMALE" } });
  const profile = await prisma.sitterProfile.create({ data: {
    accountId: sitter.id, bio: "Opieka testowa nad zwierzętami", city: "Warszawa", latitude: 52.23, longitude: 21.01,
    services: { create: { type: "DOG_WALK", durationMinutes: 30, priceCents: 3000 } }
  }, include: { services: true } });
  const startsAt = new Date(Date.now() + 48 * 3_600_000);
  const slot = await prisma.availabilitySlot.create({ data: { sitterProfileId: profile.id, startsAt, endsAt: new Date(startsAt.getTime() + 90 * 60_000) } });
  const payload = { petId: pet.id, sitterServiceId: profile.services[0].id, availabilitySlotId: slot.id };
  return { owner, sitter, pet, profile, slot, payload };
}
afterEach(async () => {
  await prisma.booking.deleteMany({ where: { OR: [{ ownerAccountId: { in: ids } }, { sitterAccountId: { in: ids } }] } });
  await prisma.account.deleteMany({ where: { id: { in: ids.splice(0) } } });
});
afterAll(() => prisma.$disconnect());

describe("backend reliability", () => {
  it("returns 400 for malformed JSON and 413 for oversized payloads", async () => {
    expect((await request(app).post("/api/auth/login").set("Content-Type", "application/json").send('{"email":')).status).toBe(400);
    expect((await request(app).post("/api/auth/login").send({ content: "x".repeat(1_100_000) })).status).toBe(413);
  });
  it("requires verified email for booking and offering care", async () => {
    const data = await fixture();
    await prisma.account.update({ where: { id: data.owner.id }, data: { emailVerifiedAt: null } });
    const response = await request(app).post("/api/bookings").set("Authorization", data.owner.auth).send(data.payload);
    expect(response.status).toBe(403); expect(response.body.error).toBe("EMAIL_NOT_VERIFIED");
    expect((await request(app).post("/api/sitters/me").set("Authorization", data.owner.auth).send({
      bio: "Opiekun z doświadczeniem w opiece", city: "Warszawa", latitude: 52, longitude: 21,
      services: [{ type: "DOG_WALK", durationMinutes: 30, priceCents: 1000 }]
    })).status).toBe(403);
  });
  it("serializes overlapping availability and protects direct database writes", async () => {
    const { sitter, profile, slot } = await fixture();
    const start = new Date(slot.endsAt.getTime() + 3_600_000);
    const create = (offset: number) => request(app).post("/api/sitters/me/availability").set("Authorization", sitter.auth)
      .send({ startsAt: new Date(start.getTime() + offset).toISOString(), endsAt: new Date(start.getTime() + offset + 3_600_000).toISOString() });
    const responses = await Promise.all([create(0), create(30 * 60_000)]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
    await expect(prisma.availabilitySlot.create({ data: { sitterProfileId: profile.id, startsAt: new Date(slot.startsAt.getTime() + 60_000), endsAt: slot.endsAt } })).rejects.toThrow();
  });
  it("allows adjacent bookings, rejects concurrent overlaps and returns the remaining interval", async () => {
    const { owner, slot, payload } = await fixture();
    const create = (startsAt: Date) => request(app).post("/api/bookings").set("Authorization", owner.auth).send({ ...payload, startsAt: startsAt.toISOString() });
    const responses = await Promise.all([create(slot.startsAt), create(slot.startsAt)]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
    const booking = responses.find(r => r.status === 201)!.body.booking;
    expect(Date.parse(booking.endsAt) - Date.parse(booking.startsAt)).toBe(30 * 60_000);
    expect((await create(new Date(slot.startsAt.getTime() + 30 * 60_000))).status).toBe(201);
    const search = await request(app).get("/api/sitters").query({ latitude: 52.23, longitude: 21.01, serviceType: "DOG_WALK", pageSize: 1 });
    expect(search.status).toBe(200);
    expect(search.body.items[0].availability[0].startsAt).toBe(new Date(slot.startsAt.getTime() + 60 * 60_000).toISOString());
    expect(search.body.items[0]).not.toHaveProperty("latitude");
  });
  it("expires unanswered requests once, notifies both parties and releases time", async () => {
    const { owner, sitter, payload } = await fixture();
    const created = await request(app).post("/api/bookings").set("Authorization", owner.auth).send(payload);
    const id = created.body.booking.id;
    await prisma.booking.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await Promise.all([expireBookingRequests(), expireBookingRequests()]);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id } })).status).toBe("EXPIRED");
    expect(await prisma.notification.count({ where: { bookingId: id, type: "BOOKING_EXPIRED" } })).toBe(2);
    expect((await request(app).patch(`/api/bookings/${id}/status`).set("Authorization", sitter.auth).send({ status: "ACCEPTED" })).status).toBe(409);
    expect((await request(app).post("/api/bookings").set("Authorization", owner.auth).send(payload)).status).toBe(201);
  });
  it("refuses accepting a request whose scheduled start has passed", async () => {
    const { owner, sitter, payload } = await fixture();
    const created = await request(app).post("/api/bookings").set("Authorization", owner.auth).send(payload);
    const id = created.body.booking.id;
    await prisma.booking.update({ where: { id }, data: { startsAt: new Date(Date.now() - 3_600_000), endsAt: new Date(Date.now() - 1_800_000) } });
    expect((await request(app).patch(`/api/bookings/${id}/status`).set("Authorization", sitter.auth).send({ status: "ACCEPTED" })).status).toBe(409);
  });

  const storageIt = process.env.S3_ENDPOINT ? it : it.skip;
  storageIt("persists private PDFs, isolates ownership, sends reminders once and deletes objects", async () => {
    const owner = await user(), stranger = await user();
    const pet = await prisma.pet.create({ data: { accountId: owner.id, name: "Luna", gender: "FEMALE" } });
    const base = `/api/pets/${pet.id}/documents`;
    const bytes = Buffer.from("%PDF-1.4\nPupply test document\n%%EOF");
    const prepared = await request(app).post(`${base}/upload`).set("Authorization", owner.auth).send({ name: "Szczepienie.pdf", sizeBytes: bytes.length });
    expect(prepared.status).toBe(201);
    const document = prepared.body.document;
    expect((await fetch(prepared.body.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: bytes })).status).toBe(200);
    const unsigned = `${env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT}/${env.S3_DOCUMENT_BUCKET}/${document.objectKey}`;
    expect((await fetch(unsigned)).status).toBe(403);
    const expiresAt = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    expect((await request(app).patch(`${base}/${document.id}`).set("Authorization", owner.auth).send({ expiresAt, reminderDaysBefore: 7 })).status).toBe(200);
    const listed = await request(app).get(base).set("Authorization", owner.auth);
    expect(listed.body.documents).toHaveLength(1); expect(listed.body.documents[0].name).toBe("Szczepienie.pdf");
    expect((await request(app).get(`${base}/${document.id}/download`).set("Authorization", stranger.auth)).status).toBe(404);
    const downloaded = await request(app).get(`${base}/${document.id}/download`).set("Authorization", owner.auth);
    expect(downloaded.status).toBe(200); expect(await (await fetch(downloaded.body.url)).text()).toBe(bytes.toString());
    await Promise.all([sendDocumentReminders(), sendDocumentReminders()]);
    expect(await prisma.notification.count({ where: { accountId: owner.id, type: "DOCUMENT_EXPIRING" } })).toBe(1);
    expect((await request(app).delete(`${base}/${document.id}`).set("Authorization", stranger.auth)).status).toBe(404);
    expect((await request(app).delete(`${base}/${document.id}`).set("Authorization", owner.auth)).status).toBe(204);
    expect((await fetch(downloaded.body.url)).status).toBe(404);
  });
  storageIt("refuses forged PDF uploads and hides unfinished uploads", async () => {
    const owner = await user();
    const pet = await prisma.pet.create({ data: { accountId: owner.id, name: "Luna", gender: "FEMALE" } });
    const base = `/api/pets/${pet.id}/documents`;
    const bytes = Buffer.from("this is not a PDF");
    const prepared = await request(app).post(`${base}/upload`).set("Authorization", owner.auth).send({ name: "fake.pdf", sizeBytes: bytes.length });
    expect(prepared.status).toBe(201);
    await fetch(prepared.body.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: bytes });
    expect((await request(app).patch(`${base}/${prepared.body.document.id}`).set("Authorization", owner.auth).send({})).status).toBe(400);
    expect((await request(app).get(base).set("Authorization", owner.auth)).body.documents).toEqual([]);
    await request(app).delete(`${base}/${prepared.body.document.id}`).set("Authorization", owner.auth);
  });
});
