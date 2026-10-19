import { AccountRole, Prisma, SitterServiceType } from "@prisma/client";

import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { assertPhotoExists, getPetPhotoUrl } from "./storage.service";
import { requireVerifiedEmail } from "./account-access.service";
import { activeBookingWhere } from "./booking-expiry.service";
import { calendarQuerySchema } from "../validation/sitter.schemas";

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

type CalendarInput = { from?: Date; to?: Date; limit?: number; cursor?: string };
function calendarWindow(input: CalendarInput = {}) {
  const parsed = calendarQuerySchema.parse(input);
  const from = parsed.from ?? new Date(new Date().setUTCHours(0, 0, 0, 0));
  return { ...parsed, from, to: parsed.to ?? new Date(from.getTime() + 62 * 86_400_000) };
}
const scheduleBookings = (from: Date, to: Date, now = new Date()) => ({
  where: { ...activeBookingWhere(now), startsAt: { lt: to }, endsAt: { gt: from } },
  orderBy: { startsAt: "asc" as const }, select: {
    id: true, startsAt: true, endsAt: true, status: true,
    pet: { select: { name: true } }, sitterService: { select: { type: true } }
  }
});
const ownInclude = () => {
  const { from, to } = calendarWindow();
  return {
    services: { where: { isActive: true }, orderBy: { createdAt: "asc" as const }, take: 20 },
    availability: {
      where: { archivedAt: null, startsAt: { lt: to }, endsAt: { gt: from } },
      orderBy: [{ startsAt: "asc" as const }, { id: "asc" as const }], take: 100,
      include: { bookings: scheduleBookings(from, to) }
    }
  };
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
    include: ownInclude()
  });
  return { ...profile, photoUrl: await getPetPhotoUrl(profile.photoKey) };
}

export async function getOwnSitterProfile(accountId: string, role: AccountRole) {
  requireUser(role);
  const profile = await prisma.sitterProfile.findUnique({ where: { accountId }, include: ownInclude() });
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
  return (await addAvailabilityBatch(accountId, role, [input]))[0];
}

export async function addAvailabilityBatch(
  accountId: string, role: AccountRole, inputs: { startsAt: Date; endsAt: Date }[]
) {
  requireUser(role);
  const profile = await prisma.sitterProfile.findUnique({ where: { accountId } });
  if (!profile) throw new AppError(404, "Sitter profile was not found", "SITTER_NOT_FOUND");
  await requireVerifiedEmail(accountId);
  return prisma.$transaction(async (tx) => {
    // Serialize schedule writes for this sitter. The database exclusion constraint also
    // protects inserts performed outside this service.
    await tx.$queryRaw`SELECT id FROM "SitterProfile" WHERE id = ${profile.id} FOR UPDATE`;
    const slots = [];
    for (const input of inputs) {
      const overlap = await tx.availabilitySlot.findFirst({ where: {
        sitterProfileId: profile.id, archivedAt: null, startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt }
      } });
      if (overlap) {
        const day = input.startsAt.toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" });
        throw new AppError(409, `Termin ${day} nakłada się na zapisany grafik. Nie dodano żadnych terminów.`, "AVAILABILITY_OVERLAP");
      }
      slots.push(await tx.availabilitySlot.create({ data: { sitterProfileId: profile.id, ...input } }));
    }
    return slots.map(slot => ({ ...slot, bookings: [] }));
  });
}

