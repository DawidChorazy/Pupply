import { AccountRole, Prisma, SitterServiceType } from "@prisma/client";

import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { assertPhotoExists, getPetPhotoUrl } from "./storage.service";
import { requireVerifiedEmail } from "./account-access.service";
import { expireBookingRequests } from "./booking-expiry.service";

type ServiceInput = {
  type: SitterServiceType;
  durationMinutes: number;
  priceCents: number;
  isActive?: boolean;
};

type ProfileInput = {
  bio: string;
  city: string;
  region?: string | null;
  photoKey?: string | null;
  latitude: number;
  longitude: number;
  serviceRadiusKm: number;
  isActive: boolean;
  services: ServiceInput[];
};

function requireUser(role: AccountRole) {
  if (role !== "USER") throw new AppError(403, "Only user accounts can become sitters", "FORBIDDEN");
}

const ownInclude = {
  services: { orderBy: { createdAt: "asc" as const } },
  availability: { orderBy: { startsAt: "asc" as const } }
};

export async function createSitterProfile(accountId: string, role: AccountRole, input: ProfileInput) {
  requireUser(role);
  await requireVerifiedEmail(accountId);
  const existing = await prisma.sitterProfile.findUnique({ where: { accountId } });
  if (existing) throw new AppError(409, "Sitter profile already exists", "SITTER_PROFILE_EXISTS");
  if (input.photoKey) await assertPhotoExists(accountId, input.photoKey, "sitters");
  const profile = await prisma.sitterProfile.create({
    data: {
      accountId,
      bio: input.bio,
      city: input.city,
      region: input.region,
      photoKey: input.photoKey,
      latitude: input.latitude,
      longitude: input.longitude,
      serviceRadiusKm: input.serviceRadiusKm,
      isActive: input.isActive,
      services: {
        create: input.services.map((service) => ({ ...service, currency: "PLN" }))
      }
    },
    include: ownInclude
  });
  return { ...profile, photoUrl: await getPetPhotoUrl(profile.photoKey) };
}

export async function getOwnSitterProfile(accountId: string, role: AccountRole) {
  requireUser(role);
  const profile = await prisma.sitterProfile.findUnique({ where: { accountId }, include: ownInclude });
  if (!profile) throw new AppError(404, "Sitter profile was not found", "SITTER_NOT_FOUND");
  return { ...profile, photoUrl: await getPetPhotoUrl(profile.photoKey) };
}

export async function updateSitterProfile(
  accountId: string,
  role: AccountRole,
  input: Partial<ProfileInput>
) {
  requireUser(role);
  if (input.isActive) await requireVerifiedEmail(accountId);
  const profile = await prisma.sitterProfile.findUnique({ where: { accountId } });
  if (!profile) throw new AppError(404, "Sitter profile was not found", "SITTER_NOT_FOUND");

  if (input.photoKey) await assertPhotoExists(accountId, input.photoKey, "sitters");
  const { services, ...profileData } = input;
  await prisma.$transaction(async (tx) => {
    await tx.sitterProfile.update({ where: { id: profile.id }, data: profileData });
    if (services) {
      await tx.sitterService.updateMany({ where: { sitterProfileId: profile.id }, data: { isActive: false } });
      for (const service of services) {
        await tx.sitterService.upsert({
          where: {
            sitterProfileId_type_durationMinutes: {
              sitterProfileId: profile.id,
              type: service.type,
              durationMinutes: service.durationMinutes
            }
          },
          create: { ...service, sitterProfileId: profile.id, currency: "PLN" },
          update: { priceCents: service.priceCents, isActive: service.isActive ?? true }
        });
      }
    }
  });
  return getOwnSitterProfile(accountId, role);
}

export async function addAvailability(
  accountId: string,
  role: AccountRole,
  input: { startsAt: Date; endsAt: Date }
) {
  requireUser(role);
  const profile = await prisma.sitterProfile.findUnique({ where: { accountId } });
  if (!profile) throw new AppError(404, "Sitter profile was not found", "SITTER_NOT_FOUND");
  await requireVerifiedEmail(accountId);
  return prisma.$transaction(async (tx) => {
    // Serialize schedule writes for this sitter. The database exclusion constraint also
    // protects inserts performed outside this service.
    await tx.$queryRaw`SELECT id FROM "SitterProfile" WHERE id = ${profile.id} FOR UPDATE`;
    const overlap = await tx.availabilitySlot.findFirst({
      where: {
        sitterProfileId: profile.id,
        startsAt: { lt: input.endsAt },
        endsAt: { gt: input.startsAt }
      }
    });
    if (overlap) throw new AppError(409, "Availability overlaps an existing slot", "AVAILABILITY_OVERLAP");
    return tx.availabilitySlot.create({ data: { sitterProfileId: profile.id, ...input } });
  });
}

export async function deleteAvailability(accountId: string, role: AccountRole, slotId: string) {
  requireUser(role);
  const slot = await prisma.availabilitySlot.findFirst({
    where: { id: slotId, sitterProfile: { accountId } },
    include: { bookings: { take: 1 } }
  });
  if (!slot) throw new AppError(404, "Availability slot was not found", "AVAILABILITY_NOT_FOUND");
  if (slot.bookings.length) {
    throw new AppError(409, "Availability with booking history cannot be deleted", "SLOT_HAS_BOOKINGS");
  }
  await prisma.availabilitySlot.delete({ where: { id: slot.id } });
}

