import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../app";
import { prisma } from "../config/prisma";
import { signAccessToken } from "../utils/tokens";

const ids: string[] = [];
async function user(name = "Anna Kowalska") {
  const account = await prisma.account.create({
    data: {
      email: `${randomUUID()}@gamification.test`,
      role: "USER",
      userProfile: { create: { fullName: name, phone: "+48123456789" } }
    }
  });
  ids.push(account.id);
  return {
    id: account.id,
    auth: `Bearer ${signAccessToken(account.id, "USER")}`
  };
}
const get = (auth: string) =>
  request(app).get("/api/gamification/quests").set("Authorization", auth);
const claim = (auth: string, quest: string) =>
  request(app)
    .post(`/api/gamification/quests/${quest}/claim`)
    .set("Authorization", auth);
afterEach(async () => {
  await prisma.booking.deleteMany({
    where: {
      OR: [{ ownerAccountId: { in: ids } }, { sitterAccountId: { in: ids } }]
    }
  });
  await prisma.account.deleteMany({ where: { id: { in: ids.splice(0) } } });
});
afterAll(() => prisma.$disconnect());

describe("persistent gamification", () => {
  it("requires authentication and a user account", async () => {
    const clinic = await prisma.account.create({ data: { email: `${randomUUID()}@clinic.test`, role: "CLINIC" } });
    ids.push(clinic.id);
    expect((await request(app).get("/api/gamification/quests")).status).toBe(
      401
    );
    expect(
      (await request(app).get("/api/gamification/leaderboard")).status
    ).toBe(401);
    expect(
      (await request(app).post("/api/gamification/quests/first-pet/claim"))
        .status
    ).toBe(401);
    expect(
      (await get(`Bearer ${signAccessToken(clinic.id, "CLINIC")}`)).status
    ).toBe(403);
  });
  it("starts at zero, refuses locked and unknown quests, and does not use another account's pets", async () => {
    const owner = await user(),
      stranger = await user();
    await prisma.pet.create({
      data: { accountId: stranger.id, name: "Luna", gender: "FEMALE" }
    });
    const result = await get(owner.auth);
    expect(result.status).toBe(200);
    expect(result.body.userPoints).toBe(0);
    expect(
      result.body.quests.every((q: { status: string }) => q.status === "locked")
    ).toBe(true);
    expect((await claim(owner.auth, "first-pet")).status).toBe(409);
    expect((await claim(owner.auth, "invented")).status).toBe(404);
  });
  it("awards once under concurrent claims, persists across sessions and does not revoke rewards when a pet is deleted", async () => {
    const owner = await user();
    const pet = await prisma.pet.create({
      data: {
        accountId: owner.id,
        name: "Luna",
        gender: "FEMALE",
        age: 0,
        breed: "Mieszaniec",
        weight: 2,
        vet: "Przychodnia"
      }
    });
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        claim(owner.auth, "first-pet").send({ points: 999999 })
      )
    );
    expect(results.every((result) => result.status === 200)).toBe(true);
    expect(
      await prisma.questClaim.count({ where: { accountId: owner.id } })
    ).toBe(1);
    expect((await claim(owner.auth, "profile-complete")).body.userPoints).toBe(
      125
    );
    await prisma.pet.delete({ where: { id: pet.id } });
    const session = `Bearer ${signAccessToken(owner.id, "USER")}`;
    const result = await get(session);
    expect(result.body.userPoints).toBe(125);
    expect(
      result.body.quests.find((q: { id: string }) => q.id === "first-pet")
        .status
    ).toBe("claimed");
    expect((await claim(session, "first-pet")).body.userPoints).toBe(125);
  });
  it("counts only completed owner bookings and distinguishes walks from other care", async () => {
    const owner = await user(),
      sitter = await user(),
      stranger = await user();
    const pet = await prisma.pet.create({
      data: { accountId: owner.id, name: "Luna", gender: "FEMALE" }
    });
    const profile = await prisma.sitterProfile.create({
      data: {
        accountId: sitter.id,
        bio: "Opieka",
        city: "Warszawa",
        latitude: 52,
        longitude: 21,
        serviceRadiusKm: 10
      }
    });
    const service = await prisma.sitterService.create({
      data: {
        sitterProfileId: profile.id,
        type: "DAY_CARE",
        durationMinutes: 60,
        priceCents: 1000
      }
    });
    const slot = await prisma.availabilitySlot.create({
      data: {
        sitterProfileId: profile.id,
        startsAt: new Date("2026-01-01"),
        endsAt: new Date("2026-01-02")
      }
    });
    const base = {
      ownerAccountId: owner.id,
      sitterAccountId: sitter.id,
      petId: pet.id,
      sitterServiceId: service.id,
      availabilitySlotId: slot.id,
      priceCents: 1000,
      startsAt: new Date("2026-01-01T10:00:00Z"),
      endsAt: new Date("2026-01-01T11:00:00Z"),
      expiresAt: new Date("2026-01-01T09:00:00Z")
    };
    await prisma.booking.createMany({
      data: [
        { ...base, status: "COMPLETED" },
        { ...base, status: "ACCEPTED" },
        { ...base, status: "CANCELLED" },
        { ...base, status: "REQUESTED", startsAt: new Date("2026-01-01T11:00:00Z"), endsAt: new Date("2026-01-01T12:00:00Z") },
        { ...base, ownerAccountId: stranger.id, status: "COMPLETED" }
      ]
    });
    let result = await get(owner.auth);
    expect(
      result.body.quests.find((q: { id: string }) => q.id === "regular-care")
        .progress
    ).toBe(1);
    expect((await claim(owner.auth, "first-walk")).status).toBe(409);
    expect((await claim(owner.auth, "regular-care")).status).toBe(409);
    const walk = await prisma.sitterService.create({
      data: {
        sitterProfileId: profile.id,
        type: "DOG_WALK",
        durationMinutes: 30,
        priceCents: 1000
      }
    });
    await prisma.booking.createMany({
      data: Array.from({ length: 4 }, () => ({
        ...base,
        sitterServiceId: walk.id,
        status: "COMPLETED" as const
      }))
    });
    expect((await claim(owner.auth, "first-walk")).body.userPoints).toBe(90);
    expect((await claim(owner.auth, "regular-care")).body.userPoints).toBe(390);
    result = await get(sitter.auth);
    expect(
      result.body.quests.find((q: { id: string }) => q.id === "regular-care")
        .progress
    ).toBe(0);
  });
  it("ranks real accounts with ties and returns own position outside the top 50 without private contact data", async () => {
    const owner = await user("Jan Nowak");
    for (let i = 0; i < 51; i++) {
      const other = await user(`Osoba Nazwisko${i}`);
      await prisma.questClaim.create({
        data: { accountId: other.id, questId: "first-pet", points: 50 }
      });
    }
    const result = await request(app)
      .get("/api/gamification/leaderboard")
      .set("Authorization", owner.auth);
    expect(result.status).toBe(200);
    expect(result.body.leaderboard).toHaveLength(50);
    expect(
      result.body.leaderboard.every((row: { rank: number }) => row.rank === 1)
    ).toBe(true);
    expect(result.body.currentUser).toMatchObject({
      id: owner.id,
      rank: 52,
      points: 0,
      name: "Jan N.",
      isCurrentUser: true
    });
    expect(JSON.stringify(result.body)).not.toContain("@gamification.test");
    expect(JSON.stringify(result.body)).not.toContain("+48123456789");
  });
});
