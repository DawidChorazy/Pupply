import { z } from "zod";

export const bookingOperationKeySchema = z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/).optional();

const bookingFields = {
  petId: z.string().min(1),
  sitterServiceId: z.string().min(1),
  durationMinutes: z.number().int().min(15).max(1440).optional(),
  expectedPriceCents: z.number().int().min(0).max(2_147_483_647).optional(),
  note: z.string().trim().max(1000).optional()
};

export const createBookingSchema = z.object({
  ...bookingFields,
  availabilitySlotId: z.string().min(1),
  startsAt: z.coerce.date().optional()
});

export const createBookingsSchema = z.object({
  ...bookingFields,
  slots: z.array(z.object({ availabilitySlotId: z.string().min(1), startsAt: z.coerce.date() })).min(1).max(28)
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(["ACCEPTED", "REJECTED", "CANCELLED", "COMPLETED"])
});

export const listBookingsSchema = z.object({
  perspective: z.enum(["owner", "sitter", "all"]).default("all"),
  status: z.enum(["REQUESTED", "ACCEPTED", "REJECTED", "CANCELLED", "COMPLETED", "EXPIRED"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
});
