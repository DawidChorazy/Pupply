-- CreateEnum
CREATE TYPE "public"."PetGender" AS ENUM ('MALE', 'FEMALE');

-- CreateTable
CREATE TABLE "public"."Pet" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER,
    "breed" TEXT,
    "weight" DOUBLE PRECISION,
    "gender" "public"."PetGender" NOT NULL,
    "photoUrl" TEXT,
    "illnesses" TEXT,
    "allergies" TEXT,
    "vaccines" TEXT,
    "vet" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pet_accountId_idx" ON "public"."Pet"("accountId");

-- AddForeignKey
ALTER TABLE "public"."Pet" ADD CONSTRAINT "Pet_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
