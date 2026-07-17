import { z } from "zod";

const serviceSchema = z.object({
  type: z.enum(["DOG_WALK", "DROP_IN", "DAY_CARE"]),
  durationMinutes: z.coerce.number().int().min(15).max(1440),
  priceCents: z.coerce.number().int().min(0).max(10_000_000),
  isActive: z.boolean().optional().default(true)
});

const profileFields = {
  bio: z.string().trim().min(20).max(2000),
  city: z.string().trim().min(2).max(120),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  serviceRadiusKm: z.coerce.number().int().min(1).max(100),
  isActive: z.boolean()
};

export const createSitterProfileSchema = z.object({
  ...profileFields,
  serviceRadiusKm: profileFields.serviceRadiusKm.default(10),
  isActive: profileFields.isActive.default(true),
  services: z.array(serviceSchema).min(1).max(20)
});

export const updateSitterProfileSchema = z
  .object({
    bio: profileFields.bio.optional(),
    city: profileFields.city.optional(),
    latitude: profileFields.latitude.optional(),
    longitude: profileFields.longitude.optional(),
    serviceRadiusKm: profileFields.serviceRadiusKm.optional(),
    isActive: profileFields.isActive.optional(),
    services: z.array(serviceSchema).min(1).max(20).optional()
  })
  .refine((data) => Object.keys(data).length > 0, "Update payload is empty");

export const createAvailabilitySchema = z
  .object({
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date()
  })
  .refine((data) => data.endsAt > data.startsAt, { path: ["endsAt"], message: "End must be after start" })
  .refine((data) => data.startsAt > new Date(), { path: ["startsAt"], message: "Slot must be in the future" });

export const searchSittersSchema = z
  .object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    radiusKm: z.coerce.number().positive().max(100).default(25),
    serviceType: z.enum(["DOG_WALK", "DROP_IN", "DAY_CARE"]).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20)
  })
  .refine((data) => Boolean(data.from) === Boolean(data.to), {
    message: "Both from and to are required for availability filtering"
  })
  .refine((data) => !data.from || !data.to || data.to > data.from, {
    path: ["to"],
    message: "to must be after from"
  });
