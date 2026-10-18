import { z } from "zod";

export const passwordSchema = z
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

function isValidPastDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date <= new Date()
  );
}

export const registerUserSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().transform((value) => value.toLowerCase()),
    phone: phoneSchema,
    birthDate: z
      .string()
      .trim()
      .optional()
      .transform((value) => {
        if (!value) return value;

        const match = /^([0-9]{2})\.([0-9]{2})\.([0-9]{4})$/.exec(value);
        if (match) {
          const [, day, month, year] = match;
          return `${year}-${month}-${day}`;
        }

        return value;
      })
      .refine((value) => !value || isValidPastDate(value), {
        message: "Birth date must be a valid past date"
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

export const googleLoginSchema = z.object({
  idToken: z.string().min(10, "Google ID token is required")
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10, "Refresh token is required")
});

export const logoutSchema = refreshTokenSchema;

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase())
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20, "Reset token is required"),
    password: passwordSchema,
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match"
  });

export const confirmEmailVerificationSchema = z.object({
  token: z.string().min(20, "Verification token is required")
});
