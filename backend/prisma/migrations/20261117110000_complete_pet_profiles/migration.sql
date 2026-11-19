CREATE TYPE "PetSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');
CREATE TYPE "PetDocumentPurpose" AS ENUM ('GENERAL', 'VACCINATION');
ALTER TABLE "Pet" ADD COLUMN "size" "PetSize", ADD COLUMN "temperament" TEXT,
  ADD COLUMN "mobilityRestrictions" TEXT, ADD COLUMN "careInstructions" TEXT,
  ADD COLUMN "photoKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PetDocument" ADD COLUMN "stagingKey" TEXT,
  ADD COLUMN "contentType" TEXT NOT NULL DEFAULT 'application/pdf',
  ADD COLUMN "purpose" "PetDocumentPurpose" NOT NULL DEFAULT 'GENERAL';
CREATE UNIQUE INDEX "PetDocument_stagingKey_key" ON "PetDocument"("stagingKey");
