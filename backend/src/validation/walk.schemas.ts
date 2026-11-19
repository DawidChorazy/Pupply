import { z } from "zod";

export const walkPointSchema = z.object({
  clientPointId: z.uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100),
  capturedAt: z.iso.datetime().transform(value => new Date(value))
}).strict();
export const walkPointsSchema = z.object({ points: z.array(walkPointSchema).min(1).max(100) }).strict();
export const walkPageSchema = z.object({ after: z.coerce.number().int().min(0).max(20000).default(0) });
export const finishWalkSchema = z.object({ endedAt: z.iso.datetime().transform(value => new Date(value)).optional() }).strict();
export type WalkPointInput = z.infer<typeof walkPointSchema>;
