import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { expireBookingRequests } from "./booking-expiry.service";
import { deleteDocumentObject, cleanupOrphanedObjects } from "./storage.service";
import { enqueueNotifications, deliverNotifications, checkPushReceipts } from "./delivery.service";
import { recordMaintenance } from "../middleware/metrics";

export async function sendDocumentReminders(now = new Date()) {
  const documents = await prisma.$queryRaw<{ id: string; petId: string; name: string; accountId: string; petName: string; expiresAt: Date; reminderDaysBefore: number }[]>`
    SELECT d.id, d."petId", d.name, d."expiresAt", d."reminderDaysBefore", p."accountId", p.name AS "petName"
    FROM "PetDocument" d JOIN "Pet" p ON p.id = d."petId"
    WHERE d."uploadedAt" IS NOT NULL AND d."reminderSentAt" IS NULL AND d."expiresAt" IS NOT NULL
      AND d."expiresAt" - d."reminderDaysBefore" * interval '1 day' <= ${now}
    ORDER BY d."expiresAt" LIMIT 100
  `;
  for (const document of documents) await prisma.$transaction(async tx => {
    const claimed = await tx.petDocument.updateMany({ where: { id: document.id, reminderSentAt: null, expiresAt: document.expiresAt, reminderDaysBefore: document.reminderDaysBefore }, data: { reminderSentAt: now } });
    if (!claimed.count) return;
    await tx.notification.create({ data: {
      accountId: document.accountId, type: "DOCUMENT_EXPIRING", title: "Termin ważności dokumentu pupila",
      message: `${document.petName}: sprawdź ważność dokumentu „${document.name}”.`
    } });
  });
}

export async function runMaintenance(now = new Date()) {
  await expireBookingRequests(now);
  await sendDocumentReminders(now);
  await enqueueNotifications(now);
  await deliverNotifications(now);
  await checkPushReceipts(now);
  const cutoff = new Date(now.getTime() - 30 * 86_400_000);
  await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  await prisma.accountActionToken.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  await prisma.notificationDelivery.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 90 * 86_400_000) }, OR: [{ sentAt: { not: null } }, { failedAt: { not: null } }] } });
  const pending = await prisma.petDocument.findMany({ where: { uploadedAt: null, createdAt: { lt: new Date(now.getTime() - 86_400_000) } }, take: 100 });
  for (const document of pending) {
    await prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ objectKey: string; uploadedAt: Date | null }[]>`SELECT "objectKey", "uploadedAt" FROM "PetDocument" WHERE id = ${document.id} FOR UPDATE`;
      if (!rows[0] || rows[0].uploadedAt) return;
      await deleteDocumentObject(rows[0].objectKey);
      await tx.petDocument.delete({ where: { id: document.id } });
    }, { timeout: 15_000 });
  }
}

export function startMaintenance() {
  let running: Promise<void> | undefined;
  let stopped = false;
  let lastStorageCleanup = 0;
  const tick = () => {
    if (running || stopped) return;
    running = (async () => {
      await runMaintenance();
      if (Date.now() - lastStorageCleanup > 3_600_000) {
        await cleanupOrphanedObjects();
        lastStorageCleanup = Date.now();
      }
      recordMaintenance(true);
    })().catch(error => { recordMaintenance(false); console.error(JSON.stringify({ event: "maintenance_failed", error: String(error) })); }).finally(() => { running = undefined; });
  };
  tick();
  const timer = setInterval(tick, env.MAINTENANCE_INTERVAL_SECONDS * 1000);
  timer.unref();
  return async () => { stopped = true; clearInterval(timer); await running; };
}
