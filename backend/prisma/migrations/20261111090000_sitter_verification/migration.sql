CREATE TYPE "SitterVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "SitterVerificationFilePurpose" AS ENUM ('IDENTITY_DOCUMENT', 'FACE_PHOTO');
ALTER TABLE "SitterProfile"
 ADD COLUMN "verificationStatus" "SitterVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
 ADD COLUMN "verificationVersion" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "verificationSubmittedAt" TIMESTAMP(3),
 ADD COLUMN "verificationReviewedAt" TIMESTAMP(3),
 ADD COLUMN "verificationReviewedBy" TEXT,
 ADD COLUMN "verificationReason" TEXT,
 ADD COLUMN "verificationFullName" TEXT;
CREATE INDEX "SitterProfile_verificationStatus_verificationSubmittedAt_idx" ON "SitterProfile"("verificationStatus", "verificationSubmittedAt");
CREATE TABLE "SitterVerificationFile" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "profileId" TEXT NOT NULL REFERENCES "SitterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "purpose" "SitterVerificationFilePurpose" NOT NULL,
 "stagingKey" TEXT NOT NULL UNIQUE,
 "objectKey" TEXT NOT NULL UNIQUE,
 "contentType" TEXT NOT NULL,
 "sizeBytes" INTEGER NOT NULL,
 "uploadedAt" TIMESTAMP(3),
 "verificationVersion" INTEGER,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "SitterVerificationFile_profileId_verificationVersion_purpose_key" ON "SitterVerificationFile"("profileId", "verificationVersion", "purpose");
CREATE INDEX "SitterVerificationFile_expiresAt_idx" ON "SitterVerificationFile"("expiresAt");
