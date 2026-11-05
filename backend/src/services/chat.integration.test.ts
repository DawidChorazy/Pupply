import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../app";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { signAccessToken } from "../utils/tokens";
import { sendMessage } from "./chat.service";
import { enqueueNotifications, deliverNotifications } from "./delivery.service";

const ids: string[] = [];
const pushEnabled = env.PUSH_ENABLED;
async function user(role: "USER" | "CLINIC" = "USER") {
  const account = await prisma.account.create({ data: { role, email: `${randomUUID()}@chat.test`, emailVerifiedAt: new Date(),
    ...(role === "USER" ? { userProfile: { create: { fullName: "Testowy Użytkownik", phone: "+48123456789" } } } : {}) } });
  ids.push(account.id);
  return { id: account.id, auth: `Bearer ${signAccessToken(account.id, role)}` };
}
async function fixture() {
  const a = await user(), b = await user(), stranger = await user();
  const sitter = await prisma.sitterProfile.create({ data: { accountId: b.id, bio: "Doświadczony opiekun zwierząt.",
    city: "Warszawa", latitude: 52, longitude: 21, services: { create: { type: "DOG_WALK", priceCents: 3000, durationMinutes: 30 } } }, include: { services: true } });
  return { a, b, stranger, sitter };
}
async function open(auth: string, sitterProfileId: string) {
  const response = await request(app).post("/api/conversations").set("Authorization", auth).send({ sitterProfileId });
  expect(response.status).toBe(200);
  return response.body.conversation;
}
const post = (auth: string, id: string, text: string, clientMessageId: string = randomUUID()) => request(app)
  .post(`/api/conversations/${id}/messages`).set("Authorization", auth).send({ text, clientMessageId });
const read = (auth: string, id: string, throughSequence: number) => request(app)
  .patch(`/api/conversations/${id}/read`).set("Authorization", auth).send({ throughSequence });
const get = (auth: string, path: string) => request(app).get(`/api/conversations${path}`).set("Authorization", auth);

afterEach(async () => {
  vi.unstubAllGlobals(); env.PUSH_ENABLED = pushEnabled;
  await prisma.booking.deleteMany({ where: { OR: [{ ownerAccountId: { in: ids } }, { sitterAccountId: { in: ids } }] } });
  await prisma.account.deleteMany({ where: { id: { in: ids.splice(0) } } });
});
afterAll(() => prisma.$disconnect());

