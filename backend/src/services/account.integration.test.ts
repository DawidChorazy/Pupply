import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../app";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { signAccessToken } from "../utils/tokens";

const ids: string[] = [];
const password = "Strong@Test1";
async function user() {
  const email = `${randomUUID()}@accounts.test`;
  const response = await request(app).post("/api/auth/register/user").send({ email, fullName: "Test User", phone: "+48123456789", password, confirmPassword: password });
  expect(response.status).toBe(201);
  ids.push(response.body.account.id);
  await prisma.account.update({ where: { id: response.body.account.id }, data: { emailVerifiedAt: new Date() } });
  return { ...response.body, email, id: response.body.account.id, auth: `Bearer ${response.body.accessToken}` };
}
afterEach(async () => {
  await prisma.booking.deleteMany({ where: { OR: [{ ownerAccountId: { in: ids } }, { sitterAccountId: { in: ids } }] } });
  await prisma.auditLog.deleteMany({ where: { targetAccountId: { in: ids } } });
  await prisma.account.deleteMany({ where: { id: { in: ids.splice(0) } } });
});
afterAll(() => prisma.$disconnect());

describe("account lifecycle", () => {
  it("changes password and immediately revokes access and refresh tokens", async () => {
    const account = await user();
    expect((await request(app).post("/api/account/password").set("Authorization", account.auth).send({ currentPassword: "wrong", password: "NewStrong@Test2" })).status).toBe(401);
    expect((await request(app).post("/api/account/password").set("Authorization", account.auth).send({ currentPassword: password, password: "NewStrong@Test2" })).status).toBe(204);
    expect((await request(app).get("/api/users/me").set("Authorization", account.auth)).status).toBe(401);
    expect((await request(app).post("/api/auth/refresh").send({ refreshToken: account.refreshToken })).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email: account.email, password: "NewStrong@Test2" })).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { targetAccountId: account.id, action: "PASSWORD_CHANGED" } })).toBe(1);
  });
  it("changes email only after confirming a single-use link sent to the new address", async () => {
    const account = await user();
    const email = `${randomUUID()}@new.test`;
    const changed = await request(app).post("/api/account/email").set("Authorization", account.auth).send({ email, password });
    expect(changed.status).toBe(202); expect(changed.body.debugToken).toBeTypeOf("string");
    expect((await prisma.account.findUniqueOrThrow({ where: { id: account.id } })).email).toBe(account.email);
    const confirm = () => request(app).post("/api/auth/email-change/confirm").send({ token: changed.body.debugToken });
    expect((await confirm()).status).toBe(204); expect((await confirm()).status).toBe(400);
    expect((await request(app).get("/api/users/me").set("Authorization", account.auth)).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email, password })).status).toBe(200);
  });
  it("deactivates an account, hides care offers, cancels bookings and revokes sessions", async () => {
    const account = await user(), owner = await user();
    const pet = await prisma.pet.create({ data: { accountId: owner.id, name: "Figa", gender: "FEMALE" } });
    const sitter = await prisma.sitterProfile.create({ data: { accountId: account.id, bio: "Opiekun z doświadczeniem", city: "Warszawa", latitude: 52, longitude: 21, services: { create: { type: "DOG_WALK", durationMinutes: 30, priceCents: 1000 } } }, include: { services: true } });
    const start = new Date(Date.now() + 86_400_000);
    const slot = await prisma.availabilitySlot.create({ data: { sitterProfileId: sitter.id, startsAt: start, endsAt: new Date(start.getTime() + 3_600_000) } });
    const booking = await request(app).post("/api/bookings").set("Authorization", owner.auth).send({ petId: pet.id, sitterServiceId: sitter.services[0].id, availabilitySlotId: slot.id });
    expect(booking.status).toBe(201);
    expect((await request(app).post("/api/account/deactivate").set("Authorization", account.auth).send({ confirmation: "DEACTIVATE" })).status).toBe(204);
    expect((await prisma.sitterProfile.findUniqueOrThrow({ where: { id: sitter.id } })).isActive).toBe(false);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.body.booking.id } })).status).toBe("CANCELLED");
    expect((await request(app).get("/api/users/me").set("Authorization", account.auth)).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email: account.email, password })).status).toBe(401);
  });
  it("restricts moderation to administrators and records reasons for block/restore", async () => {
    const account = await user();
    const admin = await prisma.account.create({ data: { email: `${randomUUID()}@admin.test`, role: "ADMIN", emailVerifiedAt: new Date() } }); ids.push(admin.id);
    const endpoint = `/api/admin/accounts/${account.id}/state`;
    expect((await request(app).post(endpoint).set("Authorization", account.auth).send({ action: "BLOCK", reason: "Test moderation" })).status).toBe(403);
    const auth = `Bearer ${signAccessToken(admin.id, "ADMIN")}`;
    expect((await request(app).post(endpoint).set("Authorization", auth).send({ action: "BLOCK", reason: "Test moderation" })).status).toBe(204);
    expect((await request(app).get("/api/users/me").set("Authorization", account.auth)).status).toBe(401);
    expect((await request(app).post(endpoint).set("Authorization", auth).send({ action: "RESTORE", reason: "Review completed" })).status).toBe(204);
    expect((await request(app).post("/api/auth/login").send({ email: account.email, password })).status).toBe(200);
    const logs = await request(app).get(`/api/admin/audit?accountId=${account.id}`).set("Authorization", auth);
    expect(logs.body.items.map((row: { action: string }) => row.action)).toEqual(["RESTORE", "BLOCK"]);
  });
  it("binds push registration to the login session and removes it on logout", async () => {
    const account = await user();
    expect((await request(app).post("/api/notifications/devices").set("Authorization", account.auth).send({ token: "ExpoPushToken[session-test]" })).status).toBe(204);
    expect(await prisma.pushDevice.count({ where: { accountId: account.id } })).toBe(1);
    expect((await request(app).post("/api/auth/logout").send({ refreshToken: account.refreshToken })).status).toBe(204);
    expect(await prisma.pushDevice.count({ where: { accountId: account.id } })).toBe(0);
    expect((await request(app).get("/api/users/me").set("Authorization", account.auth)).status).toBe(401);
  });
  it("does not claim successful mail delivery in production without SMTP", async () => {
    const mode = env.NODE_ENV;
    try {
      env.NODE_ENV = "production";
      const response = await request(app).post("/api/auth/password-reset/request").send({ email: "nobody@example.com" });
      expect(response.status).toBe(503); expect(response.body.error).toBe("MAIL_UNAVAILABLE"); expect(response.body).not.toHaveProperty("debugToken");
    } finally { env.NODE_ENV = mode; }
  });
});
