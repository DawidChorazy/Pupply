import { z } from "zod";

export const listNotificationsSchema = z.object({
  unreadOnly: z.enum(["true", "false"]).optional().transform((value) => value === "true"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
});
