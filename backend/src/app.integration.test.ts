import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { app } from "./app";
import { prisma } from "./config/prisma";

const password = "Strong@Test1";

async function registerUser(suffix: string) {
  const response = await request(app).post("/api/auth/register/user").send({
    fullName: `User ${suffix}`,
    email: `${suffix}@example.com`,
    phone: `+48123${suffix.padStart(6, "0").slice(-6)}`,
    password,
    confirmPassword: password
  });
  expect(response.status).toBe(201);
  return response.body as { accessToken: string; refreshToken: string; account: { id: string } };
}

beforeEach(async () => {
  await prisma.account.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("API integration", () => {
  it("checks database readiness", async () => {
    const response = await request(app).get("/api/ready");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ready");
  });

  it("rotates refresh tokens, detects replay, logs out and resets password", async () => {
    const auth = await registerUser("100001");
    const rotated = await request(app).post("/api/auth/refresh").send({ refreshToken: auth.refreshToken });
    expect(rotated.status).toBe(200);

    const replay = await request(app).post("/api/auth/refresh").send({ refreshToken: auth.refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.error).toBe("REFRESH_TOKEN_REUSED");
    expect((await request(app).post("/api/auth/refresh").send({ refreshToken: rotated.body.refreshToken })).status).toBe(401);

    const resetRequest = await request(app)
      .post("/api/auth/password-reset/request")
      .send({ email: "100001@example.com" });
    expect(resetRequest.status).toBe(202);
    expect(resetRequest.body.debugToken).toBeTypeOf("string");
    const newPassword = "NewStrong@Test2";
    expect((await request(app).post("/api/auth/password-reset/confirm").send({
      token: resetRequest.body.debugToken,
      password: newPassword,
      confirmPassword: newPassword
    })).status).toBe(204);
    expect((await request(app).post("/api/auth/login").send({ email: "100001@example.com", password })).status).toBe(401);
    const login = await request(app).post("/api/auth/login").send({ email: "100001@example.com", password: newPassword });
    const secondLogin = await request(app).post("/api/auth/login").send({ email: "100001@example.com", password: newPassword });
    expect(login.status).toBe(200);
    expect((await request(app).post("/api/auth/logout-all").set("Authorization", `Bearer ${login.body.accessToken}`)).status).toBe(204);
    expect((await request(app).post("/api/auth/refresh").send({ refreshToken: login.body.refreshToken })).status).toBe(401);
    expect((await request(app).post("/api/auth/refresh").send({ refreshToken: secondLogin.body.refreshToken })).status).toBe(401);

    const currentSession = await request(app).post("/api/auth/login").send({ email: "100001@example.com", password: newPassword });
    expect((await request(app).post("/api/auth/logout").send({ refreshToken: currentSession.body.refreshToken })).status).toBe(204);
    expect((await request(app).post("/api/auth/refresh").send({ refreshToken: currentSession.body.refreshToken })).status).toBe(401);
  });

  it("updates profiles and keeps pets isolated between accounts", async () => {
    const owner = await registerUser("100002");
    const stranger = await registerUser("100003");
    const updated = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ fullName: "Updated Owner", birthDate: "2000-01-02" });
    expect(updated.status).toBe(200);
    expect(updated.body.profile.fullName).toBe("Updated Owner");

    const verification = await request(app)
      .post("/api/auth/email-verification/request")
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(verification.status).toBe(202);
    expect((await request(app).post("/api/auth/email-verification/confirm").send({ token: verification.body.debugToken })).status).toBe(204);
    const verifiedProfile = await request(app).get("/api/users/me").set("Authorization", `Bearer ${owner.accessToken}`);
    expect(verifiedProfile.body.profile.emailVerifiedAt).toBeTypeOf("string");

    const created = await request(app)
      .post("/api/pets")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Luna", gender: "FEMALE" });
    expect(created.status).toBe(201);
    const petId = created.body.pet.id;
    expect((await request(app).get(`/api/pets/${petId}`).set("Authorization", `Bearer ${stranger.accessToken}`)).status).toBe(404);
    expect((await request(app).delete(`/api/pets/${petId}`).set("Authorization", `Bearer ${owner.accessToken}`)).status).toBe(204);
  });

  it("supports the minimal clinic profile API", async () => {
    const clinic = await request(app).post("/api/auth/register/clinic").send({
      clinicName: "Pupply Vet",
      nip: "1234567890",
      email: "clinic@example.com",
      phone: "+48111111111",
      password,
      confirmPassword: password
    });
    expect(clinic.status).toBe(201);
    const updated = await request(app)
      .patch("/api/clinics/me")
      .set("Authorization", `Bearer ${clinic.body.accessToken}`)
      .send({ clinicName: "Pupply Vet Warszawa" });
    expect(updated.status).toBe(200);
    expect(updated.body.profile.clinicName).toBe("Pupply Vet Warszawa");
  });

  it("creates sitter availability, prevents double booking and emits notifications", async () => {
    const owner = await registerUser("100004");
    const sitter = await registerUser("100005");
    const petResponse = await request(app)
      .post("/api/pets")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Figa", gender: "FEMALE" });
    const sitterProfile = await request(app)
      .post("/api/sitters/me")
      .set("Authorization", `Bearer ${sitter.accessToken}`)
      .send({
        bio: "Doświadczony opiekun psów z bezpiecznym ogrodem.",
        city: "Warszawa",
        latitude: 52.2297,
        longitude: 21.0122,
        serviceRadiusKm: 20,
        services: [{ type: "DOG_WALK", durationMinutes: 60, priceCents: 5000 }]
      });
    expect(sitterProfile.status).toBe(201);
    const serviceId = sitterProfile.body.profile.services[0].id;
    const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 90 * 60 * 1000);
    const slot = await request(app)
      .post("/api/sitters/me/availability")
      .set("Authorization", `Bearer ${sitter.accessToken}`)
      .send({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
    expect(slot.status).toBe(201);

    const search = await request(app).get("/api/sitters").query({
      latitude: 52.23,
      longitude: 21.01,
      serviceType: "DOG_WALK"
    });
    expect(search.status).toBe(200);
    expect(search.body.items).toHaveLength(1);
    expect(search.body.items[0]).not.toHaveProperty("latitude");
    expect(search.body.items[0].availability).toHaveLength(1);
    expect(search.body.items[0].availability[0].id).toBe(slot.body.slot.id);

    const bookingPayload = {
      petId: petResponse.body.pet.id,
      sitterServiceId: serviceId,
      availabilitySlotId: slot.body.slot.id
    };
    const booking = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(bookingPayload);
    expect(booking.status).toBe(201);
    expect((await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(bookingPayload)).status).toBe(409);

    const accepted = await request(app)
      .patch(`/api/bookings/${booking.body.booking.id}/status`)
      .set("Authorization", `Bearer ${sitter.accessToken}`)
      .send({ status: "ACCEPTED" });
    expect(accepted.status).toBe(200);
    const notifications = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(notifications.body.count).toBe(1);
  });

  const storageIt = process.env.S3_ENDPOINT ? it : it.skip;
  storageIt("uploads, attaches and removes a pet photo in S3-compatible storage", async () => {
    const owner = await registerUser("100006");
    const photoBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const signed = await request(app)
      .post("/api/uploads/pet-photo")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ contentType: "image/jpeg", sizeBytes: photoBytes.length });
    expect(signed.status).toBe(201);

    const upload = await fetch(signed.body.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg", "Content-Length": String(photoBytes.length) },
      body: photoBytes
    });
    expect(upload.status).toBe(200);

    const pet = await request(app)
      .post("/api/pets")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Foto", gender: "MALE", photoKey: signed.body.photoKey });
    expect(pet.status).toBe(201);
    expect(pet.body.pet.photoUrl).toContain(signed.body.photoKey);
    expect((await fetch(pet.body.pet.photoUrl)).status).toBe(200);
    expect((await request(app).delete(`/api/pets/${pet.body.pet.id}`).set("Authorization", `Bearer ${owner.accessToken}`)).status).toBe(204);
    expect((await fetch(pet.body.pet.photoUrl)).status).toBe(404);
  });
});
