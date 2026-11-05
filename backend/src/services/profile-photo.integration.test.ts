import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../app";
import { prisma } from "../config/prisma";
import { signAccessToken } from "../utils/tokens";
import { cleanupOrphanedObjects } from "./storage.service";

const ids: string[] = [];
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0S8AAAAASUVORK5CYII=", "base64");
async function user(role: "USER" | "CLINIC" = "USER") {
  const account = await prisma.account.create({ data: { email: `${randomUUID()}@profile-photo.test`, role, emailVerifiedAt: new Date(),
    ...(role === "USER" ? { userProfile: { create: { fullName: "Test zdjęcia", phone: "+48123456789" } } } : {}) } });
  ids.push(account.id);
  return { id: account.id, auth: `Bearer ${signAccessToken(account.id, role)}` };
}
const patch = (auth: string, data: object) => request(app).patch("/api/users/me").set("Authorization", auth).send(data);
async function upload(auth: string) {
  const signed = await request(app).post("/api/uploads/profile-photo").set("Authorization", auth).send({ contentType: "image/png", sizeBytes: image.length });
  expect(signed.status).toBe(201);
  expect((await fetch(signed.body.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: image })).status).toBe(200);
  return signed.body.photoKey as string;
}
afterEach(async () => { await prisma.account.deleteMany({ where: { id: { in: ids.splice(0) } } }); });
afterAll(() => prisma.$disconnect());

describe("account profile photo", () => {
  const storageIt = process.env.S3_ENDPOINT ? it : it.skip;
  storageIt("persists a real photo without a sitter profile, preserves it on profile edits, and exposes it to chat participants", async () => {
    const owner = await user(), other = await user();
    const key = await upload(owner.auth);
    expect(key.startsWith(`users/${owner.id}/`)).toBe(true);
    const saved = await patch(owner.auth, { photoKey: key });
    expect(saved.status).toBe(200);
    expect(saved.body.profile.photoKey).toBe(key);
    expect((await fetch(saved.body.profile.photoUrl)).status).toBe(200);
    const loaded = await request(app).get("/api/users/me").set("Authorization", owner.auth);
    expect(loaded.body.profile.photoUrl).toBe(saved.body.profile.photoUrl);
    expect((await patch(owner.auth, { phone: "+48987654321" })).body.profile.photoKey).toBe(key);
    expect(await prisma.sitterProfile.count({ where: { accountId: owner.id } })).toBe(0);
    const [firstAccountId, secondAccountId] = [owner.id, other.id].sort();
    const conversation = await prisma.conversation.create({ data: { firstAccountId, secondAccountId } });
    const chat = await request(app).get(`/api/conversations/${conversation.id}`).set("Authorization", other.auth);
    expect(chat.body.conversation.otherParticipant.photoUrl).toBe(saved.body.profile.photoUrl);
    await cleanupOrphanedObjects(new Date(Date.now() + 2 * 86_400_000));
    expect((await fetch(saved.body.profile.photoUrl)).status).toBe(200);
    const removed = await patch(owner.auth, { photoKey: null });
    expect(removed.body.profile).toMatchObject({ photoKey: null, photoUrl: null, phone: "+48987654321", fullName: "Test zdjęcia" });
    await cleanupOrphanedObjects(new Date(Date.now() + 2 * 86_400_000));
    expect((await fetch(saved.body.profile.photoUrl)).status).toBe(404);
  });
  storageIt("rejects other accounts' images, other upload purposes and missing objects without losing the saved photo", async () => {
    const owner = await user(), other = await user();
    const key = await upload(owner.auth);
    expect((await patch(owner.auth, { photoKey: key })).status).toBe(200);
    expect((await patch(other.auth, { photoKey: key })).status).toBe(403);
    expect((await patch(owner.auth, { photoKey: `sitters/${owner.id}/wrong.jpg` })).status).toBe(403);
    expect((await patch(owner.auth, { photoKey: `users/${owner.id}/missing.jpg` })).status).toBe(400);
    expect((await patch(owner.auth, { photoKey: "https://example.com/photo.jpg" })).status).toBe(403);
    expect((await prisma.userProfile.findUniqueOrThrow({ where: { accountId: owner.id } })).photoKey).toBe(key);
  });
  it("requires a user session and validates format and upload size", async () => {
    const owner = await user(), clinic = await user("CLINIC");
    const endpoint = "/api/uploads/profile-photo", input = { contentType: "image/jpeg", sizeBytes: 100 };
    expect((await request(app).post(endpoint).send(input)).status).toBe(401);
    expect((await request(app).post(endpoint).set("Authorization", clinic.auth).send(input)).status).toBe(403);
    expect((await request(app).post(endpoint).set("Authorization", owner.auth).send({ ...input, contentType: "text/html" })).status).toBe(400);
    expect((await request(app).post(endpoint).set("Authorization", owner.auth).send({ ...input, sizeBytes: 25_000_001 })).status).toBe(413);
  });
});
