import { z } from "zod";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { sendMail } from "./mail.service";

const pushHeaders = () => ({ "Content-Type": "application/json", ...(env.EXPO_PUSH_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_PUSH_ACCESS_TOKEN}` } : {}) });
const ticketSchema = z.object({ status: z.enum(["ok", "error"]), id: z.string().optional(), details: z.object({ error: z.string().optional() }).optional() });

export async function enqueueNotifications(now = new Date()) {
  const notifications = await prisma.notification.findMany({ where: { deliveryEnqueuedAt: null }, orderBy: { createdAt: "asc" }, take: 100,
    include: { account: { include: { pushDevices: true } } } });
  for (const notification of notifications) await prisma.$transaction(async tx => {
    const claimed = await tx.notification.updateMany({ where: { id: notification.id, deliveryEnqueuedAt: null }, data: { deliveryEnqueuedAt: now } });
    if (!claimed.count || notification.account.blockedAt || notification.account.deactivatedAt) return;
    const deliveries = [
      ...(notification.account.emailNotifications && notification.account.emailVerifiedAt ? [{ channel: "email", destination: notification.account.email }] : []),
      ...(env.PUSH_ENABLED ? notification.account.pushDevices.map(device => ({ channel: "push", destination: device.token })) : [])
    ];
    if (deliveries.length) await tx.notificationDelivery.createMany({ data: deliveries.map(delivery => ({ ...delivery, notificationId: notification.id })), skipDuplicates: true });
  });
}

export async function deliverNotifications(now = new Date()) {
  const jobs = await prisma.notificationDelivery.findMany({ where: { sentAt: null, failedAt: null, nextAttemptAt: { lte: now }, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] },
    orderBy: { nextAttemptAt: "asc" }, take: 50, include: { notification: { include: { account: true } } } });
  const deliver = async (job: (typeof jobs)[number]) => {
    const claimAt = new Date(Math.max(now.getTime(), Date.now()));
    const leaseUntil = new Date(claimAt.getTime() + 60_000);
    const claimed = await prisma.notificationDelivery.updateMany({ where: { id: job.id, attempts: job.attempts, nextAttemptAt: { lte: claimAt }, sentAt: null, failedAt: null, OR: [{ lockedUntil: null }, { lockedUntil: { lte: claimAt } }] }, data: { lockedUntil: leaseUntil, attempts: { increment: 1 } } });
    if (!claimed.count) return;
    try {
      const account = job.notification.account;
      if (account.blockedAt || account.deactivatedAt || (job.channel === "email" && (!account.emailNotifications || !account.emailVerifiedAt || account.email !== job.destination))) {
        await prisma.notificationDelivery.update({ where: { id: job.id }, data: { failedAt: claimAt, lockedUntil: null } }); return;
      }
      let ticketId: string | undefined;
      if (job.channel === "email") {
        if (!await sendMail(job.destination, job.notification.title, job.notification.message)) throw new Error("Mail not configured");
      } else {
        const device = await prisma.pushDevice.findFirst({ where: { token: job.destination, accountId: account.id } });
        const activeSession = device && await prisma.refreshToken.findFirst({ where: { accountId: account.id, familyId: device.sessionId, revokedAt: null, expiresAt: { gt: claimAt } } });
        if (!env.PUSH_ENABLED || !activeSession) {
          await prisma.notificationDelivery.update({ where: { id: job.id }, data: { failedAt: claimAt, lockedUntil: null } }); return;
        }
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST", headers: pushHeaders(), signal: AbortSignal.timeout(10_000),
          body: JSON.stringify({ to: job.destination, title: "Pupply", body: "Masz nowe powiadomienie w aplikacji.", data: { notificationId: job.notificationId }, sound: "default" })
        });
        if (!response.ok) throw new Error("Push provider unavailable");
        const { data: ticket } = z.object({ data: ticketSchema }).parse(await response.json());
        if (ticket.status !== "ok" || !ticket.id) {
          if (ticket.details?.error === "DeviceNotRegistered") {
            await prisma.pushDevice.deleteMany({ where: { token: job.destination, accountId: account.id } });
            await prisma.notificationDelivery.update({ where: { id: job.id }, data: { failedAt: claimAt, lockedUntil: null } }); return;
          }
          throw new Error("Push rejected");
        }
        ticketId = ticket.id;
      }
      await prisma.notificationDelivery.update({ where: { id: job.id }, data: { sentAt: claimAt, lockedUntil: null, ticketId } });
    } catch {
      await prisma.notificationDelivery.update({ where: { id: job.id }, data: {
        lockedUntil: null, nextAttemptAt: new Date(claimAt.getTime() + Math.min(3_600_000, 30_000 * 2 ** job.attempts)),
        ...(job.attempts >= 7 ? { failedAt: claimAt } : {})
      } });
    }
  };
  // Bound provider concurrency and avoid delaying expiry/reminders behind a large batch.
  for (let offset = 0; offset < jobs.length; offset += 6) {
    await Promise.all(jobs.slice(offset, offset + 6).map(deliver));
  }
}

export async function checkPushReceipts(now = new Date()) {
  if (!env.PUSH_ENABLED) return;
  const jobs = await prisma.notificationDelivery.findMany({ where: { channel: "push", ticketId: { not: null }, receiptCheckedAt: null, sentAt: { lte: new Date(now.getTime() - 15 * 60_000) } }, take: 100 });
  if (!jobs.length) return;
  const response = await fetch("https://exp.host/--/api/v2/push/getReceipts", { method: "POST", headers: pushHeaders(), signal: AbortSignal.timeout(10_000), body: JSON.stringify({ ids: jobs.map(job => job.ticketId) }) });
  if (!response.ok) throw new Error("Push receipts unavailable");
  const { data } = z.object({ data: z.record(z.string(), ticketSchema) }).parse(await response.json());
  for (const job of jobs) {
    const receipt = data[job.ticketId!];
    if (!receipt && now.getTime() - job.sentAt!.getTime() < 86_400_000) continue;
    if (receipt?.details?.error === "DeviceNotRegistered") await prisma.pushDevice.deleteMany({ where: { token: job.destination } });
    const retry = receipt?.status === "error" && receipt.details?.error !== "DeviceNotRegistered" && job.attempts < 8;
    await prisma.notificationDelivery.updateMany({ where: { id: job.id, receiptCheckedAt: null, ticketId: job.ticketId }, data: {
      receiptCheckedAt: retry ? null : now, ...(retry ? { sentAt: null, ticketId: null, nextAttemptAt: new Date(now.getTime() + 60_000) } : receipt?.status !== "ok" ? { failedAt: now } : {})
    } });
  }
}
