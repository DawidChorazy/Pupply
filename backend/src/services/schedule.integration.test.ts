import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../app";
import { prisma } from "../config/prisma";
import { signAccessToken } from "../utils/tokens";

const ids: string[] = [];
async function fixture() {
  const user = async () => {
    const account = await prisma.account.create({ data: { email: `${randomUUID()}@schedule.test`, role: "USER", emailVerifiedAt: new Date() } });
    ids.push(account.id);
    return { id: account.id, auth: `Bearer ${signAccessToken(account.id, "USER")}` };
  };
  const sitter = await user(), owner = await user();
  const profile = await prisma.sitterProfile.create({ data: {
    accountId: sitter.id, bio: "Opieka testowa nad zwierzętami", city: "Warszawa", latitude: 52.23, longitude: 21.01,
    services: { create: { type: "DOG_WALK", durationMinutes: 30, priceCents: 3000 } }
  }, include: { services: true } });
  const pet = await prisma.pet.create({ data: { accountId: owner.id, name: "Figa", gender: "FEMALE" } });
  const start = Date.now() + 48 * 3_600_000;
  const interval = (from: number, to: number) => ({ startsAt: new Date(start + from * 60_000).toISOString(), endsAt: new Date(start + to * 60_000).toISOString() });
  const batch = (slots: object[]) => request(app).post("/api/sitters/me/availability/batch").set("Authorization", sitter.auth).send({ slots });
  const publicUrl = `/api/sitters/${profile.id}/availability?sitterServiceId=${profile.services[0].id}`;
  return { sitter, owner, pet, profile, interval, batch, publicUrl };
}
afterEach(async () => {
  await prisma.booking.deleteMany({ where: { OR: [{ ownerAccountId: { in: ids } }, { sitterAccountId: { in: ids } }] } });
  await prisma.account.deleteMany({ where: { id: { in: ids.splice(0) } } });
});
afterAll(() => prisma.$disconnect());

