ALTER TABLE "Booking" ADD COLUMN "pickupAddress" TEXT;
CREATE TYPE "BookingIssueStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');
CREATE TYPE "BookingIssueCategory" AS ENUM ('NO_SHOW', 'EARLY_FINISH', 'PET_SAFETY', 'OTHER');
CREATE TABLE "BookingIssue" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bookingId" TEXT NOT NULL,
  "reporterAccountId" TEXT NOT NULL,
  "category" "BookingIssueCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "status" "BookingIssueStatus" NOT NULL DEFAULT 'OPEN',
  "version" INTEGER NOT NULL DEFAULT 1,
  "resolution" TEXT,
  "reviewedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingIssue_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BookingIssue_bookingId_key" ON "BookingIssue"("bookingId");
CREATE INDEX "BookingIssue_status_createdAt_idx" ON "BookingIssue"("status", "createdAt");
CREATE INDEX "BookingIssue_reporterAccountId_createdAt_idx" ON "BookingIssue"("reporterAccountId", "createdAt");
ALTER TYPE "NotificationType" ADD VALUE 'ISSUE_UPDATED';
