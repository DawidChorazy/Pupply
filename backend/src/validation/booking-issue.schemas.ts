import { z } from "zod";

export const createBookingIssueSchema = z.object({
  category: z.enum(["NO_SHOW", "EARLY_FINISH", "PET_SAFETY", "OTHER"]),
  description: z.string().trim().min(10).max(4000)
}).strict();
export const listBookingIssuesSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"]).optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1)
});
export const reviewBookingIssueSchema = z.object({
  version: z.number().int().positive(),
  status: z.enum(["IN_REVIEW", "RESOLVED", "REJECTED"]),
  resolution: z.string().trim().min(10).max(2000)
}).strict();
