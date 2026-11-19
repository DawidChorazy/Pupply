const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const { assertTestDatabase } = require("../dist/utils/test-database");

assertTestDatabase(process.env.DATABASE_URL);
for (const key of ["DATABASE_URL", "MAILPIT_URL", "S3_ENDPOINT", "S3_PUBLIC_ENDPOINT"]) {
  assert.equal(new URL(process.env[key]).hostname, "127.0.0.1", key);
}
assert.equal(process.env.SMTP_HOST, "127.0.0.1");
const { app } = require("../dist/app");
const { prisma } = require("../dist/config/prisma");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE8sAAAAASUVORK5CYII=", "base64");
const imageMeta = { contentType: "image/png", sizeBytes: png.length };
const password = 'Test!' + randomUUID();

async function actionToken(email, pathname) {
  const mailbox = process.env.MAILPIT_URL + "/api/v1";
  for (let attempt = 0; attempt < 30; attempt++) {
    const inbox = await (await fetch(mailbox + "/messages")).json();
    for (const entry of inbox.messages.filter(m => m.To.some(to => to.Address === email))) {
      const mail = await (await fetch(mailbox + "/message/" + entry.ID)).json();
      const link = mail.Text.match(/https?:\/\/[^\s]+/u)?.[0];
      if (!link) continue;
      const url = new URL(link);
      if (url.pathname !== pathname) continue;
      assert.equal(url.origin, process.env.APP_PUBLIC_URL);
      const token = url.searchParams.get("token");
      assert.ok(token, "The email link must include an action token");
      return token;
    }
    await delay(150);
  }
  throw new Error("Mailpit did not receive the expected " + pathname + " link");
}

async function upload(url) {
  const sent = await fetch(url, { method: "PUT", headers: { "Content-Type": imageMeta.contentType }, body: png });
  assert.equal(sent.status, 200, "MinIO upload");
}