export async function updateAvailability(accountId: string, role: AccountRole, slotId: string, input: { startsAt: Date; endsAt: Date }) {
  requireUser(role);
  await requireVerifiedEmail(accountId);
  return prisma.$transaction(async tx => {
    const profiles = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "SitterProfile" WHERE "accountId" = ${accountId} FOR UPDATE`;
    const slot = await tx.availabilitySlot.findFirst({ where: { id: slotId, sitterProfileId: profiles[0]?.id ?? "", archivedAt: null } });
    if (!slot) throw new AppError(404, "Nie znaleziono terminu.", "AVAILABILITY_NOT_FOUND");
    // Sharing the row lock with booking creation makes shrinking hours safe even
    // when another client submits a reservation at the same time.
    await tx.$queryRaw`SELECT id FROM "AvailabilitySlot" WHERE id = ${slot.id} FOR UPDATE`;
    const now = new Date();
    const bookings = await tx.booking.findMany({ where: { availabilitySlotId: slot.id, ...activeBookingWhere(now), endsAt: { gt: now } } });
    if (bookings.some(booking => booking.startsAt < input.startsAt || booking.endsAt > input.endsAt)) {
      throw new AppError(409, "Nowe godziny muszą obejmować aktywne rezerwacje. Najpierw anuluj lub przełóż wizyty, które kolidują ze zmianą.", "SLOT_HAS_BOOKINGS");
    }
    const overlap = await tx.availabilitySlot.findFirst({ where: {
      sitterProfileId: slot.sitterProfileId, archivedAt: null, id: { not: slot.id }, startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt }
    } });
    if (overlap) throw new AppError(409, "Nowe godziny nakładają się na inny przedział dostępności.", "AVAILABILITY_OVERLAP");
    return tx.availabilitySlot.update({ where: { id: slot.id }, data: input, include: { bookings: scheduleBookings(input.startsAt, input.endsAt, now) } });
  });
}

export async function deleteAvailability(accountId: string, role: AccountRole, slotId: string) {
  requireUser(role);
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT a.id FROM "AvailabilitySlot" a JOIN "SitterProfile" p ON p.id = a."sitterProfileId"
      WHERE a.id = ${slotId} AND p."accountId" = ${accountId} FOR UPDATE OF a`;
    const now = new Date();
    const slot = await tx.availabilitySlot.findFirst({
      where: { id: slotId, sitterProfile: { accountId } },
      include: { bookings: { where: { ...activeBookingWhere(now), endsAt: { gt: now } }, take: 1 } }
    });
    if (!slot) throw new AppError(404, "Availability slot was not found", "AVAILABILITY_NOT_FOUND");
    if (slot.bookings.length) {
      throw new AppError(409, "Termin ma aktywne rezerwacje. Najpierw anuluj lub przełóż te wizyty.", "SLOT_HAS_BOOKINGS");
    }
    await tx.availabilitySlot.update({ where: { id: slot.id }, data: { archivedAt: slot.archivedAt ?? now } });
  });
}

function freeAvailability<T extends { startsAt: Date; endsAt: Date }>(slot: T, bookings: { startsAt: Date; endsAt: Date }[], now: Date): T[] {
  let cursor = new Date(Math.max(slot.startsAt.getTime(), now.getTime()));
  const gaps: T[] = [];
  for (const booking of bookings) {
    if (booking.startsAt > cursor) gaps.push({ ...slot, startsAt: cursor, endsAt: booking.startsAt });
    if (booking.endsAt > cursor) cursor = booking.endsAt;
  }
  if (cursor < slot.endsAt) gaps.push({ ...slot, startsAt: cursor, endsAt: slot.endsAt });
  return gaps;
}

export async function getOwnSchedule(accountId: string, role: AccountRole, input: CalendarInput = {}) {
  requireUser(role);
  const profile = await prisma.sitterProfile.findUnique({ where: { accountId }, select: { id: true } });
  if (!profile) throw new AppError(404, "Sitter profile was not found", "SITTER_NOT_FOUND");
  const window = calendarWindow(input);
  const slots = await prisma.availabilitySlot.findMany({
    where: { sitterProfileId: profile.id, archivedAt: null, startsAt: { lt: window.to }, endsAt: { gt: window.from } },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }], take: window.limit + 1,
    ...(window.cursor ? { cursor: { id: window.cursor }, skip: 1 } : {}),
    include: { bookings: scheduleBookings(window.from, window.to) }
  });
  const page = slots.slice(0, window.limit);
  return { slots: page, window: { from: window.from, to: window.to }, nextCursor: slots.length > window.limit ? page.at(-1)!.id : null };
}

