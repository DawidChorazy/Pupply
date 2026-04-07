import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character");

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{9,15}$/, "Phone number must contain 9-15 digits")
  .transform((value) => (value.startsWith("+") ? value : `+${value}`));

export const registerUserSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().transform((value) => value.toLowerCase()),
    phone: phoneSchema,
    birthDate: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
        message: "Birth date must be a valid date string"
      }),
    password: passwordSchema,
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match"
  });

export const registerClinicSchema = z
  .object({
    clinicName: z.string().trim().min(2).max(120),
    nip: z.string().trim().regex(/^\d{10}$/, "NIP must contain exactly 10 digits"),
    email: z.string().trim().email().transform((value) => value.toLowerCase()),
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match"
  });

export const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Password is required")
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10, "Refresh token is required")
});
