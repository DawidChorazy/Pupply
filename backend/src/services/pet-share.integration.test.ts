import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../app";
import { prisma } from "../config/prisma";
import { signAccessToken, hashToken } from "../utils/tokens";

const ids: string[] = [];
async function fixture() {
  const user = async () => {
    const account = await prisma.account.create({ data: { email: `${randomUUID()}@share.test`, role: "USER" } });
    ids.push(account.id);
    return { id: account.id, auth: `Bearer ${signAccessToken(account.id, "USER")}` };
  };
  const owner = await user(), stranger = await user();
  const pet = await prisma.pet.create({ data: { accountId: owner.id, name: "Figa", gender: "FEMALE", notes: "Spacer w szelkach", allergies: "Kurczak" } });
  const otherPet = await prisma.pet.create({ data: { accountId: stranger.id, name: "Luna", gender: "FEMALE" } });
  const base = `/api/pets/${pet.id}/shares`;
  const create = (input: object = {}) => request(app).post(base).set("Authorization", owner.auth).send(input);
  return { owner, stranger, pet, otherPet, base, create };
}
const tokenOf = (response: { body: { url: string } }) => new URLSearchParams(new URL(response.body.url).hash.slice(1)).get("token")!;
const card = (token: string) => request(app).get("/api/shared-pets/card").set("X-Pet-Share-Token", token);
const download = (token: string, id: string) => request(app).get(`/api/shared-pets/documents/${id}/download`).set("X-Pet-Share-Token", token);

afterEach(async () => { await prisma.account.deleteMany({ where: { id: { in: ids.splice(0) } } }); });
afterAll(() => prisma.$disconnect());

