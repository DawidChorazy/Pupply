import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { requireAuth } from "../middleware/require-auth";
import { asyncHandler } from "../utils/async-handler";
import { getConversation, listConversations, listMessages, markConversationRead, openConversation, sendMessage, unreadMessageCount } from "../services/chat.service";
import { chatIdSchema, listConversationsSchema, listMessagesSchema, openConversationSchema, readConversationSchema, sendMessageSchema } from "../validation/chat.schemas";

export const chatRouter = Router();
chatRouter.use(requireAuth);
chatRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
const limit = (max: number) => rateLimit({ windowMs: 60_000, limit: max, keyGenerator: req => req.auth!.accountId,
  standardHeaders: "draft-8", legacyHeaders: false, handler: (req, res) => { res.status(429).json({
    error: "RATE_LIMITED", message: "Zbyt wiele operacji czatu. Spróbuj za chwilę.", requestId: req.requestId
  }); } });
chatRouter.use(limit(300));
chatRouter.get("/", asyncHandler(async (req, res) => {
  res.json(await listConversations(req.auth!.accountId, req.auth!.role, listConversationsSchema.parse(req.query)));
}));
chatRouter.post("/", limit(10), asyncHandler(async (req, res) => {
  res.json({ conversation: await openConversation(req.auth!.accountId, req.auth!.role, openConversationSchema.parse(req.body)) });
}));
chatRouter.get("/unread-count", asyncHandler(async (req, res) => {
  res.json({ count: await unreadMessageCount(req.auth!.accountId, req.auth!.role) });
}));
chatRouter.get("/:conversationId", asyncHandler(async (req, res) => {
  res.json({ conversation: await getConversation(req.auth!.accountId, req.auth!.role, chatIdSchema.parse(req.params.conversationId)) });
}));
chatRouter.get("/:conversationId/messages", asyncHandler(async (req, res) => {
  res.json(await listMessages(req.auth!.accountId, req.auth!.role, chatIdSchema.parse(req.params.conversationId), listMessagesSchema.parse(req.query)));
}));
chatRouter.post("/:conversationId/messages", limit(30), asyncHandler(async (req, res) => {
  res.status(201).json({ message: await sendMessage(req.auth!.accountId, req.auth!.role, chatIdSchema.parse(req.params.conversationId), sendMessageSchema.parse(req.body)) });
}));
chatRouter.patch("/:conversationId/read", asyncHandler(async (req, res) => {
  const input = readConversationSchema.parse(req.body);
  res.json(await markConversationRead(req.auth!.accountId, req.auth!.role, chatIdSchema.parse(req.params.conversationId), input.throughSequence));
}));
