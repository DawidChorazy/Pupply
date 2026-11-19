CREATE TYPE "ClinicVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

ALTER TABLE "ClinicProfile"
  ADD COLUMN "address" TEXT,
  ADD COLUMN "registrationNumber" TEXT,
  ADD COLUMN "verificationStatus" "ClinicVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN "verificationVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "verificationSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "verificationReviewedAt" TIMESTAMP(3),
  ADD COLUMN "verificationReviewedBy" TEXT,
  ADD COLUMN "verificationReason" TEXT,
  ADD COLUMN "verificationEvidenceUrl" TEXT;

CREATE INDEX "ClinicProfile_verificationStatus_verificationSubmittedAt_idx"
  ON "ClinicProfile"("verificationStatus", "verificationSubmittedAt");

ALTER TABLE "ClinicProfile" ADD CONSTRAINT "ClinicProfile_verified_evidence_check" CHECK (
  "verificationStatus" <> 'VERIFIED' OR (
    "address" IS NOT NULL AND "registrationNumber" IS NOT NULL
    AND "verificationSubmittedAt" IS NOT NULL AND "verificationReviewedAt" IS NOT NULL
    AND "verificationReviewedBy" IS NOT NULL AND "verificationReason" IS NOT NULL
    AND "verificationEvidenceUrl" IS NOT NULL
  )
);