export async function getSitterAvailability(profileId: string, sitterServiceId: string, input: CalendarInput = {}) {
  const now = new Date();
  const window = calendarWindow(input);
  const service = await prisma.sitterService.findFirst({
    where: { id: sitterServiceId, sitterProfileId: profileId, isActive: true, sitterProfile: {
      isActive: true, account: { emailVerifiedAt: { not: null }, blockedAt: null, deactivatedAt: null }
    } }
  });
  if (!service) throw new AppError(404, "Oferta opiekuna jest już niedostępna.", "SERVICE_NOT_FOUND");
  const slots = await prisma.availabilitySlot.findMany({
    where: { sitterProfileId: profileId, archivedAt: null, startsAt: { lt: window.to }, endsAt: { gt: new Date(Math.max(now.getTime(), window.from.getTime())) } },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }], take: window.limit + 1,
    ...(window.cursor ? { cursor: { id: window.cursor }, skip: 1 } : {}),
    include: { bookings: { where: { ...activeBookingWhere(now), startsAt: { lt: window.to }, endsAt: { gt: window.from } }, orderBy: { startsAt: "asc" }, select: { startsAt: true, endsAt: true } } }
  });
  const page = slots.slice(0, window.limit);
  return { service, availability: page.flatMap(({ bookings, archivedAt: _archivedAt, ...slot }) => freeAvailability({
    ...slot, startsAt: new Date(Math.max(slot.startsAt.getTime(), window.from.getTime())), endsAt: new Date(Math.min(slot.endsAt.getTime(), window.to.getTime()))
  }, bookings, now)).filter(slot => slot.endsAt.getTime() - slot.startsAt.getTime() >= service.durationMinutes * 60_000),
  window: { from: window.from, to: window.to }, nextCursor: slots.length > window.limit ? page.at(-1)!.id : null };
}

export async function searchSitters(input: {
  latitude: number; longitude: number; radiusKm: number; serviceType?: SitterServiceType;
  from?: Date; to?: Date; page: number; pageSize: number;
}) {
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
         WHERE b."availabilitySlotId" = a.id AND (b.status = 'ACCEPTED' OR (b.status = 'REQUESTED' AND b."expiresAt" > ${now} AND b."startsAt" > ${now}))),
        '{}'::tsmultirange)) AS g(period)
      WHERE a."archivedAt" IS NULL AND upper(g.period) > ${now}
    ), nearby AS (
      SELECT p.id, p."serviceRadiusKm", 6371 * acos(LEAST(1.0, GREATEST(-1.0,
        sin(radians(${input.latitude}::double precision)) * sin(radians(p.latitude)) +
        cos(radians(${input.latitude}::double precision)) * cos(radians(p.latitude)) *
        cos(radians(p.longitude - ${input.longitude}::double precision))))) AS distance
      FROM "SitterProfile" p JOIN "Account" ac ON ac.id = p."accountId"
      WHERE p."isActive" = true AND ac."emailVerifiedAt" IS NOT NULL AND ac."blockedAt" IS NULL AND ac."deactivatedAt" IS NULL
      AND EXISTS (SELECT 1 FROM "SitterService" v JOIN free f ON f."sitterProfileId" = v."sitterProfileId"
        WHERE v."sitterProfileId" = p.id AND v."isActive" = true ${serviceFilter}
        AND f."endsAt" - GREATEST(f."startsAt", ${now}) >= v."durationMinutes" * interval '1 minute'
        ${input.from && input.to ? Prisma.sql`AND GREATEST(f."startsAt", ${now}) <= ${input.from} AND f."endsAt" >= ${input.to}` : Prisma.empty})
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
      availability: { where: { archivedAt: null, endsAt: { gt: now } }, orderBy: { startsAt: "asc" },
        include: { bookings: { where: activeBookingWhere(now), orderBy: { startsAt: "asc" } } } }
    }
  });
  const items = await Promise.all(rows.map(async row => {
    const profile = profiles.find(p => p.id === row.id);
    if (!profile) return null;
    const availability = profile.availability.flatMap(slot => {
      const { bookings, ...range } = slot;
      return freeAvailability(range, bookings, now).filter(gap => profile.services.some(service => gap.endsAt.getTime() - gap.startsAt.getTime() >= service.durationMinutes * 60_000));
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
