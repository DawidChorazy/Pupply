import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../app";
import { prisma } from "../config/prisma";
import { signAccessToken } from "../utils/tokens";
import { BookingStatus, SitterServiceType } from "@prisma/client";

const ids: string[] = [];
const scores = { punctuality: 5, communication: 4, quality: 3, comment: "  Dobry kontakt, spacer zgodnie z ustaleniami.  " };
async function account(fullName = "Anna Kowalska", role: "USER" | "CLINIC" = "USER") {
  const row = await prisma.account.create({ data: { role, email: `${randomUUID()}@reviews.test`, emailVerifiedAt: new Date(),
    ...(role === "USER" ? { userProfile: { create: { fullName, phone: "+48123456789" } } } : {}) } });
  ids.push(row.id); return { id: row.id, auth: `Bearer ${signAccessToken(row.id, role)}` };
}
async function fixture() {
  const owner = await account(), sitter = await account("Piotr Spacerowicz"), stranger = await account("Obca Osoba");
  const profile = await prisma.sitterProfile.create({ data: { accountId: sitter.id, bio: "Bezpieczne spacery z doświadczonym opiekunem.", city: "Warszawa", latitude: 52, longitude: 21,
    services: { create: { type: "DOG_WALK", durationMinutes: 30, priceCents: 3000 } } }, include: { services: true } });
  const now = Date.now();
  const slot = await prisma.availabilitySlot.create({ data: { sitterProfileId: profile.id, startsAt: new Date(now - 3 * 3_600_000), endsAt: new Date(now - 30 * 60_000) } });
  await prisma.availabilitySlot.create({ data: { sitterProfileId: profile.id, startsAt: new Date(now + 86_400_000), endsAt: new Date(now + 90_000_000) } });
  const pet = await prisma.pet.create({ data: { accountId: owner.id, name: "Prywatny pupil", gender: "FEMALE", illnesses: "Prywatne dane zdrowotne" } });
  const booking = async (status: BookingStatus = "COMPLETED", type: SitterServiceType = "DOG_WALK") => {
    const service = type === "DOG_WALK" ? profile.services[0] : await prisma.sitterService.upsert({ where: { sitterProfileId_type_durationMinutes: { sitterProfileId: profile.id, type, durationMinutes: 30 } },
      create: { sitterProfileId: profile.id, type, durationMinutes: 30, priceCents: 3000 }, update: {} });
    return prisma.booking.create({ data: { ownerAccountId: owner.id, sitterAccountId: sitter.id, petId: pet.id,
      sitterServiceId: service.id, availabilitySlotId: slot.id, status, startsAt: new Date(now - 2 * 3_600_000), endsAt: new Date(now - 3_600_000), expiresAt: new Date(now - 3_600_000), priceCents: 3000 } });
  };
  return { owner, sitter, stranger, profile, booking };
}
const post = (auth: string, id: string, input: object = scores) => request(app).post(`/api/bookings/${id}/review`).set("Authorization", auth).send(input);
const list = (profileId: string, query = "") => request(app).get(`/api/sitters/${profileId}/reviews${query}`);
afterEach(async () => {
  await prisma.booking.deleteMany({ where: { OR: [{ ownerAccountId: { in: ids } }, { sitterAccountId: { in: ids } }] } });
  await prisma.account.deleteMany({ where: { id: { in: ids.splice(0) } } });
});
afterAll(() => prisma.$disconnect());

