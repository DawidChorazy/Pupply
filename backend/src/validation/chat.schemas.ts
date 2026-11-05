import { z } from "zod";

export const chatIdSchema = z.string().min(1).max(100);
export const openConversationSchema = z.union([
  z.object({ sitterProfileId: chatIdSchema }).strict(),
  z.object({ bookingId: chatIdSchema }).strict()
]);
export const listConversationsSchema = z.object({
  cursor: z.string().max(400).optional(), limit: z.coerce.number().int().min(1).max(50).default(20)
});
export const listMessagesSchema = z.object({
  before: z.coerce.number().int().positive().max(2_147_483_647).optional(),
  after: z.coerce.number().int().min(0).max(2_147_483_647).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
}).refine(value => value.before === undefined || value.after === undefined, "Wybierz before lub after.");
export const sendMessageSchema = z.object({
  clientMessageId: z.uuid(), text: z.string().trim().min(1).max(4000)
}).strict();
export const readConversationSchema = z.object({ throughSequence: z.number().int().min(0).max(2_147_483_647) }).strict();
