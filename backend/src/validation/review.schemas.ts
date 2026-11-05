import { z } from "zod";

const score = z.number().int().min(1).max(5);
export const createReviewSchema = z.object({
  punctuality: score, communication: score, quality: score,
  comment: z.string().trim().max(2000).optional().transform(value => value || null)
}).strict();
export const listReviewsSchema = z.object({
  cursor: z.string().min(1).max(400).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});
