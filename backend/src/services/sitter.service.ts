import { AccountRole, Prisma, SitterServiceType } from "@prisma/client";

import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

type ServiceInput = {
  type: SitterServiceType;
  durationMinutes: number;
  priceCents: number;
  isActive?: boolean;
};

type ProfileInput = {
  bio: string;
  city: string;
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
  const existing = await prisma.sitterProfile.findUnique({ where: { accountId } });
  if (existing) throw new AppError(409, "Sitter profile already exists", "SITTER_PROFILE_EXISTS");
  return prisma.sitterProfile.create({
    data: {
      accountId,
      bio: input.bio,
      city: input.city,
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
}

export async function getOwnSitterProfile(accountId: string, role: AccountRole) {
  requireUser(role);
  const profile = await prisma.sitterProfile.findUnique({ where: { accountId }, include: ownInclude });
  if (!profile) throw new AppError(404, "Sitter profile was not found", "SITTER_NOT_FOUND");
  return profile;
}

export async function updateSitterProfile(
  accountId: string,
  role: AccountRole,
  input: Partial<ProfileInput>
) {
  requireUser(role);
  const profile = await prisma.sitterProfile.findUnique({ where: { accountId } });
  if (!profile) throw new AppError(404, "Sitter profile was not found", "SITTER_NOT_FOUND");

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
  const overlap = await prisma.availabilitySlot.findFirst({
    where: {
      sitterProfileId: profile.id,
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt }
    }
  });
  if (overlap) throw new AppError(409, "Availability overlaps an existing slot", "AVAILABILITY_OVERLAP");
  return prisma.availabilitySlot.create({ data: { sitterProfileId: profile.id, ...input } });
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

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function searchSitters(input: {
  latitude: number;
  longitude: number;
  radiusKm: number;
  serviceType?: SitterServiceType;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}) {
  const now = new Date();
  const availabilityWhere: Prisma.AvailabilitySlotWhereInput = {
    startsAt: input.from ? { lte: input.from, gt: now } : { gt: now },
    endsAt: input.to ? { gte: input.to } : undefined,
    bookings: { none: { activeSlotKey: { not: null } } }
  };
  const where: Prisma.SitterProfileWhereInput = {
    isActive: true,
    services: { some: { isActive: true, type: input.serviceType } },
    availability:
      input.from && input.to
        ? {
            some: availabilityWhere
          }
        : undefined
  };
  const profiles = await prisma.sitterProfile.findMany({
    where,
    include: {
      account: { select: { userProfile: { select: { fullName: true } } } },
      services: { where: { isActive: true, type: input.serviceType }, orderBy: { priceCents: "asc" } },
      availability: { where: availabilityWhere, orderBy: { startsAt: "asc" }, take: 20 }
    }
  });
  const matches = profiles
    .map((profile) => ({
      id: profile.id,
      displayName: profile.account.userProfile?.fullName ?? "Opiekun Pupply",
      bio: profile.bio,
      city: profile.city,
      serviceRadiusKm: profile.serviceRadiusKm,
      services: profile.services,
      availability: profile.availability,
      distanceKm: Math.round(distanceKm(input.latitude, input.longitude, profile.latitude, profile.longitude) * 10) / 10
    }))
    .filter((profile) => profile.distanceKm <= input.radiusKm && profile.distanceKm <= profile.serviceRadiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id));
  const start = (input.page - 1) * input.pageSize;
  return {
    items: matches.slice(start, start + input.pageSize),
    pagination: { page: input.page, pageSize: input.pageSize, total: matches.length }
  };
}
