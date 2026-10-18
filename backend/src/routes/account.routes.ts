import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/require-auth";
import { createAuthRateLimiter } from "../middleware/rate-limit";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../utils/app-error";
import { passwordSchema } from "../validation/auth.schemas";
import { changePassword, requestEmailChange, setAccountState } from "../services/account.service";
import { requireVerifiedEmail } from "../services/account-access.service";

export const accountRouter = Router();
accountRouter.use(requireAuth);
accountRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
accountRouter.post("/password", createAuthRateLimiter(), asyncHandler(async (req, res) => {
  const input = z.object({ currentPassword: z.string().min(1), password: passwordSchema }).parse(req.body);
  await changePassword(req.auth!.accountId, input.currentPassword, input.password);
  res.status(204).send();
}));
accountRouter.post("/email", createAuthRateLimiter(), asyncHandler(async (req, res) => {
  const input = z.object({ email: z.string().trim().email().transform(value => value.toLowerCase()), password: z.string().min(1) }).parse(req.body);
  res.status(202).json({ accepted: true, ...await requestEmailChange(req.auth!.accountId, input.email, input.password) });
}));
accountRouter.post("/deactivate", asyncHandler(async (req, res) => {
  z.object({ confirmation: z.literal("DEACTIVATE") }).parse(req.body);
  await setAccountState(req.auth!.accountId, req.auth!.accountId, "DEACTIVATE");
  res.status(204).send();
}));
accountRouter.get("/preferences", asyncHandler(async (req, res) => {
  res.json(await prisma.account.findUniqueOrThrow({ where: { id: req.auth!.accountId }, select: { emailNotifications: true } }));
}));
accountRouter.patch("/preferences", asyncHandler(async (req, res) => {
  const input = z.object({ emailNotifications: z.boolean() }).parse(req.body);
  if (input.emailNotifications) await requireVerifiedEmail(req.auth!.accountId);
  res.json(await prisma.account.update({ where: { id: req.auth!.accountId }, data: input, select: { emailNotifications: true } }));
}));

export const adminRouter = Router();
adminRouter.use(requireAuth);
adminRouter.use((req, _res, next) => next(req.auth?.role === "ADMIN" ? undefined : new AppError(403, "Administrator access required", "FORBIDDEN")));
adminRouter.post("/accounts/:accountId/state", asyncHandler(async (req, res) => {
  const input = z.object({ action: z.enum(["BLOCK", "RESTORE"]), reason: z.string().trim().min(3).max(500) }).parse(req.body);
  await setAccountState(req.auth!.accountId, String(req.params.accountId), input.action, input.reason);
  res.status(204).send();
}));
adminRouter.get("/audit", asyncHandler(async (req, res) => {
  const input = z.object({ accountId: z.string().optional(), page: z.coerce.number().int().min(1).default(1) }).parse(req.query);
  res.json({ items: await prisma.auditLog.findMany({ where: { targetAccountId: input.accountId }, orderBy: { createdAt: "desc" }, skip: (input.page - 1) * 50, take: 50 }) });
}));
