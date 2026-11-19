import { completePetFixture } from "../test-fixtures";
import { randomUUID } from "node:crypto";
import { CreateBucketCommand, DeleteObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { signAccessToken } from "../utils/tokens";
import { hashPassword } from "../utils/password";
import { cleanupExpiredVerificationFiles } from "./sitter-verification.service";

const ids: string[] = [];
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE8sAAAAASUVORK5CYII=", "base64");
const configured = !!env.S3_ENDPOINT && !!env.S3_ACCESS_KEY_ID;
const s3 = new S3Client({ endpoint: env.S3_ENDPOINT, region: env.S3_REGION, forcePathStyle: true,
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID ?? "test", secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "test" } });
const approval = { decision: "APPROVE", reason: "Sprawdzono dokument i zgodność twarzy.", documentConfirmed: true, faceConfirmed: true };
async function user(role: "USER" | "ADMIN" = "USER", emailVerified = true) {
  const account = await prisma.account.create({ data: { email: `${randomUUID()}@sitter-verification.test`, role,
    emailVerifiedAt: emailVerified ? new Date() : null, ...(role === "USER" ? { userProfile: { create: { fullName: "Anna Testowa", phone: "+48123456789" } } } : {}) } });
  ids.push(account.id); return { id: account.id, auth: `Bearer ${signAccessToken(account.id, role)}` };
}
async function fixture() {
  const sitter = await user(), owner = await user(), operator = await user("ADMIN"), stranger = await user();
  const profile = await prisma.sitterProfile.create({ data: { accountId: sitter.id, bio: "Doświadczony opiekun zwierząt.", city: "Warszawa", latitude: 52, longitude: 21,
    services: { create: { type: "DOG_WALK", durationMinutes: 30, priceCents: 0 } } }, include: { services: true } });
  const slot = await prisma.availabilitySlot.create({ data: { sitterProfileId: profile.id, startsAt: new Date(Date.now() + 3_600_000), endsAt: new Date(Date.now() + 7_200_000) } });
  const pet = await prisma.pet.create({ data: { ...completePetFixture(), accountId: owner.id, name: "Test GPS", gender: "MALE" } });
  return { sitter, owner, operator, stranger, profile, slot, pet };
}
const own = (auth: string) => request(app).get("/api/sitters/me/verification").set("Authorization", auth);
const submit = (auth: string, expectedVersion: number, documentFileId: string, faceFileId: string) => request(app).post("/api/sitters/me/verification")
  .set("Authorization", auth).send({ expectedVersion, documentFileId, faceFileId });
const review = (auth: string, id: string, version: number, input: object = approval) => request(app).post(`/api/admin/sitters/${id}/verification`)
  .set("Authorization", auth).send({ ...input, expectedVersion: version });