describe("private chat", () => {
  it("opens exactly one conversation before booking and reuses it from either side of an unaccepted booking", async () => {
    const { a, b, sitter } = await fixture();
    const opened = await Promise.all(Array.from({ length: 5 }, () => open(a.auth, sitter.id)));
    expect(new Set(opened.map(item => item.id)).size).toBe(1);
    const pet = await prisma.pet.create({ data: { accountId: a.id, name: "Figa", gender: "FEMALE" } });
    const startsAt = new Date(Date.now() + 86_400_000);
    const slot = await prisma.availabilitySlot.create({ data: { sitterProfileId: sitter.id, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000) } });
    const booked = await request(app).post("/api/bookings").set("Authorization", a.auth).send({ petId: pet.id, sitterServiceId: sitter.services[0].id, availabilitySlotId: slot.id });
    expect(booked.status).toBe(201);
    expect(booked.body.booking.status).toBe("REQUESTED");
    for (const auth of [a.auth, b.auth]) {
      const response = await request(app).post("/api/conversations").set("Authorization", auth).send({ bookingId: booked.body.booking.id });
      expect(response.status).toBe(200); expect(response.body.conversation.id).toBe(opened[0].id);
    }
    expect(opened[0]).not.toHaveProperty("first");
    expect(opened[0].otherParticipant).not.toHaveProperty("email");
  });

  it("protects every endpoint from strangers, unauthenticated accounts and clinic accounts", async () => {
    const { a, b, stranger, sitter } = await fixture();
    const conversation = await open(a.auth, sitter.id), clinic = await user("CLINIC");
    expect((await request(app).get("/api/conversations")).status).toBe(401);
    expect((await get(clinic.auth, "")).status).toBe(403);
    expect((await get(stranger.auth, `/${conversation.id}`)).status).toBe(404);
    expect((await get(stranger.auth, `/${conversation.id}/messages`)).status).toBe(404);
    expect((await post(stranger.auth, conversation.id, "Podsłuch")).status).toBe(404);
    expect((await read(stranger.auth, conversation.id, 0)).status).toBe(404);
    expect((await get(stranger.auth, "")).body.items).toEqual([]);
    expect((await request(app).post("/api/conversations").set("Authorization", b.auth).send({ sitterProfileId: sitter.id })).status).toBe(409);
    expect((await request(app).post("/api/conversations").set("Authorization", stranger.auth).send({ recipientId: a.id })).status).toBe(400);
  });

  it("persists messages and notifications atomically and replays concurrent retries without duplicates", async () => {
    const { a, b, sitter } = await fixture(); const conversation = await open(a.auth, sitter.id);
    const key = randomUUID();
    const responses = await Promise.all(Array.from({ length: 6 }, () => post(a.auth, conversation.id, "  Cześć, czy termin jest wolny?  ", key)));
    expect(responses.map(r => r.status)).toEqual(Array(6).fill(201));
    expect(new Set(responses.map(r => r.body.message.id)).size).toBe(1);
    expect(responses[0].body.message).toMatchObject({ sequence: 1, text: "Cześć, czy termin jest wolny?", senderAccountId: a.id });
    expect((await post(a.auth, conversation.id, "Inna treść", key)).body.error).toBe("MESSAGE_KEY_REUSED");
    expect(await prisma.chatMessage.count({ where: { conversationId: conversation.id } })).toBe(1);
    const notifications = await prisma.notification.findMany({ where: { conversationId: conversation.id } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ accountId: b.id, type: "NEW_MESSAGE", chatMessageId: responses[0].body.message.id });
    expect(notifications[0].message).not.toContain("termin");
    expect((await get(b.auth, `/${conversation.id}/messages`)).body.items[0].id).toBe(responses[0].body.message.id);
    // A different author may independently use the same UUID.
    expect((await post(b.auth, conversation.id, "Tak!", key)).status).toBe(201);
  });

  it("validates content and limits sends per account, without trusting a client-supplied sender", async () => {
    const { a, sitter } = await fixture(); const conversation = await open(a.auth, sitter.id);
    for (const text of [" ", "a".repeat(4001)]) expect((await post(a.auth, conversation.id, text)).status).toBe(400);
    expect((await post(a.auth, conversation.id, "Tekst", "bad-key")).status).toBe(400);
    expect((await request(app).post(`/api/conversations/${conversation.id}/messages`).set("Authorization", a.auth)
      .send({ text: "Tekst", clientMessageId: randomUUID(), senderAccountId: "forged" })).status).toBe(400);
    const statuses = [];
    for (let i = 0; i < 27; i++) statuses.push((await post(a.auth, conversation.id, `Wiadomość ${i}`)).status);
    expect(statuses.at(-1)).toBe(429);
    expect(await prisma.chatMessage.count({ where: { conversationId: conversation.id } })).toBe(26);
  });

  it("orders simultaneous sends, pages history in both directions and isolates the conversation list", async () => {
    const { a, b, stranger, sitter } = await fixture(); const conversation = await open(a.auth, sitter.id);
    await Promise.all(Array.from({ length: 8 }, (_, i) => sendMessage(i % 2 ? b.id : a.id, "USER", conversation.id, { text: `Treść ${i}`, clientMessageId: randomUUID() })));
    const latest = await get(a.auth, `/${conversation.id}/messages?limit=3`);
    expect(latest.body.items.map((m: { sequence: number }) => m.sequence)).toEqual([6, 7, 8]);
    const previous = await get(a.auth, `/${conversation.id}/messages?limit=3&before=${latest.body.nextBefore}`);
    expect(previous.body.items.map((m: { sequence: number }) => m.sequence)).toEqual([3, 4, 5]);
    const forward = await get(a.auth, `/${conversation.id}/messages?limit=3&after=2`);
    expect(forward.body.items.map((m: { sequence: number }) => m.sequence)).toEqual([3, 4, 5]); expect(forward.body.hasMore).toBe(true);
    expect((await get(a.auth, `/${conversation.id}/messages?before=1&after=1`)).status).toBe(400);
    expect((await get(a.auth, `/${conversation.id}/messages?after=2147483648`)).status).toBe(400);
    const other = await open(stranger.auth, sitter.id);
    const first = await get(b.auth, "?limit=1"), second = await get(b.auth, `?limit=1&cursor=${encodeURIComponent(first.body.nextCursor)}`);
    expect(new Set([first.body.items[0].id, second.body.items[0].id])).toEqual(new Set([conversation.id, other.id]));
    expect(second.body.nextCursor).toBeNull();
    expect((await get(a.auth, "")).body.items.map((c: { id: string }) => c.id)).toEqual([conversation.id]);
    expect((await get(a.auth, "?cursor=invalid")).status).toBe(400);
  });

  it("counts only incoming unread messages and never marks unseen new messages or older markers as read", async () => {
    const { a, b, sitter } = await fixture(); const conversation = await open(a.auth, sitter.id);
    await post(a.auth, conversation.id, "Pierwsza"); await post(a.auth, conversation.id, "Druga");
    expect((await get(a.auth, "/unread-count")).body.count).toBe(0);
    expect((await get(b.auth, "/unread-count")).body.count).toBe(2);
    expect((await read(b.auth, conversation.id, 1)).body.unreadCount).toBe(1);
    await post(b.auth, conversation.id, "Odpowiedź nie oznacza przeczytania drugiej wiadomości.");
    expect((await get(b.auth, `/${conversation.id}`)).body.conversation.unreadCount).toBe(1);
    await post(a.auth, conversation.id, "Nowa w trakcie odczytu");
    expect((await read(b.auth, conversation.id, 1)).body.unreadCount).toBe(2);
    expect((await read(b.auth, conversation.id, 0)).body.readSequence).toBe(1);
    expect((await read(b.auth, conversation.id, 100)).status).toBe(400);
    expect(await prisma.notification.count({ where: { accountId: b.id, conversationId: conversation.id, readAt: null } })).toBe(2);
    expect((await read(b.auth, conversation.id, 4)).body.unreadCount).toBe(0);
    expect(await prisma.notification.count({ where: { accountId: b.id, conversationId: conversation.id, readAt: null } })).toBe(0);
  });

  it("requires verified active participants to initiate/send, while preserving authorized history", async () => {
    const { a, b, stranger, sitter } = await fixture();
    await prisma.account.update({ where: { id: a.id }, data: { emailVerifiedAt: null } });
    expect((await request(app).post("/api/conversations").set("Authorization", a.auth).send({ sitterProfileId: sitter.id })).status).toBe(403);
    await prisma.account.update({ where: { id: a.id }, data: { emailVerifiedAt: new Date() } });
    const conversation = await open(a.auth, sitter.id); await post(a.auth, conversation.id, "Historia");
    for (const state of [{ blockedAt: new Date() }, { deactivatedAt: new Date() }, { emailVerifiedAt: null }]) {
      await prisma.account.update({ where: { id: b.id }, data: { blockedAt: null, deactivatedAt: null, emailVerifiedAt: new Date(), ...state } });
      expect((await post(a.auth, conversation.id, "Niedozwolona")).status).toBe(403);
      expect((await get(a.auth, `/${conversation.id}`)).body.conversation.canSend).toBe(false);
      expect((await get(a.auth, `/${conversation.id}/messages`)).body.items).toHaveLength(1);
      expect((await get(stranger.auth, `/${conversation.id}/messages`)).status).toBe(404);
    }
  });

  it("routes private push to the conversation and skips notifications already read before delivery", async () => {
    env.PUSH_ENABLED = true;
    const { a, b, sitter } = await fixture(); const conversation = await open(a.auth, sitter.id);
    await prisma.refreshToken.create({ data: { id: randomUUID(), accountId: b.id, familyId: "chat-session", tokenHash: "test", expiresAt: new Date(Date.now() + 60_000) } });
    await prisma.pushDevice.create({ data: { accountId: b.id, token: "ExpoPushToken[chat-test]", sessionId: "chat-session" } });
    await post(a.auth, conversation.id, "Prywatna treść wiadomości");
    await enqueueNotifications();
    const provider = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { status: "ok", id: "chat-ticket" } })));
    vi.stubGlobal("fetch", provider);
    await deliverNotifications();
    const payload = JSON.parse(provider.mock.calls[0][1].body);
    expect(payload.data).toMatchObject({ conversationId: conversation.id, accountId: b.id });
    expect(payload.body).not.toContain("Prywatna");
    await post(a.auth, conversation.id, "Przeczytana przed kolejką");
    await read(b.auth, conversation.id, 2); await enqueueNotifications();
    expect(await prisma.notificationDelivery.count({ where: { notification: { conversationId: conversation.id } } })).toBe(1);
    await post(a.auth, conversation.id, "Przeczytana po dodaniu do kolejki");
    await enqueueNotifications(); await read(b.auth, conversation.id, 3); await deliverNotifications();
    expect(provider).toHaveBeenCalledTimes(1);
  });
});
