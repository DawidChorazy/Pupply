ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_REFUNDED';
CREATE TYPE "PaymentStatus" AS ENUM ('CREATING', 'PENDING', 'AUTHORIZED', 'COMPLETED', 'CANCELED', 'FAILED');
ALTER TABLE "Booking" ADD COLUMN "paymentRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "paymentDueAt" TIMESTAMP(3), ADD COLUMN "paidPaymentId" TEXT,
  ADD COLUMN "cancellationFeeCents" INTEGER NOT NULL DEFAULT 0 CHECK ("cancellationFeeCents" >= 0 AND "cancellationFeeCents" <= "priceCents"),
  ADD COLUMN "cancelledAt" TIMESTAMP(3);
CREATE TABLE "Payment" (
  "id" TEXT PRIMARY KEY, "bookingId" TEXT NOT NULL REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "environment" TEXT NOT NULL CHECK ("environment" IN ('sandbox', 'production')),
  "status" "PaymentStatus" NOT NULL DEFAULT 'CREATING', "activeKey" TEXT UNIQUE,
  "amountCents" INTEGER NOT NULL CHECK ("amountCents" > 0), "currency" TEXT NOT NULL DEFAULT 'PLN' CHECK ("currency" = 'PLN'),
  "payuOrderId" TEXT UNIQUE, "checkoutUrl" TEXT, "customerIp" TEXT NOT NULL, "buyerEmail" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3), "nextSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseUntil" TIMESTAMP(3), "leaseToken" TEXT, "attempts" INTEGER NOT NULL DEFAULT 0, "lastErrorCode" TEXT
);
CREATE INDEX "Payment_nextSyncAt_idx" ON "Payment"("nextSyncAt");
CREATE INDEX "Payment_bookingId_createdAt_idx" ON "Payment"("bookingId", "createdAt");
CREATE UNIQUE INDEX "Booking_paidPaymentId_key" ON "Booking"("paidPaymentId");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_paidPaymentId_fkey" FOREIGN KEY ("paidPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "PaymentRefund" (
  "id" TEXT PRIMARY KEY, "paymentId" TEXT NOT NULL UNIQUE REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "amountCents" INTEGER NOT NULL CHECK ("amountCents" > 0),
  "status" TEXT NOT NULL DEFAULT 'REQUESTED' CHECK ("status" IN ('REQUESTED', 'PENDING', 'FINALIZED', 'CANCELED')),
  "payuRefundId" TEXT UNIQUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "lastErrorCode" TEXT
);
CREATE TABLE "PaymentSettlement" (
  "bookingId" TEXT PRIMARY KEY REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "amountCents" INTEGER NOT NULL CHECK ("amountCents" > 0),
  "kind" TEXT NOT NULL CHECK ("kind" IN ('SERVICE', 'CANCELLATION_FEE')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
