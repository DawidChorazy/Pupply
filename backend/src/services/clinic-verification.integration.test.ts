import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../app";
import { prisma } from "../config/prisma";
import { signAccessToken } from "../utils/tokens";
import { requireVerifiedClinic } from "./account-access.service";
import { hashToken } from "../utils/tokens";

const ids: string[] = [];
const password = "Strong@Test1";
const details = { address: "ul. Testowa 1, 00-001 Warszawa", registrationNumber: "TEST-ZLZ-123" };
const approval = { decision: "APPROVE", reason: "Sprawdzono wpis oraz reprezentanta placówki.",
  registryConfirmed: true, representativeConfirmed: true, evidenceUrl: "https://wetsystems.org.pl/WetSystemsInfo/zinfo.html" };

function testNip() {
  while (true) {
    const digits = Array.from({ length: 9 }, (_, i) => i === 0 ? 7 : Math.floor(Math.random() * 10));
    const control = [6, 5, 7, 2, 3, 4, 5, 6, 7].reduce((sum, weight, i) => sum + digits[i] * weight, 0) % 11;
    if (control !== 10) return digits.join("") + control;
  }
}

async function clinic(verifiedEmail = true) {
  const email = `${randomUUID()}@clinic-verification.test`;
  const response = await request(app).post("/api/auth/register/clinic").send({
    email, clinicName: "Testowa klinika", nip: testNip(), phone: "+48123456789", password, confirmPassword: password,
    verificationStatus: "VERIFIED"
  });
  expect(response.status).toBe(201);
  const id = response.body.account.id;
  ids.push(id);
  if (verifiedEmail) await prisma.account.update({ where: { id }, data: { emailVerifiedAt: new Date() } });
  return { id, email, auth: `Bearer ${response.body.accessToken}`, body: response.body };
}

async function admin() {
  const account = await prisma.account.create({ data: { email: `${randomUUID()}@clinic-admin.test`, role: "ADMIN", emailVerifiedAt: new Date() } });
  ids.push(account.id);
  return { id: account.id, auth: `Bearer ${signAccessToken(account.id, "ADMIN")}` };
}

const own = (auth: string) => request(app).get("/api/clinics/me").set("Authorization", auth);
const submit = (auth: string, version: number) => request(app).post("/api/clinics/me/verification").set("Authorization", auth).send({ expectedVersion: version });
const review = (auth: string, id: string, version: number, data = approval) => request(app)
  .post(`/api/admin/clinics/${id}/verification`).set("Authorization", auth).send({ ...data, expectedVersion: version });
async function prepare(auth: string) {
  const updated = await request(app).patch("/api/clinics/me").set("Authorization", auth).send(details);
  expect(updated.status).toBe(200);
  const response = await submit(auth, updated.body.profile.verification.version);
  expect(response.status).toBe(202);
  return response.body.verification.version as number;
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { targetAccountId: { in: ids } } });
  await prisma.account.deleteMany({ where: { id: { in: ids.splice(0) } } });
});
afterAll(() => prisma.$disconnect());

