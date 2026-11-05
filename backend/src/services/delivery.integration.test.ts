import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { sendMail } from "./mail.service";
import { enqueueNotifications, deliverNotifications, checkPushReceipts } from "./delivery.service";
vi.mock("./mail.service", () => ({ sendMail: vi.fn() }));
const ids: string[] = [];
const pushEnabled = env.PUSH_ENABLED;
async function fixture() {
  const account = await prisma.account.create({ data: { email: `${randomUUID()}@delivery.test`, role: "USER", emailVerifiedAt: new Date(), emailNotifications: true } }); ids.push(account.id);
  const notification = await prisma.notification.create({ data: { accountId: account.id, type: "DOCUMENT_EXPIRING", title: "Document reminder", message: "Private document details" } });
  return { account, notification };
}
afterEach(async () => { env.PUSH_ENABLED = pushEnabled; vi.unstubAllGlobals(); vi.resetAllMocks(); await prisma.account.deleteMany({ where: { id: { in: ids.splice(0) } } }); });
afterAll(() => prisma.$disconnect());
describe("durable notification delivery", () => {
  it("enqueues once under concurrent workers and retries failed email delivery", async () => {
    const { notification } = await fixture();
    await Promise.all([enqueueNotifications(), enqueueNotifications()]);
    expect(await prisma.notificationDelivery.count({ where: { notificationId: notification.id } })).toBe(1);
    vi.mocked(sendMail).mockRejectedValueOnce(new Error("SMTP unavailable")).mockResolvedValue(true);
    await deliverNotifications();
    let job = await prisma.notificationDelivery.findFirstOrThrow({ where: { notificationId: notification.id } });
    expect(job.attempts).toBe(1); expect(job.sentAt).toBeNull();
    await deliverNotifications(new Date(job.nextAttemptAt.getTime() + 1000));
    job = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: job.id } });
    expect(job.attempts).toBe(2); expect(job.sentAt).not.toBeNull();
  });
  it("claims each delivery once across concurrent workers", async () => {
    const { notification } = await fixture(); await enqueueNotifications();
    vi.mocked(sendMail).mockImplementation(async () => { await new Promise(resolve => setTimeout(resolve, 20)); return true; });
    await Promise.all([deliverNotifications(), deliverNotifications()]);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect((await prisma.notificationDelivery.findFirstOrThrow({ where: { notificationId: notification.id } })).attempts).toBe(1);
  });
  it("stops retrying after eight attempts", async () => {
    const { notification } = await fixture(); await enqueueNotifications();
    await prisma.notificationDelivery.updateMany({ where: { notificationId: notification.id }, data: { attempts: 7 } });
    vi.mocked(sendMail).mockRejectedValue(new Error("SMTP unavailable"));
    await deliverNotifications();
    expect((await prisma.notificationDelivery.findFirstOrThrow({ where: { notificationId: notification.id } })).failedAt).not.toBeNull();
  });
  it("sends private push payloads, checks receipts and removes unregistered devices", async () => {
    env.PUSH_ENABLED = true;
    const { account, notification } = await fixture();
    await prisma.account.update({ where: { id: account.id }, data: { emailNotifications: false } });
    await prisma.refreshToken.create({ data: { id: randomUUID(), accountId: account.id, familyId: "session-test", tokenHash: "test", expiresAt: new Date(Date.now() + 86_400_000) } });
    await prisma.pushDevice.create({ data: { accountId: account.id, token: "ExpoPushToken[delivery-test]", sessionId: "session-test" } });
    await enqueueNotifications();
    const provider = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { status: "ok", id: "ticket-test" } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { "ticket-test": { status: "error", details: { error: "DeviceNotRegistered" } } } })));
    vi.stubGlobal("fetch", provider);
    const now = new Date(); await deliverNotifications(now);
    const payload = JSON.parse(provider.mock.calls[0][1].body);
    expect(payload.body).not.toContain("Private"); expect(payload.data.notificationId).toBe(notification.id);
    await checkPushReceipts(new Date(now.getTime() + 16 * 60_000));
    expect(await prisma.pushDevice.count({ where: { accountId: account.id } })).toBe(0);
    expect((await prisma.notificationDelivery.findFirstOrThrow({ where: { notificationId: notification.id } })).failedAt).not.toBeNull();
  });
  it("does not send queued messages after account deactivation or opting out", async () => {
    const { account, notification } = await fixture(); await enqueueNotifications();
    await prisma.account.update({ where: { id: account.id }, data: { emailNotifications: false } });
    await deliverNotifications();
    expect(sendMail).not.toHaveBeenCalled();
    expect((await prisma.notificationDelivery.findFirstOrThrow({ where: { notificationId: notification.id } })).failedAt).not.toBeNull();
  });
});