async function exercise(api) {
  async function call(method, route, actor, body, expected = 200, extraHeaders = {}) {
    const response = await fetch(api + route, {
      method, signal: AbortSignal.timeout(15_000),
      headers: { ...(actor && { Authorization: "Bearer " + actor.accessToken }), ...(body && { "Content-Type": "application/json" }), ...extraHeaders },
      body: JSON.stringify(body)
    });
    const result = response.status === 204 ? null : await response.json();
    assert.equal(response.status, expected, method + " " + route + " " + (result?.error || ""));
    return result;
  }

  async function register(label) {
    const email = label + "-" + randomUUID() + "@example.test";
    const user = await call("POST", "/auth/register/user", null, {
      fullName: label + " Test", email, phone: "+48123456789", password, confirmPassword: password
    }, 201);
    await call("POST", "/auth/email-verification/request", user, undefined, 202);
    const token = await actionToken(email, "/verify-email");
    await call("POST", "/auth/email-verification/confirm", null, { token }, 204);
    return { ...user, email };
  }

  await call("GET", "/ready");
  const owner = await register("owner"), sitter = await register("sitter"), operator = await register("admin");
  execFileSync(process.execPath, [path.join(__dirname, "../dist/scripts/grant-admin.js"), operator.email]);
  const admin = await call("POST", "/auth/login", null, { email: operator.email, password });
  console.log("PASS registration and verification using links from three SMTP messages");

  const profile = (await call("POST", "/sitters/me", sitter, {
    bio: "Spacery i spokojna opieka nad psami.", city: "Warszawa", latitude: 52, longitude: 21,
    services: [{ type: "DOG_WALK", durationMinutes: 30, priceCents: 0 }]
  }, 201)).profile;
  const verification = "/sitters/me/verification";
  async function evidence(purpose) {
    const file = await call("POST", verification + "/files", sitter, { ...imageMeta, purpose }, 201);
    await upload(file.uploadUrl);
    await call("POST", verification + "/files/" + file.fileId + "/complete", sitter);
    return file.fileId;
  }
  const submitted = await call("POST", verification, sitter, {
    expectedVersion: 0, documentFileId: await evidence("IDENTITY_DOCUMENT"), faceFileId: await evidence("FACE_PHOTO")
  }, 202);
  const adminPath = "/admin/sitters/" + sitter.account.id + "/verification";
  const dossier = await call("GET", adminPath, admin);
  assert.equal(dossier.files.length, 2);
  for (const file of dossier.files) {
    const { url } = await call("GET", adminPath + "/files/" + file.id, admin);
    assert.deepEqual(Buffer.from(await (await fetch(url)).arrayBuffer()), png);
  }
  const approved = await call("POST", adminPath, admin, { decision: "APPROVE", reason: "Sprawdzono pliki testowe.",
    documentConfirmed: true, faceConfirmed: true, expectedVersion: submitted.verification.version });
  assert.equal(approved.verification.status, "VERIFIED");
  console.log("PASS sitter evidence upload, private administrator preview and approval");

  const photo = await call("POST", "/uploads/pet-photo", owner, imageMeta, 201);
  await upload(photo.uploadUrl);
  const { pet } = await call("POST", "/pets", owner, { name: "Figa", gender: "FEMALE", breed: "Mieszaniec",
    size: "MEDIUM", temperament: "Spokojna", vaccines: "Aktualne", careInstructions: "Zabierz wodę", photoKey: photo.photoKey }, 201);
  const docs = "/pets/" + pet.id + "/documents";
  const proof = await call("POST", docs + "/upload", owner, { ...imageMeta, purpose: "VACCINATION", name: "Szczepienia.png" }, 201);
  await upload(proof.uploadUrl);
  await call("PATCH", docs + "/" + proof.document.id, owner, {});
  const download = await call("GET", docs + "/" + proof.document.id + "/download", owner);
  assert.deepEqual(Buffer.from(await (await fetch(download.url)).arrayBuffer()), png);
  assert.equal((await fetch(download.url.split("?")[0])).status, 403);
  assert.deepEqual((await call("GET", "/pets/" + pet.id, owner)).pet.missingFields, []);

  const start = Date.now() + 600_000;
  const { slot } = await call("POST", "/sitters/me/availability", sitter, {
    startsAt: new Date(start).toISOString(), endsAt: new Date(start + 3_600_000).toISOString()
  }, 201);
  const nearby = await call("GET", "/sitters?latitude=52&longitude=21&serviceType=DOG_WALK");
  assert.ok(nearby.items.some(item => item.id === profile.id));
  const selection = { petId: pet.id, sitterServiceId: profile.services[0].id, availabilitySlotId: slot.id, pickupAddress: "Warszawa, Testowa 10" };
  const key = { "Idempotency-Key": randomUUID() };
  const first = await call("POST", "/bookings", owner, selection, 201, key);
  const retry = await call("POST", "/bookings", owner, selection, 201, key);
  assert.equal(first.booking.id, retry.booking.id);
  const booking = "/bookings/" + first.booking.id;
  await call("PATCH", booking + "/status", sitter, { status: "ACCEPTED" });
  assert.equal((await call("GET", booking, sitter)).booking.pet.careInstructions, "Zabierz wodę");
  console.log("PASS vaccination proof, search, booking retry, acceptance and sitter instructions");

  const walk = booking + "/walk";
  const started = await call("POST", walk + "/start", sitter);
  const recorded = Date.parse(started.session.startedAt);
  const points = [0, 1].map(i => ({ clientPointId: randomUUID(), latitude: 52 + i * 0.0001, longitude: 21,
    accuracy: 4, capturedAt: new Date(recorded + i * 5000).toISOString() }));
  await call("POST", walk + "/points", sitter, { points });
  await call("POST", walk + "/points", sitter, { points });
  const route = await call("GET", walk, owner);
  assert.equal(route.points.length, 2);
  assert.ok(route.session.distanceMeters > 10 && route.session.distanceMeters < 12);
  await call("POST", walk + "/finish", sitter, {});
  assert.equal((await call("GET", booking, owner)).booking.status, "COMPLETED");
  const feed = await call("GET", "/notifications", owner);
  assert.ok(feed.items.some(item => item.bookingId === first.booking.id && item.type === "BOOKING_COMPLETED"));
  console.log("PASS GPS upload retry, owner route and distance, completion notification");

  await call("POST", "/auth/password-reset/request", null, { email: owner.email }, 202);
  const token = await actionToken(owner.email, "/reset-password");
  const newPassword = "New!" + randomUUID();
  await call("POST", "/auth/password-reset/confirm", null, { token, password: newPassword, confirmPassword: newPassword }, 204);
  await call("GET", booking, owner, undefined, 401);
  const refreshed = await call("POST", "/auth/login", null, { email: owner.email, password: newPassword });
  assert.equal((await call("GET", booking, refreshed)).booking.status, "COMPLETED");
  console.log("PASS password reset via SMTP link, old session revoked, history available after login");
}

async function main() {
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    await exercise("http://127.0.0.1:" + server.address().port + "/api");
  } finally {
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
