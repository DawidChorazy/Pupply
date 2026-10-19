ALTER TABLE "AvailabilitySlot" ADD COLUMN "archivedAt" TIMESTAMP(3);
DROP INDEX "AvailabilitySlot_sitterProfileId_startsAt_endsAt_key";
ALTER TABLE "AvailabilitySlot" DROP CONSTRAINT "AvailabilitySlot_no_overlap";
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_no_overlap"
  EXCLUDE USING gist ("sitterProfileId" WITH =, tsrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE ("archivedAt" IS NULL);

CREATE TABLE "BookingOperation" (
  "accountId" TEXT NOT NULL REFERENCES "Account"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  key TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  result JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("accountId", key)
);
