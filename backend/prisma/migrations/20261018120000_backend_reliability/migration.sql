ALTER TYPE "BookingStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_EXPIRED';
ALTER TYPE "NotificationType" ADD VALUE 'DOCUMENT_EXPIRING';

CREATE EXTENSION IF NOT EXISTS btree_gist;
-- Intentionally fail on existing overlaps: resolve conflicting schedules before deployment.
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_no_overlap"
  EXCLUDE USING gist ("sitterProfileId" WITH =, tsrange("startsAt", "endsAt", '[)') WITH &&);

ALTER TABLE "Booking" ADD COLUMN "startsAt" TIMESTAMP(3), ADD COLUMN "endsAt" TIMESTAMP(3), ADD COLUMN "expiresAt" TIMESTAMP(3);
UPDATE "Booking" b SET "startsAt" = s."startsAt",
  "endsAt" = LEAST(s."endsAt", s."startsAt" + v."durationMinutes" * INTERVAL '1 minute'),
  "expiresAt" = LEAST(s."startsAt", b."createdAt" + INTERVAL '24 hours')
FROM "AvailabilitySlot" s, "SitterService" v WHERE s.id = b."availabilitySlotId" AND v.id = b."sitterServiceId";
ALTER TABLE "Booking" ALTER COLUMN "startsAt" SET NOT NULL, ALTER COLUMN "endsAt" SET NOT NULL, ALTER COLUMN "expiresAt" SET NOT NULL;
DROP INDEX "Booking_activeSlotKey_key";
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_range_check" CHECK ("endsAt" > "startsAt");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_sitter_no_overlap"
  EXCLUDE USING gist ("sitterAccountId" WITH =, tsrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE (status IN ('REQUESTED', 'ACCEPTED'));
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_pet_no_overlap"
  EXCLUDE USING gist ("petId" WITH =, tsrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE (status IN ('REQUESTED', 'ACCEPTED'));
CREATE INDEX "Booking_status_expiresAt_idx" ON "Booking"(status, "expiresAt");

CREATE TABLE "PetDocument" (
  id TEXT PRIMARY KEY, "petId" TEXT NOT NULL REFERENCES "Pet"(id) ON DELETE CASCADE,
  "objectKey" TEXT NOT NULL UNIQUE, name TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL CHECK ("sizeBytes" > 0),
  "expiresAt" TIMESTAMP(3), "reminderDaysBefore" INTEGER NOT NULL DEFAULT 7 CHECK ("reminderDaysBefore" BETWEEN 0 AND 365),
  "reminderSentAt" TIMESTAMP(3), "uploadedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PetDocument_expiresAt_reminderSentAt_idx" ON "PetDocument"("expiresAt", "reminderSentAt");
