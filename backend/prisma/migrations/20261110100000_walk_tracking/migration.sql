ALTER TYPE "NotificationType" ADD VALUE 'WALK_STARTED';

CREATE TABLE "WalkSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bookingId" TEXT NOT NULL UNIQUE REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "sitterAccountId" TEXT NOT NULL REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "endReason" TEXT CHECK ("endReason" IN ('COMPLETED', 'CANCELLED')),
  "distanceMeters" DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK ("distanceMeters" >= 0),
  "lastSequence" INTEGER NOT NULL DEFAULT 0 CHECK ("lastSequence" BETWEEN 0 AND 20000),
  "distanceAnchorSequence" INTEGER NOT NULL DEFAULT 0 CHECK ("distanceAnchorSequence" BETWEEN 0 AND "lastSequence"),
  CHECK (("endedAt" IS NULL) = ("endReason" IS NULL)),
  CHECK ("endedAt" >= "startedAt")
);
-- A sitter can only record one walk at a time, including simultaneous requests.
CREATE UNIQUE INDEX "WalkSession_one_active_sitter" ON "WalkSession"("sitterAccountId") WHERE "endedAt" IS NULL;
CREATE TABLE "WalkPoint" (
  "sessionId" TEXT NOT NULL REFERENCES "WalkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "sequence" INTEGER NOT NULL,
  "clientPointId" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL CHECK ("latitude" BETWEEN -90 AND 90),
  "longitude" DOUBLE PRECISION NOT NULL CHECK ("longitude" BETWEEN -180 AND 180),
  "accuracy" DOUBLE PRECISION NOT NULL CHECK ("accuracy" BETWEEN 0 AND 100),
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "segmentStart" BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY ("sessionId", "sequence"),
  UNIQUE ("sessionId", "clientPointId")
);