describe("read-only pet sharing", () => {
  it("creates a seven-day capability, stores only its hash and returns no owner identifiers", async () => {
    const { pet, base, owner, create } = await fixture();
    const before = Date.now();
    const created = await create({ label: "  Weekend  " });
    expect(created.status).toBe(201);
    const token = tokenOf(created);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.body.share).toMatchObject({ label: "Weekend", includeDocuments: false });
    expect(Date.parse(created.body.share.expiresAt) - before).toBeGreaterThanOrEqual(7 * 86_400_000);
    expect(Date.parse(created.body.share.expiresAt) - before).toBeLessThan(7 * 86_400_000 + 5000);
    const stored = await prisma.petShareLink.findUniqueOrThrow({ where: { id: created.body.share.id } });
    expect(stored.tokenHash).toBe(hashToken(token)); expect(JSON.stringify(stored)).not.toContain(token);
    const view = await card(token);
    expect(view.status).toBe(200);
    expect(view.body.pet).toEqual({ name: "Figa", gender: "FEMALE", age: null, weight: null, breed: null, photoUrl: null, illnesses: null, allergies: "Kurczak", vaccines: null, vet: null, notes: "Spacer w szelkach" });
    expect(view.body.documents).toEqual([]);
    expect(view.headers["cache-control"]).toContain("no-store");
    expect(view.headers["referrer-policy"]).toBe("no-referrer");
    expect(view.headers["x-robots-tag"]).toContain("noindex");
    const listed = await request(app).get(base).set("Authorization", owner.auth);
    expect(listed.body.shares).toHaveLength(1);
    expect(JSON.stringify(listed.body)).not.toMatch(/token|url|petId|accountId/);
    await prisma.pet.update({ where: { id: pet.id }, data: { notes: "Nowa notatka" } });
    expect((await card(token)).body.pet.notes).toBe("Nowa notatka");
  });

  it("permits only the owner to manage links and never grants editing permissions", async () => {
    const { pet, base, stranger, create } = await fixture();
    const created = await create(); const token = tokenOf(created);
    expect((await request(app).post(base).send({})).status).toBe(401);
    expect((await request(app).get(base).set("Authorization", stranger.auth)).status).toBe(404);
    expect((await request(app).post(base).set("Authorization", stranger.auth).send({})).status).toBe(404);
    expect((await request(app).delete(`${base}/${created.body.share.id}`).set("Authorization", stranger.auth)).status).toBe(404);
    expect((await request(app).patch(`/api/pets/${pet.id}`).set("X-Pet-Share-Token", token).send({ name: "Changed" })).status).toBe(401);
    expect((await request(app).get(`/api/pets/${pet.id}/documents`).set("X-Pet-Share-Token", token)).status).toBe(401);
    expect((await card(token)).body.pet.name).toBe("Figa");
  });

  it("revokes links idempotently and returns the same 404 for missing, invalid, expired and revoked tokens", async () => {
    const { base, owner, create } = await fixture();
    const created = await create(); const token = tokenOf(created);
    expect((await request(app).delete(`${base}/${created.body.share.id}`).set("Authorization", owner.auth)).status).toBe(204);
    expect((await request(app).delete(`${base}/${created.body.share.id}`).set("Authorization", owner.auth)).status).toBe(204);
    const revoked = await card(token);
    expect(revoked.status).toBe(404);
    const expired = await create();
    await prisma.petShareLink.update({ where: { id: expired.body.share.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    for (const response of [await request(app).get("/api/shared-pets/card"), await card("invalid"), await card("a".repeat(43)), await card(tokenOf(expired))]) {
      expect(response.status).toBe(404); expect(response.body.message).toBe(revoked.body.message);
    }
    expect((await request(app).get(`/api/shared-pets/card?token=${tokenOf(expired)}`)).status).toBe(404);
  });

  it("stops sharing when the owner's account is blocked or deactivated and cascades on pet deletion", async () => {
    const { owner, pet, create } = await fixture();
    const token = tokenOf(await create());
    await prisma.account.update({ where: { id: owner.id }, data: { blockedAt: new Date() } });
    expect((await card(token)).status).toBe(404);
    await prisma.account.update({ where: { id: owner.id }, data: { blockedAt: null, deactivatedAt: new Date() } });
    expect((await card(token)).status).toBe(404);
    await prisma.pet.delete({ where: { id: pet.id } });
    expect(await prisma.petShareLink.count({ where: { petId: pet.id } })).toBe(0);
    expect((await card(token)).status).toBe(404);
  });

  it("excludes PDFs by default, isolates pets, and hides unfinished uploads and storage keys", async () => {
    const { pet, otherPet, create } = await fixture();
    const ready = await prisma.petDocument.create({ data: { petId: pet.id, name: "Gotowy.pdf", sizeBytes: 40, objectKey: `test/${randomUUID()}.pdf`, uploadedAt: new Date() } });
    await prisma.petDocument.create({ data: { petId: pet.id, name: "W toku.pdf", sizeBytes: 40, objectKey: `test/${randomUUID()}.pdf` } });
    const other = await prisma.petDocument.create({ data: { petId: otherPet.id, name: "Cudzy.pdf", sizeBytes: 40, objectKey: `test/${randomUUID()}.pdf`, uploadedAt: new Date() } });
    const token = tokenOf(await create());
    expect((await card(token)).body.documents).toEqual([]);
    expect((await download(token, ready.id)).status).toBe(404);
    const included = tokenOf(await create({ includeDocuments: true }));
    const view = await card(included);
    expect(view.body.documents).toEqual([{ id: ready.id, name: "Gotowy.pdf", sizeBytes: 40, expiresAt: null }]);
    expect(JSON.stringify(view.body)).not.toMatch(/objectKey|petId|accountId|uploadedAt/);
    expect((await download(included, other.id)).status).toBe(404);
  });

  it("validates input and serializes the 20 active link limit under concurrent creation", async () => {
    const { create, base, owner } = await fixture();
    expect((await create({ includeDocuments: "true" })).status).toBe(400);
    expect((await create({ label: "x".repeat(81) })).status).toBe(400);
    for (let n = 0; n < 19; n++) expect((await create()).status).toBe(201);
    const results = await Promise.all([create(), create()]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    const shares = (await request(app).get(base).set("Authorization", owner.auth)).body.shares;
    expect(shares).toHaveLength(20);
    await request(app).delete(`${base}/${shares[0].id}`).set("Authorization", owner.auth);
    expect((await create()).status).toBe(201);
  });

  it("keeps an older active link revocable even after more than 100 newer revoked links", async () => {
    const { create, pet, base, owner } = await fixture();
    const active = await create();
    await prisma.petShareLink.update({ where: { id: active.body.share.id }, data: { createdAt: new Date(Date.now() - 86_400_000) } });
    await prisma.petShareLink.createMany({ data: Array.from({ length: 110 }, () => ({
      petId: pet.id, tokenHash: hashToken(randomUUID()), expiresAt: new Date(Date.now() + 86_400_000), revokedAt: new Date()
    })) });
    const result = await request(app).get(base).set("Authorization", owner.auth);
    expect(result.body.shares).toHaveLength(100);
    expect(result.body.shares[0].id).toBe(active.body.share.id);
  });

  const storageIt = process.env.S3_ENDPOINT ? it : it.skip;
  storageIt("downloads an actual private PDF with a bounded URL and denies new downloads after revocation", async () => {
    const { owner, pet, base, create } = await fixture();
    const documents = `/api/pets/${pet.id}/documents`;
    const bytes = Buffer.from("%PDF-1.4\nShared Pupply fixture\n%%EOF");
    const upload = await request(app).post(`${documents}/upload`).set("Authorization", owner.auth).send({ name: "Szczepienia.pdf", sizeBytes: bytes.length });
    expect(upload.status).toBe(201);
    await fetch(upload.body.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: bytes });
    expect((await request(app).patch(`${documents}/${upload.body.document.id}`).set("Authorization", owner.auth).send({})).status).toBe(200);
    const created = await create({ includeDocuments: true }); const token = tokenOf(created);
    const result = await download(token, upload.body.document.id);
    expect(result.status).toBe(200); expect(result.body.expiresIn).toBe(60);
    expect(new URL(result.body.url).searchParams.get("X-Amz-Expires")).toBe("60");
    expect(await (await fetch(result.body.url)).text()).toBe(bytes.toString());
    await prisma.petShareLink.update({ where: { id: created.body.share.id }, data: { expiresAt: new Date(Date.now() + 30_000) } });
    expect((await download(token, upload.body.document.id)).body.expiresIn).toBeLessThanOrEqual(30);
    await request(app).delete(`${base}/${created.body.share.id}`).set("Authorization", owner.auth);
    expect((await download(token, upload.body.document.id)).status).toBe(404);
    await request(app).delete(`${documents}/${upload.body.document.id}`).set("Authorization", owner.auth);
  });
});
