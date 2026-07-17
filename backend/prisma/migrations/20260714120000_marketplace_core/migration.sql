-- CreateEnum
CREATE TYPE "public"."SitterServiceType" AS ENUM ('DOG_WALK', 'DROP_IN', 'DAY_CARE');
CREATE TYPE "public"."BookingStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "public"."NotificationType" AS ENUM ('BOOKING_REQUESTED', 'BOOKING_ACCEPTED', 'BOOKING_REJECTED', 'BOOKING_CANCELLED', 'BOOKING_COMPLETED');
CREATE TYPE "public"."AccountTokenType" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

-- AlterTable
ALTER TABLE "public"."Account" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "public"."Pet" ADD COLUMN "photoKey" TEXT;
ALTER TABLE "public"."RefreshToken" ADD COLUMN "familyId" TEXT;
UPDATE "public"."RefreshToken" SET "familyId" = "id" WHERE "familyId" IS NULL;
ALTER TABLE "public"."RefreshToken" ALTER COLUMN "familyId" SET NOT NULL;

-- CreateTable
CREATE TABLE "public"."AccountActionToken" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "public"."AccountTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountActionToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."SitterProfile" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "serviceRadiusKm" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SitterProfile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SitterProfile_radius_check" CHECK ("serviceRadiusKm" BETWEEN 1 AND 100),
    CONSTRAINT "SitterProfile_latitude_check" CHECK ("latitude" BETWEEN -90 AND 90),
    CONSTRAINT "SitterProfile_longitude_check" CHECK ("longitude" BETWEEN -180 AND 180)
);

CREATE TABLE "public"."SitterService" (
    "id" TEXT NOT NULL,
    "sitterProfileId" TEXT NOT NULL,
    "type" "public"."SitterServiceType" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SitterService_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SitterService_duration_check" CHECK ("durationMinutes" BETWEEN 15 AND 1440),
    CONSTRAINT "SitterService_price_check" CHECK ("priceCents" BETWEEN 0 AND 10000000),
    CONSTRAINT "SitterService_currency_check" CHECK ("currency" = 'PLN')
);

CREATE TABLE "public"."AvailabilitySlot" (
    "id" TEXT NOT NULL,
    "sitterProfileId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AvailabilitySlot_range_check" CHECK ("endsAt" > "startsAt")
);

CREATE TABLE "public"."Booking" (
    "id" TEXT NOT NULL,
    "ownerAccountId" TEXT NOT NULL,
    "sitterAccountId" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "sitterServiceId" TEXT NOT NULL,
    "availabilitySlotId" TEXT NOT NULL,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "activeSlotKey" TEXT,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Booking_accounts_check" CHECK ("ownerAccountId" <> "sitterAccountId"),
    CONSTRAINT "Booking_price_check" CHECK ("priceCents" >= 0),
    CONSTRAINT "Booking_currency_check" CHECK ("currency" = 'PLN')
);

CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "bookingId" TEXT,
    "type" "public"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "public"."RefreshToken"("familyId");
CREATE UNIQUE INDEX "AccountActionToken_tokenHash_key" ON "public"."AccountActionToken"("tokenHash");
CREATE INDEX "AccountActionToken_accountId_type_idx" ON "public"."AccountActionToken"("accountId", "type");
CREATE INDEX "AccountActionToken_expiresAt_idx" ON "public"."AccountActionToken"("expiresAt");
CREATE UNIQUE INDEX "SitterProfile_accountId_key" ON "public"."SitterProfile"("accountId");
CREATE INDEX "SitterProfile_isActive_city_idx" ON "public"."SitterProfile"("isActive", "city");
CREATE UNIQUE INDEX "SitterService_sitterProfileId_type_durationMinutes_key" ON "public"."SitterService"("sitterProfileId", "type", "durationMinutes");
CREATE INDEX "SitterService_type_isActive_idx" ON "public"."SitterService"("type", "isActive");
CREATE UNIQUE INDEX "AvailabilitySlot_sitterProfileId_startsAt_endsAt_key" ON "public"."AvailabilitySlot"("sitterProfileId", "startsAt", "endsAt");
CREATE INDEX "AvailabilitySlot_sitterProfileId_startsAt_idx" ON "public"."AvailabilitySlot"("sitterProfileId", "startsAt");
CREATE UNIQUE INDEX "Booking_activeSlotKey_key" ON "public"."Booking"("activeSlotKey");
CREATE INDEX "Booking_ownerAccountId_createdAt_idx" ON "public"."Booking"("ownerAccountId", "createdAt");
CREATE INDEX "Booking_sitterAccountId_createdAt_idx" ON "public"."Booking"("sitterAccountId", "createdAt");
CREATE INDEX "Booking_availabilitySlotId_idx" ON "public"."Booking"("availabilitySlotId");
CREATE INDEX "Notification_accountId_createdAt_idx" ON "public"."Notification"("accountId", "createdAt");
CREATE INDEX "Notification_accountId_readAt_idx" ON "public"."Notification"("accountId", "readAt");

-- AddForeignKey
ALTER TABLE "public"."AccountActionToken" ADD CONSTRAINT "AccountActionToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."SitterProfile" ADD CONSTRAINT "SitterProfile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."SitterService" ADD CONSTRAINT "SitterService_sitterProfileId_fkey" FOREIGN KEY ("sitterProfileId") REFERENCES "public"."SitterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_sitterProfileId_fkey" FOREIGN KEY ("sitterProfileId") REFERENCES "public"."SitterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_ownerAccountId_fkey" FOREIGN KEY ("ownerAccountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_sitterAccountId_fkey" FOREIGN KEY ("sitterAccountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_petId_fkey" FOREIGN KEY ("petId") REFERENCES "public"."Pet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_sitterServiceId_fkey" FOREIGN KEY ("sitterServiceId") REFERENCES "public"."SitterService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_availabilitySlotId_fkey" FOREIGN KEY ("availabilitySlotId") REFERENCES "public"."AvailabilitySlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
