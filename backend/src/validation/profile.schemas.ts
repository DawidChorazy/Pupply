import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{9,15}$/, "Phone number must contain 9-15 digits")
  .transform((value) => (value.startsWith("+") ? value : `+${value}`));

const birthDateSchema = z
  .string()
  .date("Birth date must use YYYY-MM-DD format")
  .refine((value) => new Date(`${value}T00:00:00.000Z`) <= new Date(), "Birth date cannot be in the future");

export const updateUserProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    phone: phoneSchema.optional(),
    birthDate: birthDateSchema.nullable().optional()
  })
  .refine((data) => Object.keys(data).length > 0, "Update payload is empty");

export const updateClinicProfileSchema = z
  .object({
    clinicName: z.string().trim().min(2).max(120).optional(),
    phone: phoneSchema.optional()
  })
  .refine((data) => Object.keys(data).length > 0, "Update payload is empty");