async function upload(auth: string, purpose: "IDENTITY_DOCUMENT" | "FACE_PHOTO", bytes = image) {
  const response = await request(app).post("/api/sitters/me/verification/files").set("Authorization", auth).send({ purpose, contentType: "image/png", sizeBytes: bytes.length });
  expect(response.status).toBe(201);
  const put = await fetch(response.body.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: bytes }); expect(put.ok).toBe(true);
  const completed = await request(app).post(`/api/sitters/me/verification/files/${response.body.fileId}/complete`).set("Authorization", auth);
  expect(completed.status).toBe(200);
  return { id: response.body.fileId as string, uploadUrl: response.body.uploadUrl as string };
}
async function pending(auth: string, version = 0) {
  const document = await upload(auth, "IDENTITY_DOCUMENT"), face = await upload(auth, "FACE_PHOTO");
  const response = await submit(auth, version, document.id, face.id); expect(response.status).toBe(202);
  return { document, face, version: response.body.verification.version as number };
}
beforeAll(async () => {
  if (!configured) return;
  // Buckets must belong to the isolated test storage instance.
  if (!env.S3_DOCUMENT_BUCKET.includes("test")) throw new Error("Use a private test bucket for verification tests");
  for (const bucket of [env.S3_BUCKET!, env.S3_DOCUMENT_BUCKET]) {
    try { await s3.send(new CreateBucketCommand({ Bucket: bucket })); } catch (e) { if (!["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes((e as Error).name)) throw e; }
  }
});
afterEach(async () => {
  const files = await prisma.sitterVerificationFile.findMany({ where: { profile: { accountId: { in: ids } } } });
  if (configured) for (const file of files) for (const key of [file.stagingKey, file.objectKey]) await s3.send(new DeleteObjectCommand({ Bucket: env.S3_DOCUMENT_BUCKET, Key: key }));
  await prisma.booking.deleteMany({ where: { OR: [{ ownerAccountId: { in: ids } }, { sitterAccountId: { in: ids } }] } });
  await prisma.auditLog.deleteMany({ where: { targetAccountId: { in: ids } } });
  await prisma.account.deleteMany({ where: { id: { in: ids.splice(0) } } });
});
afterAll(() => prisma.$disconnect());

describe("sitter identity verification", () => {
  it("defaults to unverified; keeps profile and calendar editable but rejects booking, acceptance and new GPS", async () => {
    const f = await fixture();
    expect((await own(f.sitter.auth)).body.verification).toMatchObject({ status: "UNVERIFIED", canAcceptBookings: false });
    const patched = await request(app).patch("/api/sitters/me").set("Authorization", f.sitter.auth).send({ bio: "Nowy opis opiekuna zwierząt.", verificationStatus: "VERIFIED" });
    expect(patched.status).toBe(200); expect(patched.body.profile.verificationStatus).toBe("UNVERIFIED");
    expect((await request(app).get("/api/sitters").query({ latitude: 52, longitude: 21 })).body.items).toHaveLength(0);
    expect((await request(app).get(`/api/sitters/${f.profile.id}/availability`).query({ pickupAddress: "Warszawa, Testowa 1", sitterServiceId: f.profile.services[0].id })).status).toBe(404);
    expect((await request(app).get(`/api/sitters/${f.profile.id}/reviews`)).status).toBe(404);
    const bookingRequest = await request(app).post("/api/bookings").set("Authorization", f.owner.auth).send({ petId: f.pet.id, pickupAddress: "Warszawa, Testowa 1", sitterServiceId: f.profile.services[0].id, availabilitySlotId: f.slot.id });
    expect(bookingRequest.status).toBe(403); expect(bookingRequest.body.error).toBe("SITTER_NOT_VERIFIED");
    const booking = await prisma.booking.create({ data: { ownerAccountId: f.owner.id, sitterAccountId: f.sitter.id, petId: f.pet.id, pickupAddress: "Warszawa, Testowa 1", sitterServiceId: f.profile.services[0].id,
      availabilitySlotId: f.slot.id, startsAt: f.slot.startsAt, endsAt: f.slot.endsAt, expiresAt: new Date(Date.now() + 60_000), priceCents: 0 } });
    expect((await request(app).patch(`/api/bookings/${booking.id}/status`).set("Authorization", f.sitter.auth).send({ status: "ACCEPTED" })).body.error).toBe("SITTER_NOT_VERIFIED");
    await prisma.booking.update({ where: { id: booking.id }, data: { status: "ACCEPTED", startsAt: new Date(Date.now() - 60_000) } });
    expect((await request(app).post(`/api/bookings/${booking.id}/walk/start`).set("Authorization", f.sitter.auth)).body.error).toBe("SITTER_NOT_VERIFIED");
    expect((await request(app).patch(`/api/bookings/${booking.id}/status`).set("Authorization", f.sitter.auth).send({ status: "CANCELLED" })).status).toBe(200);
  });
  it("restricts the queue and decisions to admins and validates required files, roles and email", async () => {
    const f = await fixture();
    expect((await request(app).get("/api/sitters/me/verification")).status).toBe(401);
    expect((await own(f.operator.auth)).status).toBe(403);
    expect((await request(app).get("/api/admin/sitters").set("Authorization", f.sitter.auth)).status).toBe(403);
    expect((await review(f.sitter.auth, f.sitter.id, 0)).status).toBe(403);
    expect((await submit(f.sitter.auth, 0, randomUUID(), randomUUID())).body.error).toBe("VERIFICATION_FILES_REQUIRED");
    await prisma.account.update({ where: { id: f.sitter.id }, data: { emailVerifiedAt: null } });
    expect((await submit(f.sitter.auth, 0, randomUUID(), randomUUID())).body.error).toBe("EMAIL_NOT_VERIFIED");
  });
  it.skipIf(!configured)("seals private images, prevents swapping evidence with an outstanding PUT URL and isolates other accounts", async () => {
    const f = await fixture(), files = await pending(f.sitter.auth);
    expect((await own(f.sitter.auth)).headers["cache-control"]).toBe("no-store");
    const detail = await request(app).get(`/api/admin/sitters/${f.sitter.id}/verification`).set("Authorization", f.operator.auth);
    expect(detail.body.files).toHaveLength(2); expect(JSON.stringify(detail.body)).not.toContain("stagingKey");
    expect((await request(app).get(`/api/sitters/me/verification/files/${files.document.id}`).set("Authorization", f.stranger.auth)).status).toBe(404);
    expect((await request(app).post(`/api/sitters/me/verification/files/${files.document.id}/complete`).set("Authorization", f.stranger.auth)).status).toBe(404);
    const file = await prisma.sitterVerificationFile.findUniqueOrThrow({ where: { id: files.document.id } });
    expect((await fetch(`${env.S3_ENDPOINT}/${env.S3_DOCUMENT_BUCKET}/${file.objectKey}`)).status).toBe(403);
    const swapped = Buffer.from(image); swapped[swapped.length - 1] ^= 1;
    expect((await fetch(files.document.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: swapped })).ok).toBe(true);
    expect((await request(app).post(`/api/sitters/me/verification/files/${file.id}/complete`).set("Authorization", f.sitter.auth)).status).toBe(200);
    const link = await request(app).get(`/api/admin/sitters/${f.sitter.id}/verification/files/${file.id}`).set("Authorization", f.operator.auth);
    expect(link.status).toBe(200); expect(link.body.expiresIn).toBe(60);
    expect(Buffer.from(await (await fetch(link.body.url)).arrayBuffer())).toEqual(image);
    expect(await prisma.auditLog.count({ where: { targetAccountId: f.sitter.id, action: "SITTER_VERIFICATION_FILE_READ" } })).toBe(1);
    const { objectKey: _key, stagingKey: _stage, ...publicFields } = file;
    expect(JSON.stringify(detail.body)).not.toContain(_key); expect(publicFields.purpose).toBe("IDENTITY_DOCUMENT");
  });
  it.skipIf(!configured)("requires both confirmed images and checks version; concurrent decisions approve once and delete evidence", async () => {
    const f = await fixture(), files = await pending(f.sitter.auth);
    expect((await review(f.operator.auth, f.sitter.id, files.version, { ...approval, faceConfirmed: false })).status).toBe(400);
    expect((await review(f.operator.auth, f.sitter.id, files.version - 1)).status).toBe(409);
    const results = await Promise.all([review(f.operator.auth, f.sitter.id, files.version), review(f.operator.auth, f.sitter.id, files.version)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect((await own(f.sitter.auth)).body.verification.canAcceptBookings).toBe(true);
    const search = await request(app).get("/api/sitters").query({ latitude: 52, longitude: 21 }); expect(search.body.items).toHaveLength(1);
    expect(JSON.stringify(search.body)).not.toContain("verificationFullName"); expect(JSON.stringify(search.body)).not.toContain("sitter-verification/");
    expect((await request(app).get(`/api/admin/sitters/${f.sitter.id}/verification/files/${files.document.id}`).set("Authorization", f.operator.auth)).status).toBe(404);
    const originals = await prisma.sitterVerificationFile.findMany({ where: { profileId: f.profile.id } });
    await cleanupExpiredVerificationFiles();
    expect(await prisma.sitterVerificationFile.count({ where: { profileId: f.profile.id } })).toBe(0);
    for (const file of originals) await expect(s3.send(new HeadObjectCommand({ Bucket: env.S3_DOCUMENT_BUCKET, Key: file.objectKey }))).rejects.toThrow();
    expect((await own(f.sitter.auth)).body.verification.status).toBe("VERIFIED");
  });
  it.skipIf(!configured)("rejects invalid bytes and ownership, then permits a new submission after rejection", async () => {
    const f = await fixture();
    const invalid = await request(app).post("/api/sitters/me/verification/files").set("Authorization", f.sitter.auth).send({ purpose: "IDENTITY_DOCUMENT", contentType: "image/png", sizeBytes: 20 });
    await fetch(invalid.body.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: "not-a-valid-image-abc" });
    expect((await request(app).post(`/api/sitters/me/verification/files/${invalid.body.fileId}/complete`).set("Authorization", f.sitter.auth)).body.error).toBe("INVALID_VERIFICATION_UPLOAD");
    const document = await upload(f.sitter.auth, "IDENTITY_DOCUMENT");
    await prisma.sitterProfile.create({ data: { accountId: f.stranger.id, bio: "Drugi opiekun do próby izolacji.", city: "Warszawa", latitude: 52, longitude: 21 } });
    const foreignFace = await upload(f.stranger.auth, "FACE_PHOTO");
    expect((await submit(f.sitter.auth, 0, document.id, foreignFace.id)).body.error).toBe("VERIFICATION_FILES_REQUIRED");
    const face = await upload(f.sitter.auth, "FACE_PHOTO");
    expect((await submit(f.sitter.auth, 0, face.id, document.id)).body.error).toBe("VERIFICATION_FILES_REQUIRED");
    const files = await pending(f.sitter.auth);
    const rejected = await review(f.operator.auth, f.sitter.id, files.version, { decision: "REJECT", reason: "Zdjęcie dokumentu jest nieczytelne." });
    expect(rejected.status).toBe(200); expect((await own(f.sitter.auth)).body.verification.reason).toContain("nieczytelne");
    expect((await submit(f.sitter.auth, rejected.body.verification.version, files.document.id, files.face.id)).status).toBe(400);
    const second = await pending(f.sitter.auth, rejected.body.verification.version);
    expect(second.version).toBeGreaterThan(files.version);
  });
  it.skipIf(!configured)("invalidates a pending or approved identity on name change; ordinary profile edits retain approval", async () => {
    const f = await fixture(), files = await pending(f.sitter.auth);
    const changed = await request(app).patch("/api/users/me").set("Authorization", f.sitter.auth).send({ fullName: "Anna Nowa" }); expect(changed.status).toBe(200);
    expect((await review(f.operator.auth, f.sitter.id, files.version)).status).toBe(409);
    expect((await own(f.sitter.auth)).body.verification.status).toBe("UNVERIFIED");
    const next = await pending(f.sitter.auth, (await own(f.sitter.auth)).body.verification.version);
    expect((await review(f.operator.auth, f.sitter.id, next.version)).status).toBe(200);
    await request(app).patch("/api/sitters/me").set("Authorization", f.sitter.auth).send({ bio: "Zmieniony opis usług i opiekuna." });
    expect((await own(f.sitter.auth)).body.verification.status).toBe("VERIFIED");
    await request(app).patch("/api/users/me").set("Authorization", f.sitter.auth).send({ fullName: "Anna Trzecia" });
    expect((await own(f.sitter.auth)).body.verification.status).toBe("UNVERIFIED");
  });
  it.skipIf(!configured)("expires draft files after 24 hours and pending submissions after 30 days", async () => {
    const f = await fixture(), files = await pending(f.sitter.auth);
    await cleanupExpiredVerificationFiles(new Date(Date.now() + 31 * 86_400_000));
    expect((await own(f.sitter.auth)).body.verification.status).toBe("UNVERIFIED");
    expect(await prisma.sitterVerificationFile.count({ where: { profileId: f.profile.id } })).toBe(0);
    expect((await review(f.operator.auth, f.sitter.id, files.version)).status).toBe(409);
  });
  it.skipIf(!configured)("invalidates identity after a confirmed email change and refuses approval for an inactive account", async () => {
    const f = await fixture(), files = await pending(f.sitter.auth);
    await prisma.account.update({ where: { id: f.sitter.id }, data: { blockedAt: new Date() } });
    expect((await review(f.operator.auth, f.sitter.id, files.version)).body.error).toBe("ACCOUNT_UNAVAILABLE");
    await prisma.account.update({ where: { id: f.sitter.id }, data: { blockedAt: null, passwordHash: await hashPassword("Strong@Test1") } });
    expect((await review(f.operator.auth, f.sitter.id, files.version)).status).toBe(200);
    const changed = await request(app).post("/api/account/email").set("Authorization", f.sitter.auth).send({ email: `${randomUUID()}@changed.test`, password: "Strong@Test1" });
    expect(changed.status).toBe(202);
    expect((await request(app).post("/api/auth/email-change/confirm").send({ token: changed.body.debugToken })).status).toBe(204);
    const profile = await prisma.sitterProfile.findUniqueOrThrow({ where: { id: f.profile.id } });
    expect(profile.verificationStatus).toBe("UNVERIFIED");
    expect((await own(f.sitter.auth)).status).toBe(401);
  });
  it.skipIf(!configured)("serializes identity edits with approval so no stale identity remains verified", async () => {
    const f = await fixture(), files = await pending(f.sitter.auth);
    const [decision, changed] = await Promise.all([
      review(f.operator.auth, f.sitter.id, files.version),
      request(app).patch("/api/users/me").set("Authorization", f.sitter.auth).send({ fullName: "Nowe Dane Tożsamości" })
    ]);
    expect([200, 409]).toContain(decision.status); expect(changed.status).toBe(200);
    expect((await own(f.sitter.auth)).body.verification.status).toBe("UNVERIFIED");
  });
});