describe("calendar schedule", () => {
  it("saves multiple days and split working hours with a break", async () => {
    const { batch, interval, publicUrl } = await fixture();
    const created = await batch([interval(0, 180), interval(240, 480), interval(1440, 1620), interval(1680, 1920)]);
    expect(created.status).toBe(201); expect(created.body.slots).toHaveLength(4);
    const available = await request(app).get(publicUrl);
    expect(available.status).toBe(200); expect(available.body.availability).toHaveLength(4);
    expect(available.body.availability[1].startsAt).toBe(interval(240, 480).startsAt);
  });

  it("rolls back the whole batch on overlap, including simultaneous submissions", async () => {
    const { batch, interval, profile } = await fixture();
    expect((await batch([interval(240, 300)])).status).toBe(201);
    expect((await batch([interval(0, 60), interval(270, 330)])).status).toBe(409);
    expect(await prisma.availabilitySlot.count({ where: { sitterProfileId: profile.id } })).toBe(1);
    const responses = await Promise.all([batch([interval(1440, 1500), interval(1560, 1620)]), batch([interval(1440, 1500), interval(1560, 1620)])]);
    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    expect(await prisma.availabilitySlot.count({ where: { sitterProfileId: profile.id } })).toBe(3);
  });

  it("validates empty, oversized, past and internally overlapping batches and requires verified authentication", async () => {
    const { batch, interval, sitter } = await fixture();
    for (const slots of [[], Array.from({ length: 57 }, (_, n) => interval(n * 60, n * 60 + 30)), [interval(0, 60), interval(30, 90)], [interval(-4000, -3900)]]) {
      expect((await batch(slots)).status).toBe(400);
    }
    expect((await request(app).post("/api/sitters/me/availability/batch").send({ slots: [interval(0, 60)] })).status).toBe(401);
    await prisma.account.update({ where: { id: sitter.id }, data: { emailVerifiedAt: null } });
    expect((await batch([interval(0, 60)])).status).toBe(403);
  });

  it("subtracts reservations from public availability, preserves slot IDs and exposes no pet data", async () => {
    const { batch, interval, owner, pet, profile, publicUrl } = await fixture();
    const slot = (await batch([interval(0, 180)])).body.slots[0];
    const booking = await request(app).post("/api/bookings").set("Authorization", owner.auth).send({
      petId: pet.id, sitterServiceId: profile.services[0].id, availabilitySlotId: slot.id, startsAt: interval(60, 90).startsAt
    });
    expect(booking.status).toBe(201);
    const response = await request(app).get(publicUrl);
    expect(response.body.availability.map((gap: { id: string }) => gap.id)).toEqual([slot.id, slot.id]);
    expect(response.body.availability[0].endsAt).toBe(interval(0, 60).endsAt);
    expect(response.body.availability[1].startsAt).toBe(interval(90, 180).startsAt);
    expect(JSON.stringify(response.body)).not.toMatch(/Figa|bookings|ownerAccountId|petId/);
  });

  it("edits free hours, rejects overlaps and keeps bookings protected from shortening, moving and deletion", async () => {
    const { batch, interval, owner, sitter, pet, profile } = await fixture();
    const [slot, next] = (await batch([interval(0, 180), interval(240, 300)])).body.slots;
    const path = `/api/sitters/me/availability/${slot.id}`;
    const edit = (input: object, auth = sitter.auth) => request(app).patch(path).set("Authorization", auth).send(input);
    expect((await edit(interval(0, 270))).status).toBe(409);
    expect((await edit(interval(0, 210), owner.auth)).status).toBe(404);
    expect((await edit(interval(0, 210))).status).toBe(200);
    expect((await request(app).post("/api/bookings").set("Authorization", owner.auth).send({ petId: pet.id, sitterServiceId: profile.services[0].id, availabilitySlotId: slot.id, startsAt: interval(60, 90).startsAt })).status).toBe(201);
    expect((await edit(interval(0, 45))).status).toBe(409);
    expect((await edit(interval(1440, 1620))).status).toBe(409);
    expect((await edit(interval(0, 180))).status).toBe(200);
    expect((await request(app).delete(path).set("Authorization", sitter.auth)).status).toBe(409);
    expect((await request(app).delete(`/api/sitters/me/availability/${next.id}`).set("Authorization", sitter.auth)).status).toBe(204);
    const own = await request(app).get("/api/sitters/me").set("Authorization", sitter.auth);
    expect(own.body.profile.availability[0].bookings[0].pet.name).toBe("Figa");
  });

  it("serializes a concurrent reservation and schedule change without leaving a booking outside working hours", async () => {
    const { batch, interval, owner, sitter, pet, profile } = await fixture();
    const slot = (await batch([interval(0, 180)])).body.slots[0];
    const [edit, booking] = await Promise.all([
      request(app).patch(`/api/sitters/me/availability/${slot.id}`).set("Authorization", sitter.auth).send(interval(0, 60)),
      request(app).post("/api/bookings").set("Authorization", owner.auth).send({ petId: pet.id, sitterServiceId: profile.services[0].id, availabilitySlotId: slot.id, startsAt: interval(120, 150).startsAt })
    ]);
    expect([200, 409]).toContain(edit.status); expect([201, 409]).toContain(booking.status);
    expect(edit.status === 200 && booking.status === 201).toBe(false);
    const stored = await prisma.availabilitySlot.findUniqueOrThrow({ where: { id: slot.id }, include: { bookings: true } });
    for (const entry of stored.bookings) { expect(entry.startsAt >= stored.startsAt).toBe(true); expect(entry.endsAt <= stored.endsAt).toBe(true); }
  });

  it("offers remaining time in an ongoing work day and hides inactive, unverified or unrelated services", async () => {
    const { profile, sitter, publicUrl } = await fixture();
    await prisma.availabilitySlot.create({ data: { sitterProfileId: profile.id, startsAt: new Date(Date.now() - 3_600_000), endsAt: new Date(Date.now() + 3_600_000) } });
    expect((await request(app).get(publicUrl)).body.availability).toHaveLength(1);
    const search = await request(app).get("/api/sitters").query({ latitude: 52.23, longitude: 21.01, serviceType: "DOG_WALK" });
    expect(search.body.items.some((item: { id: string }) => item.id === profile.id)).toBe(true);
    expect((await request(app).get(`/api/sitters/${profile.id}/availability?sitterServiceId=other`)).status).toBe(404);
    await prisma.account.update({ where: { id: sitter.id }, data: { emailVerifiedAt: null } });
    expect((await request(app).get(publicUrl)).status).toBe(404);
    await prisma.account.update({ where: { id: sitter.id }, data: { emailVerifiedAt: new Date() } });
    await prisma.sitterProfile.update({ where: { id: profile.id }, data: { isActive: false } });
    expect((await request(app).get(publicUrl)).status).toBe(404);
  });

  it("reserves longer care, calculates the price on the server and preserves it after offer changes", async () => {
    const { batch, interval, owner, pet, profile } = await fixture();
    const slot = (await batch([interval(0, 180)])).body.slots[0];
    const response = await request(app).post("/api/bookings").set("Authorization", owner.auth).send({
      petId: pet.id, sitterServiceId: profile.services[0].id, availabilitySlotId: slot.id,
      startsAt: interval(30, 120).startsAt, durationMinutes: 90, expectedPriceCents: 9000, priceCents: 1
    });
    expect(response.status).toBe(201);
    expect(response.body.booking.priceCents).toBe(9000);
    expect(response.body.booking.endsAt).toBe(interval(30, 120).endsAt);
    await prisma.sitterService.update({ where: { id: profile.services[0].id }, data: { priceCents: 9900 } });
    const stored = await request(app).get(`/api/bookings/${response.body.booking.id}`).set("Authorization", owner.auth);
    expect(stored.body.booking.priceCents).toBe(9000);
  });

  it("rejects shorter/invalid durations, unavailable extended ranges and stale quoted prices without creating bookings", async () => {
    const { batch, interval, owner, pet, profile } = await fixture();
    const slot = (await batch([interval(0, 180)])).body.slots[0];
    const create = (fields: object) => request(app).post("/api/bookings").set("Authorization", owner.auth).send({ petId: pet.id, sitterServiceId: profile.services[0].id, availabilitySlotId: slot.id, ...fields });
    for (const durationMinutes of [-1, 0, 15, 30.5, 1441]) expect((await create({ durationMinutes })).status).toBe(400);
    expect((await create({ durationMinutes: 60, expectedPriceCents: 3000 })).body.error).toBe("PRICE_CHANGED");
    expect((await create({ durationMinutes: 90, startsAt: interval(120, 210).startsAt })).status).toBe(409);
    expect(await prisma.booking.count({ where: { ownerAccountId: owner.id } })).toBe(0);
  });

  it("reserves several days with one duration and returns the total price", async () => {
    const { batch, interval, owner, pet, profile } = await fixture();
    const slots = (await batch([interval(0, 180), interval(1440, 1620), interval(2880, 3060)])).body.slots;
    const response = await request(app).post("/api/bookings/batch").set("Authorization", owner.auth).send({
      petId: pet.id, sitterServiceId: profile.services[0].id, durationMinutes: 60, expectedPriceCents: 6000,
      slots: slots.map((slot: { id: string; startsAt: string }) => ({ availabilitySlotId: slot.id, startsAt: slot.startsAt }))
    });
    expect(response.status).toBe(201); expect(response.body.bookings).toHaveLength(3); expect(response.body.totalPriceCents).toBe(18000);
    for (const booking of response.body.bookings) {
      expect(Date.parse(booking.endsAt) - Date.parse(booking.startsAt)).toBe(60 * 60_000); expect(booking.priceCents).toBe(6000);
    }
  });

  it("rolls back all days and notifications when any date is occupied", async () => {
    const { batch, interval, owner, sitter, pet, profile } = await fixture();
    const [first, second] = (await batch([interval(0, 180), interval(1440, 1620)])).body.slots;
    const shared = { petId: pet.id, sitterServiceId: profile.services[0].id, durationMinutes: 60 };
    expect((await request(app).post("/api/bookings").set("Authorization", owner.auth).send({ ...shared, availabilitySlotId: second.id, startsAt: second.startsAt })).status).toBe(201);
    const response = await request(app).post("/api/bookings/batch").set("Authorization", owner.auth).send({ ...shared, slots: [first, second].map(slot => ({ availabilitySlotId: slot.id, startsAt: slot.startsAt })) });
    expect(response.status).toBe(409);
    expect(await prisma.booking.count({ where: { ownerAccountId: owner.id } })).toBe(1);
    expect(await prisma.booking.count({ where: { availabilitySlotId: first.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { accountId: sitter.id } })).toBe(1);
  });

  it("accepts only one of two simultaneous multi-day reservations and validates batch size", async () => {
    const { batch, interval, owner, pet, profile } = await fixture();
    const slots = (await batch([interval(0, 180), interval(1440, 1620)])).body.slots;
    const payload = { petId: pet.id, sitterServiceId: profile.services[0].id, durationMinutes: 60, slots: slots.map((slot: { id: string; startsAt: string }) => ({ availabilitySlotId: slot.id, startsAt: slot.startsAt })) };
    const create = (input = payload) => request(app).post("/api/bookings/batch").set("Authorization", owner.auth).send(input);
    expect((await create({ ...payload, slots: [] })).status).toBe(400);
    expect((await create({ ...payload, slots: Array.from({ length: 29 }, () => payload.slots[0]) })).status).toBe(400);
    const responses = await Promise.all([create(), create()]);
    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    expect(await prisma.booking.count({ where: { ownerAccountId: owner.id } })).toBe(2);
  });
});
