CREATE TABLE "SitterReview" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bookingId" TEXT NOT NULL REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "authorAccountId" TEXT NOT NULL REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "sitterAccountId" TEXT NOT NULL REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "punctuality" INTEGER NOT NULL CHECK ("punctuality" BETWEEN 1 AND 5),
  "communication" INTEGER NOT NULL CHECK ("communication" BETWEEN 1 AND 5),
  "quality" INTEGER NOT NULL CHECK ("quality" BETWEEN 1 AND 5),
  "comment" TEXT CHECK (length("comment") <= 2000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SitterReview_no_self_review" CHECK ("authorAccountId" <> "sitterAccountId")
);
CREATE UNIQUE INDEX "SitterReview_bookingId_key" ON "SitterReview"("bookingId");
CREATE INDEX "SitterReview_sitterAccountId_createdAt_id_idx" ON "SitterReview"("sitterAccountId", "createdAt", "id");
CREATE INDEX "SitterReview_authorAccountId_idx" ON "SitterReview"("authorAccountId");
