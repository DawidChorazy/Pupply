import { z } from "zod";

export const createBookingSchema = z.object({
  petId: z.string().min(1),
  sitterServiceId: z.string().min(1),
  availabilitySlotId: z.string().min(1),
  note: z.string().trim().max(1000).optional()
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(["ACCEPTED", "REJECTED", "CANCELLED", "COMPLETED"])
});

export const listBookingsSchema = z.object({
  perspective: z.enum(["owner", "sitter", "all"]).default("all"),
  status: z.enum(["REQUESTED", "ACCEPTED", "REJECTED", "CANCELLED", "COMPLETED"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
});
