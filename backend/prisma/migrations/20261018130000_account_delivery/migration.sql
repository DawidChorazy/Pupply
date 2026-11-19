ALTER TYPE "AccountRole" ADD VALUE 'ADMIN';
ALTER TYPE "AccountTokenType" ADD VALUE 'EMAIL_CHANGE';
ALTER TABLE "Account" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "blockedAt" TIMESTAMP(3),
 ADD COLUMN "emailNotifications" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AccountActionToken" ADD COLUMN "pendingEmail" TEXT;
ALTER TABLE "Notification" ADD COLUMN "deliveryEnqueuedAt" TIMESTAMP(3);
-- Do not send historical notifications on first deployment.
UPDATE "Notification" SET "deliveryEnqueuedAt" = CURRENT_TIMESTAMP;
CREATE TABLE "PushDevice" (
 id TEXT PRIMARY KEY, "accountId" TEXT NOT NULL REFERENCES "Account"(id) ON DELETE CASCADE,
 token TEXT NOT NULL UNIQUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PushDevice_accountId_idx" ON "PushDevice"("accountId");
CREATE TABLE "NotificationDelivery" (
 id TEXT PRIMARY KEY, "notificationId" TEXT NOT NULL REFERENCES "Notification"(id) ON DELETE CASCADE,
 channel TEXT NOT NULL CHECK (channel IN ('email', 'push')), destination TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lockedUntil" TIMESTAMP(3), "sentAt" TIMESTAMP(3), "failedAt" TIMESTAMP(3), "ticketId" TEXT,
 "receiptCheckedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_channel_destination_key" ON "NotificationDelivery"("notificationId", channel, destination);
CREATE INDEX "NotificationDelivery_sentAt_failedAt_nextAttemptAt_idx" ON "NotificationDelivery"("sentAt", "failedAt", "nextAttemptAt");
CREATE TABLE "AuditLog" (
 id TEXT PRIMARY KEY, "actorAccountId" TEXT NOT NULL, "targetAccountId" TEXT NOT NULL,
 action TEXT NOT NULL, reason TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditLog_targetAccountId_createdAt_idx" ON "AuditLog"("targetAccountId", "createdAt");
