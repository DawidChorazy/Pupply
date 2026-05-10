-- AlterTable
ALTER TABLE "public"."Account" ADD COLUMN "googleId" TEXT;
ALTER TABLE "public"."Account" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Account_googleId_key" ON "public"."Account"("googleId");
