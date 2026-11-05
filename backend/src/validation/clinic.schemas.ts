import { z } from "zod";
import { isValidNip, normalizeNip } from "../utils/nip";

export const nipSchema = z.string().max(30).transform(normalizeNip)
  .refine(isValidNip, "Podaj poprawny NIP (10 cyfr i prawidłowa suma kontrolna).");

export const clinicVerificationStatusSchema = z.enum(["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"]);
export const listClinicVerificationsSchema = z.object({
  status: clinicVerificationStatusSchema.default("PENDING"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
});

const version = z.number().int().min(0).max(2_147_483_646);
export const submitClinicVerificationSchema = z.object({ expectedVersion: version }).strict();

const reviewFields = { expectedVersion: version, reason: z.string().trim().min(3).max(1000) };
export const reviewClinicVerificationSchema = z.discriminatedUnion("decision", [
  z.object({
    ...reviewFields,
    decision: z.literal("APPROVE"),
    registryConfirmed: z.literal(true),
    representativeConfirmed: z.literal(true),
    evidenceUrl: z.string().trim().max(1000).url().refine(value => new URL(value).protocol === "https:", "Wymagany jest adres HTTPS źródła weryfikacji.")
  }).strict(),
  z.object({ ...reviewFields, decision: z.literal("REJECT") }).strict()
]);