export async function searchSitters(input: {
  latitude: number; longitude: number; radiusKm: number; serviceType?: SitterServiceType;
  from?: Date; to?: Date; page: number; pageSize: number;
}) {
  await expireBookingRequests();
  const now = new Date();
  const serviceFilter = input.serviceType ? Prisma.sql`AND v.type = ${input.serviceType}::"SitterServiceType"` : Prisma.empty;
  // PostgreSQL subtracts active bookings from each availability interval. Filtering,
  // distance sorting and pagination happen before loading profile relations.
  const candidates = Prisma.sql`
    WITH free AS (
      SELECT a.id, a."sitterProfileId", lower(g.period) AS "startsAt", upper(g.period) AS "endsAt"
      FROM "AvailabilitySlot" a
      CROSS JOIN LATERAL unnest(tsmultirange(tsrange(a."startsAt", a."endsAt", '[)')) - COALESCE(
        (SELECT range_agg(tsrange(b."startsAt", b."endsAt", '[)')) FROM "Booking" b
         WHERE b."availabilitySlotId" = a.id AND b.status IN ('REQUESTED', 'ACCEPTED')),
        '{}'::tsmultirange)) AS g(period)
      WHERE upper(g.period) > ${now}
    ), nearby AS (
      SELECT p.id, p."serviceRadiusKm", 6371 * acos(LEAST(1.0, GREATEST(-1.0,
        sin(radians(${input.latitude}::double precision)) * sin(radians(p.latitude)) +
        cos(radians(${input.latitude}::double precision)) * cos(radians(p.latitude)) *
        cos(radians(p.longitude - ${input.longitude}::double precision))))) AS distance
      FROM "SitterProfile" p JOIN "Account" ac ON ac.id = p."accountId"
      WHERE p."isActive" = true AND ac."emailVerifiedAt" IS NOT NULL AND ac."blockedAt" IS NULL AND ac."deactivatedAt" IS NULL
      AND EXISTS (SELECT 1 FROM "SitterService" v JOIN free f ON f."sitterProfileId" = v."sitterProfileId"
        WHERE v."sitterProfileId" = p.id AND v."isActive" = true ${serviceFilter}
        AND f."startsAt" > ${now}
        AND f."endsAt" - f."startsAt" >= v."durationMinutes" * interval '1 minute'
        ${input.from && input.to ? Prisma.sql`AND f."startsAt" <= ${input.from} AND f."endsAt" >= ${input.to}` : Prisma.empty})
    ), matches AS (SELECT * FROM nearby WHERE distance <= ${input.radiusKm} AND distance <= "serviceRadiusKm")
  `;
  const [rows, counts] = await prisma.$transaction([
    prisma.$queryRaw<{id: string; distance: number}[]>`${candidates} SELECT id, distance FROM matches ORDER BY distance, id OFFSET ${(input.page - 1) * input.pageSize} LIMIT ${input.pageSize}`,
    prisma.$queryRaw<{total: bigint}[]>`${candidates} SELECT count(*) AS total FROM matches`
  ], { isolationLevel: "RepeatableRead" });
  const profiles = await prisma.sitterProfile.findMany({
    where: { id: { in: rows.map(row => row.id) } },
    include: {
      account: { select: { userProfile: { select: { fullName: true } } } },
      services: { where: { isActive: true, type: input.serviceType }, orderBy: { priceCents: "asc" } },
      availability: { where: { endsAt: { gt: now } }, orderBy: { startsAt: "asc" },
        include: { bookings: { where: { status: { in: ["REQUESTED", "ACCEPTED"] } }, orderBy: { startsAt: "asc" } } } }
    }
  });
  const items = await Promise.all(rows.map(async row => {
    const profile = profiles.find(p => p.id === row.id);
    if (!profile) return null;
    const availability = profile.availability.flatMap(slot => {
      let cursor = slot.startsAt;
      const gaps: { id: string; sitterProfileId: string; createdAt: Date; startsAt: Date; endsAt: Date }[] = [];
      const add = (start: Date, end: Date) => {
        if (start > now && profile.services.some(service => end.getTime() - start.getTime() >= service.durationMinutes * 60_000))
          gaps.push({ id: slot.id, sitterProfileId: slot.sitterProfileId, createdAt: slot.createdAt, startsAt: start, endsAt: end });
      };
      for (const booking of slot.bookings) {
        if (booking.startsAt > cursor) add(cursor, booking.startsAt);
        if (booking.endsAt > cursor) cursor = booking.endsAt;
      }
      if (cursor < slot.endsAt) add(cursor, slot.endsAt);
      return gaps;
    }).slice(0, 20);
    return {
      id: profile.id, displayName: profile.account.userProfile?.fullName ?? "Opiekun Pupply",
      bio: profile.bio, city: profile.city, region: profile.region,
      photoUrl: await getPetPhotoUrl(profile.photoKey), serviceRadiusKm: profile.serviceRadiusKm,
      services: profile.services, availability, distanceKm: Math.round(row.distance * 10) / 10
    };
  }));
  return { items: items.filter(item => item !== null), pagination: { page: input.page, pageSize: input.pageSize, total: Number(counts[0].total) } };
}
