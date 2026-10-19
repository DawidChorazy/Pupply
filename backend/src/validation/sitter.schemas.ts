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
  region: z.string().trim().max(120).nullable().optional(),
  photoKey: z.string().trim().min(1).max(500).nullable().optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  serviceRadiusKm: z.coerce.number().int().min(1).max(100),
  isActive: z.boolean()
};

const servicesSchema = z.array(serviceSchema).min(1).max(20).refine((services) => {
  const keys = services.map(service => `${service.type}:${service.durationMinutes}`);
  return new Set(keys).size === keys.length;
}, "Services with the same type and duration must not be duplicated");

export const createSitterProfileSchema = z.object({
  ...profileFields,
  serviceRadiusKm: profileFields.serviceRadiusKm.default(10),
  isActive: profileFields.isActive.default(true),
  services: servicesSchema
});

export const updateSitterProfileSchema = z
  .object({
    bio: profileFields.bio.optional(),
    city: profileFields.city.optional(),
    region: profileFields.region,
    photoKey: profileFields.photoKey,
    latitude: profileFields.latitude.optional(),
    longitude: profileFields.longitude.optional(),
    serviceRadiusKm: profileFields.serviceRadiusKm.optional(),
    isActive: profileFields.isActive.optional(),
    services: servicesSchema.optional()
  })
  .refine((data) => Object.keys(data).length > 0, "Update payload is empty");

export const createAvailabilitySchema = z
  .object({
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date()
  })
  .refine((data) => data.endsAt > data.startsAt, { path: ["endsAt"], message: "End must be after start" })
  .refine((data) => data.startsAt > new Date(), { path: ["startsAt"], message: "Slot must be in the future" });

export const batchAvailabilitySchema = z.object({
  slots: z.array(createAvailabilitySchema).min(1).max(56)
}).refine(({ slots }) => {
  const sorted = [...slots].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return sorted.every((slot, index) => index === 0 || slot.startsAt >= sorted[index - 1].endsAt);
}, { path: ["slots"], message: "Availability intervals must not overlap" });

const calendarFields = {
  from: z.coerce.date().optional(), to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100), cursor: z.string().min(1).max(100).optional()
};
const validCalendarWindow = (input: { from?: Date; to?: Date }) => Boolean(input.from) === Boolean(input.to)
  && (!input.from || !input.to || (input.to > input.from && input.to.getTime() - input.from.getTime() <= 62 * 86_400_000));
export const calendarQuerySchema = z.object(calendarFields).refine(validCalendarWindow, "Podaj poprawny zakres from/to, maksymalnie 62 dni.");
export const sitterAvailabilityQuerySchema = z.object({ ...calendarFields, sitterServiceId: z.string().min(1) })
  .refine(validCalendarWindow, "Podaj poprawny zakres from/to, maksymalnie 62 dni.");

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
