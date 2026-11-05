import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { env } from "../config/env";

import { requireAuth } from "../middleware/require-auth";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount
} from "../services/notification.service";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import { listNotificationsSchema } from "../validation/notification.schemas";

const notificationRouter = Router();
notificationRouter.use(requireAuth);
notificationRouter.get("/push-config", (_req, res) => { res.json({ enabled: env.PUSH_ENABLED }); });
notificationRouter.delete("/devices/all", asyncHandler(async (req, res) => {
  await prisma.pushDevice.deleteMany({ where: { accountId: req.auth!.accountId } });
  res.status(204).send();
}));
const pushDeviceSchema = z.object({ token: z.string().max(200).regex(/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/) });
notificationRouter.post("/devices", asyncHandler(async (req, res) => {
  if (!req.auth?.sessionId) throw new AppError(401, "Zaloguj się ponownie, aby włączyć push", "AUTH_REQUIRED");
  const input = pushDeviceSchema.parse(req.body);
  const count = await prisma.pushDevice.count({ where: { accountId: req.auth!.accountId } });
  const existing = await prisma.pushDevice.findUnique({ where: { token: input.token } });
  if (count >= 10 && existing?.accountId !== req.auth!.accountId) throw new AppError(409, "Device limit reached", "DEVICE_LIMIT");
  await prisma.pushDevice.upsert({ where: { token: input.token }, create: { token: input.token, accountId: req.auth!.accountId, sessionId: req.auth.sessionId }, update: { accountId: req.auth!.accountId, sessionId: req.auth.sessionId } });
  res.status(204).send();
}));
notificationRouter.delete("/devices", asyncHandler(async (req, res) => {
  await prisma.pushDevice.deleteMany({ where: { token: pushDeviceSchema.parse(req.body).token, accountId: req.auth!.accountId } });
  res.status(204).send();
}));

notificationRouter.get("/", asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  res.status(200).json(await listNotifications(req.auth.accountId, listNotificationsSchema.parse(req.query)));
}));

notificationRouter.get("/unread-count", asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  res.status(200).json({ count: await unreadNotificationCount(req.auth.accountId) });
}));

notificationRouter.patch("/:notificationId/read", asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  await markNotificationRead(req.auth.accountId, String(req.params.notificationId));
  res.status(204).send();
}));

notificationRouter.post("/read-all", asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  const result = await markAllNotificationsRead(req.auth.accountId);
  res.status(200).json({ updated: result.count });
}));

export { notificationRouter };
