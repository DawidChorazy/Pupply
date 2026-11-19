import { z } from "zod";

const version = z.number().int().min(0).max(2_147_483_646);
export const sitterVerificationStatuses = z.enum(["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"]);
export const listSitterVerificationsSchema = z.object({
  status: sitterVerificationStatuses.default("PENDING"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
}).strict();
export const verificationFileSchema = z.object({
  purpose: z.enum(["IDENTITY_DOCUMENT", "FACE_PHOTO"]),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().min(12).max(10_000_000)
}).strict();
export const submitSitterVerificationSchema = z.object({
  expectedVersion: version, documentFileId: z.string().uuid(), faceFileId: z.string().uuid()
}).strict().refine(value => value.documentFileId !== value.faceFileId, "Wybierz dwa oddzielne zdjęcia.");
const reviewFields = { expectedVersion: version, reason: z.string().trim().min(3).max(1000) };
export const reviewSitterVerificationSchema = z.discriminatedUnion("decision", [
  z.object({ ...reviewFields, decision: z.literal("APPROVE"), documentConfirmed: z.literal(true), faceConfirmed: z.literal(true) }).strict(),
  z.object({ ...reviewFields, decision: z.literal("REJECT") }).strict()
]);