describe("clinic verification lifecycle", () => {
  it("rejects incorrect NIPs and keeps new accounts unverified even if they submit a status", async () => {
    const invalid = await request(app).post("/api/auth/register/clinic").send({
      email: `${randomUUID()}@invalid.test`, clinicName: "Invalid clinic", nip: "1234567890", phone: "+48123456789", password, confirmPassword: password
    });
    expect(invalid.status).toBe(400);
    const account = await clinic();
    expect(account.body.account.profile.verificationStatus).toBe("UNVERIFIED");
    const profile = await own(account.auth);
    expect(profile.body.profile.verification).toMatchObject({ status: "UNVERIFIED", canPublishServices: false, canAcceptBookings: false });
    expect((await submit(account.auth, 0)).status).toBe(400);
    expect((await request(app).patch("/api/clinics/me").set("Authorization", account.auth).send({ verificationStatus: "VERIFIED" })).status).toBe(400);
    await expect(prisma.$transaction(tx => requireVerifiedClinic(account.id, tx))).rejects.toMatchObject({ code: "CLINIC_NOT_VERIFIED" });
  });

  it("requires email verification and restricts both review and queue access to administrators", async () => {
    const account = await clinic(false);
    const updated = await request(app).patch("/api/clinics/me").set("Authorization", account.auth).send(details);
    expect((await submit(account.auth, updated.body.profile.verification.version)).status).toBe(403);
    expect((await request(app).get("/api/admin/clinics").set("Authorization", account.auth)).status).toBe(403);
    expect((await review(account.auth, account.id, 1)).status).toBe(403);
    expect((await request(app).get("/api/clinics/me")).status).toBe(401);
    const operator = await admin();
    expect((await submit(operator.auth, 0)).status).toBe(403);
  });

  it("allows a legacy clinic to correct its NIP and prevents duplicate normalized NIPs", async () => {
    const account = await clinic();
    const profile = await prisma.clinicProfile.update({ where: { accountId: account.id }, data: { ...details, nip: "1234567890" } });
    expect((await submit(account.auth, profile.verificationVersion)).status).toBe(400);
    const repaired = await request(app).patch("/api/clinics/me").set("Authorization", account.auth).send({ nip: "123-456-32-18" });
    expect(repaired.status).toBe(200);
    expect(repaired.body.profile.nip).toBe("1234563218");
    expect((await submit(account.auth, repaired.body.profile.verification.version)).status).toBe(202);
    const duplicate = await request(app).post("/api/auth/register/clinic").send({
      email: `${randomUUID()}@duplicate.test`, clinicName: "Duplikat", nip: "123 456 32 18", phone: "+48123456789", password, confirmPassword: password
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toBe("NIP_TAKEN");
  });

  it("lists the queue, requires evidence, approves one snapshot, and records the decision", async () => {
    const account = await clinic(), operator = await admin();
    const version = await prepare(account.auth);
    expect((await submit(account.auth, version)).status).toBe(409);
    const queue = await request(app).get("/api/admin/clinics?pageSize=1").set("Authorization", operator.auth);
    expect(queue.status).toBe(200);
    expect(queue.body.items.some((p: { accountId: string }) => p.accountId === account.id)).toBe(true);
    expect(queue.body.items[0].account).not.toHaveProperty("passwordHash");
    const detail = await request(app).get(`/api/admin/clinics/${account.id}/verification`).set("Authorization", operator.auth);
    expect(detail.body.profile).toMatchObject(details);
    expect((await review(operator.auth, account.id, version, { ...approval, registryConfirmed: false })).status).toBe(400);
    expect((await review(operator.auth, account.id, version - 1)).status).toBe(409);
    const response = await review(operator.auth, account.id, version);
    expect(response.status).toBe(200);
    expect(response.body.verification).toMatchObject({ status: "VERIFIED", canPublishServices: true, canAcceptBookings: true });
    expect((await review(operator.auth, account.id, version)).status).toBe(409);
    await expect(prisma.$transaction(tx => requireVerifiedClinic(account.id, tx))).resolves.toMatchObject({ verificationStatus: "VERIFIED" });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { targetAccountId: account.id, action: "CLINIC_VERIFICATION_VERIFIED" } });
    expect(JSON.parse(log.reason!)).toMatchObject({ evidenceUrl: approval.evidenceUrl, registryConfirmed: true, representativeConfirmed: true, ...details });
    expect(log.actorAccountId).toBe(operator.id);
  });

  it("allows rejection and resubmission, and invalidates approval on real profile changes", async () => {
    const account = await clinic(), operator = await admin();
    let version = await prepare(account.auth);
    const rejected = await request(app).post(`/api/admin/clinics/${account.id}/verification`).set("Authorization", operator.auth)
      .send({ decision: "REJECT", expectedVersion: version, reason: "Potrzebne potwierdzenie reprezentanta." });
    expect(rejected.status).toBe(200);
    expect((await own(account.auth)).body.profile.verification.reason).toContain("reprezentanta");
    const resubmitted = await submit(account.auth, rejected.body.verification.version);
    expect(resubmitted.status).toBe(202);
    version = resubmitted.body.verification.version;
    expect((await review(operator.auth, account.id, version)).status).toBe(200);
    const unchanged = await request(app).patch("/api/clinics/me").set("Authorization", account.auth).send(details);
    expect(unchanged.body.profile.verification.status).toBe("VERIFIED");
    const changed = await request(app).patch("/api/clinics/me").set("Authorization", account.auth).send({ address: "ul. Nowa 2, Warszawa" });
    expect(changed.body.profile.verification).toMatchObject({ status: "UNVERIFIED", reviewedAt: null, canAcceptBookings: false });
    expect(await prisma.auditLog.count({ where: { targetAccountId: account.id, action: "CLINIC_VERIFICATION_INVALIDATED" } })).toBe(1);
  });

  it("serializes competing reviews and profile edits without leaving stale approval", async () => {
    const account = await clinic(), operator = await admin();
    let version = await prepare(account.auth);
    const reviews = await Promise.all([review(operator.auth, account.id, version), review(operator.auth, account.id, version)]);
    expect(reviews.map(r => r.status).sort()).toEqual([200, 409]);
    await request(app).patch("/api/clinics/me").set("Authorization", account.auth).send({ clinicName: "Nowa nazwa" });
    version = (await own(account.auth)).body.profile.verification.version;
    const submitted = await submit(account.auth, version);
    expect(submitted.status).toBe(202);
    const [decision, edited] = await Promise.all([
      review(operator.auth, account.id, submitted.body.verification.version),
      request(app).patch("/api/clinics/me").set("Authorization", account.auth).send({ phone: "+48987654321" })
    ]);
    expect([200, 409]).toContain(decision.status);
    expect(edited.status).toBe(200);
    expect((await own(account.auth)).body.profile.verification.status).toBe("UNVERIFIED");
  });

  it("refuses inactive accounts and resets verification after a confirmed email change", async () => {
    const account = await clinic(), operator = await admin();
    let version = await prepare(account.auth);
    await prisma.account.update({ where: { id: account.id }, data: { blockedAt: new Date() } });
    expect((await review(operator.auth, account.id, version)).status).toBe(409);
    await prisma.account.update({ where: { id: account.id }, data: { blockedAt: null } });
    expect((await review(operator.auth, account.id, version)).status).toBe(200);
    const token = randomUUID();
    await prisma.accountActionToken.create({ data: { accountId: account.id, type: "EMAIL_CHANGE", tokenHash: hashToken(token),
      pendingEmail: `${randomUUID()}@new-clinic.test`, expiresAt: new Date(Date.now() + 60_000) } });
    expect((await request(app).post("/api/auth/email-change/confirm").send({ token })).status).toBe(204);
    expect((await prisma.clinicProfile.findUniqueOrThrow({ where: { accountId: account.id } })).verificationStatus).toBe("UNVERIFIED");
    await expect(prisma.$transaction(tx => requireVerifiedClinic(account.id, tx))).rejects.toMatchObject({ code: "CLINIC_NOT_VERIFIED" });
  });
});
