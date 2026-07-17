import { Router } from "express";

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