describe("walker reviews", () => {
  it("publishes a completed walk review, includes it in private booking history, and exposes only public review data", async () => {
    const f = await fixture(), booking = await f.booking();
    const saved = await post(f.owner.auth, booking.id);
    expect(saved.status).toBe(201); expect(saved.body.review.comment).toBe(scores.comment.trim());
    const detail = await request(app).get(`/api/bookings/${booking.id}`).set("Authorization", f.owner.auth);
    expect(detail.body.booking.review.id).toBe(saved.body.review.id);
    const publicPage = await list(f.profile.id);
    expect(publicPage.status).toBe(200);
    expect(publicPage.body.summary).toMatchObject({ reviewCount: 1, averageRating: 4, averagePunctuality: 5, averageCommunication: 4, averageQuality: 3, completedWalkCount: 1 });
    expect(publicPage.body.items[0]).toMatchObject({ authorName: "Anna K.", rating: 4 });
    for (const field of ["bookingId", "authorAccountId", "sitterAccountId", "author", "pet"]) expect(publicPage.body.items[0]).not.toHaveProperty(field);
    expect(JSON.stringify(publicPage.body)).not.toContain("Prywatny");
    expect(JSON.stringify(publicPage.body)).not.toContain("reviews.test");
  });
  it("allows only the verified owner, never the sitter, another owner, or a clinic", async () => {
    const f = await fixture(), booking = await f.booking(), clinic = await account("Klinika", "CLINIC");
    expect((await request(app).post(`/api/bookings/${booking.id}/review`).send(scores)).status).toBe(401);
    expect((await post(f.sitter.auth, booking.id)).status).toBe(404);
    expect((await post(f.stranger.auth, booking.id)).status).toBe(404);
    expect((await post(clinic.auth, booking.id)).status).toBe(403);
    await prisma.account.update({ where: { id: f.owner.id }, data: { emailVerifiedAt: null } });
    expect((await post(f.owner.auth, booking.id)).body.error).toBe("EMAIL_NOT_VERIFIED");
    expect(await prisma.sitterReview.count({ where: { bookingId: booking.id } })).toBe(0);
  });
  it("refuses unfinished, cancelled, rejected, expired, future and non-walk services", async () => {
    const f = await fixture(), booking = await f.booking();
    for (const status of ["REQUESTED", "ACCEPTED", "CANCELLED", "REJECTED", "EXPIRED"] as const) {
      await prisma.booking.update({ where: { id: booking.id }, data: { status } });
      expect((await post(f.owner.auth, booking.id)).body.error).toBe("REVIEW_NOT_AVAILABLE");
    }
    await prisma.booking.update({ where: { id: booking.id }, data: { status: "COMPLETED", endsAt: new Date(Date.now() + 3_600_000) } });
    expect((await post(f.owner.auth, booking.id)).status).toBe(409);
    for (const type of ["DROP_IN", "DAY_CARE"] as const) expect((await post(f.owner.auth, (await f.booking("COMPLETED", type)).id)).status).toBe(409);
  });
  it("validates all three integer criteria and text, and accepts a rating without a comment", async () => {
    const f = await fixture(), booking = await f.booking();
    for (const input of [{}, { ...scores, quality: 0 }, { ...scores, punctuality: 6 }, { ...scores, communication: 4.5 },
      { ...scores, comment: "a".repeat(2001) }, { ...scores, sitterAccountId: f.stranger.id }]) {
      expect((await post(f.owner.auth, booking.id, input)).status).toBe(400);
    }
    const result = await post(f.owner.auth, booking.id, { punctuality: 1, communication: 1, quality: 1 });
    expect(result.status).toBe(201); expect(result.body.review.comment).toBeNull();
  });
  it("replays simultaneous and lost-response retries once and rejects changing a published review", async () => {
    const f = await fixture(), booking = await f.booking();
    const results = await Promise.all(Array.from({ length: 6 }, () => post(f.owner.auth, booking.id)));
    expect(results.map(result => result.status)).toEqual(Array(6).fill(201));
    expect(new Set(results.map(result => result.body.review.id)).size).toBe(1);
    expect((await post(f.owner.auth, booking.id, { ...scores, quality: 5 })).body.error).toBe("REVIEW_ALREADY_EXISTS");
    expect((await list(f.profile.id)).body.summary.reviewCount).toBe(1);
  });
  it("aggregates ratings, paginates stably and filters search before pagination without changing distance sorting", async () => {
    const f = await fixture();
    await post(f.owner.auth, (await f.booking()).id, { punctuality: 5, communication: 5, quality: 4 });
    await post(f.owner.auth, (await f.booking()).id, { punctuality: 3, communication: 4, quality: 3 });
    await f.booking(); // Completed walks and published reviews are separate counts.
    const empty = await fixture();
    const page = await list(f.profile.id, "?limit=1");
    expect(page.body.summary).toMatchObject({ reviewCount: 2, averageRating: 4, completedWalkCount: 3 });
    const next = await list(f.profile.id, `?limit=1&cursor=${encodeURIComponent(page.body.nextCursor)}`);
    expect(next.body.items).toHaveLength(1); expect(next.body.items[0].id).not.toBe(page.body.items[0].id); expect(next.body.nextCursor).toBeNull();
    expect((await list(empty.profile.id)).body.summary).toMatchObject({ reviewCount: 0, averageRating: null });
    const search = await request(app).get("/api/sitters").query({ latitude: 52, longitude: 21, minRating: 4, pageSize: 1 });
    expect(search.status).toBe(200); expect(search.body.pagination.total).toBe(1);
    expect(search.body.items[0]).toMatchObject({ id: f.profile.id, ratingSummary: { averageRating: 4, reviewCount: 2 } });
    expect((await request(app).get("/api/sitters").query({ latitude: 52, longitude: 21, minRating: 4.5 })).body.items).toEqual([]);
    expect((await request(app).get("/api/sitters").query({ latitude: 52, longitude: 21, minRating: 0 })).status).toBe(400);
    expect((await list(f.profile.id, "?cursor=invalid")).status).toBe(400);
  });
  it("keeps reviews available for a paused offer, hides blocked sitters and anonymizes inactive authors", async () => {
    const f = await fixture(), booking = await f.booking();
    await post(f.owner.auth, booking.id);
    await prisma.sitterProfile.update({ where: { id: f.profile.id }, data: { isActive: false } });
    expect((await list(f.profile.id)).status).toBe(200);
    await prisma.account.update({ where: { id: f.owner.id }, data: { deactivatedAt: new Date() } });
    expect((await list(f.profile.id)).body.items[0].authorName).toBe("Użytkownik");
    await prisma.account.update({ where: { id: f.sitter.id }, data: { blockedAt: new Date() } });
    expect((await list(f.profile.id)).status).toBe(404);
  });
});
