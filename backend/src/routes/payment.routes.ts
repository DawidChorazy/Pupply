import { Router, raw } from "express";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { requireAuth } from "../middleware/require-auth";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../utils/app-error";
import { applyPayuOrder, applyPayuRefund, getPayment, paymentHistory, recoverPayuOrder, syncPayment } from "../services/payment.service";
import { payuOrderSchema, payuRefundSchema, verifyPayuSignature } from "../services/payu.client";
import { prisma } from "../config/prisma";

export const payuWebhookRouter = Router();
// Mounted before express.json: verification uses the exact received bytes.
payuWebhookRouter.post("/", raw({ type: "application/json", limit: "64kb" }), asyncHandler(async (req, res) => {
  if (!Buffer.isBuffer(req.body)) throw new AppError(400, "Wymagany dokument JSON.", "INVALID_PAYU_BODY");
  verifyPayuSignature(req.body, req.header("OpenPayu-Signature") ?? req.header("X-OpenPayu-Signature"));
  let body: unknown;
  try { body = JSON.parse(req.body.toString("utf8")); } catch { throw new AppError(400, "Nieprawidłowy JSON.", "INVALID_PAYU_BODY"); }
  const payload = z.union([z.object({ order: payuOrderSchema }), z.object({ orderId: z.string(), extOrderId: z.string(), refund: payuRefundSchema })]).parse(body);
  if ("order" in payload) await applyPayuOrder(payload.order);
  else await applyPayuRefund(payload.extOrderId, payload.orderId, payload.refund);
  res.status(200).json({ received: true });
}));

export const paymentRouter = Router();
paymentRouter.use(requireAuth);
paymentRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
paymentRouter.get("/", asyncHandler(async (req, res) => {
  const query = z.object({ perspective: z.enum(["owner", "sitter"]).default("owner"), page: z.coerce.number().int().min(1).max(10000).default(1) }).parse(req.query);
  res.json(await paymentHistory(req.auth!.accountId, req.auth!.role, query.perspective, query.page));
}));
paymentRouter.get("/:paymentId", asyncHandler(async (req, res) => { res.json({ payment: await getPayment(req.auth!.accountId, req.auth!.role, String(req.params.paymentId)) }); }));
paymentRouter.post("/:paymentId/sync", rateLimit({ windowMs: 60_000, limit: 20, keyGenerator: req => req.auth!.accountId, standardHeaders: "draft-8", legacyHeaders: false }), asyncHandler(async (req, res) => {
  res.json({ payment: await syncPayment(req.auth!.accountId, req.auth!.role, String(req.params.paymentId)) });
}));

export const paymentAdminRouter = Router();
paymentAdminRouter.use(requireAuth);
paymentAdminRouter.post("/:paymentId/recover", asyncHandler(async (req, res) => {
  if (req.auth!.role !== "ADMIN") throw new AppError(403, "Wymagane konto administratora.", "FORBIDDEN");
  const { orderId } = z.object({ orderId: z.string().min(1).max(128) }).strict().parse(req.body);
  const id = String(req.params.paymentId);
  const payment = await prisma.payment.findUnique({ where: { id }, select: { booking: { select: { ownerAccountId: true } } } });
  if (!payment) throw new AppError(404, "Nie znaleziono płatności.", "PAYMENT_NOT_FOUND");
  await recoverPayuOrder(id, orderId);
  await prisma.auditLog.create({ data: { actorAccountId: req.auth!.accountId, targetAccountId: payment.booking.ownerAccountId, action: "PAYU_ORDER_RECOVERED", reason: `paymentId=${id}; orderId=${orderId}` } });
  res.json({ recovered: true });
}));
