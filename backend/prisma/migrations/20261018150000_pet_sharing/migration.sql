CREATE TABLE "PetShareLink" (
  id TEXT NOT NULL PRIMARY KEY,
  "petId" TEXT NOT NULL REFERENCES "Pet"(id) ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL,
  label TEXT,
  "includeDocuments" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PetShareLink_tokenHash_key" ON "PetShareLink"("tokenHash");
CREATE INDEX "PetShareLink_petId_createdAt_idx" ON "PetShareLink"("petId", "createdAt");
CREATE INDEX "PetShareLink_expiresAt_idx" ON "PetShareLink"("expiresAt");
