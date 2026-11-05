import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { publicSitterReviews } from "../services/review.service";
import { listReviewsSchema } from "../validation/review.schemas";

import { requireAuth } from "../middleware/require-auth";
import {
  addAvailability,
  addAvailabilityBatch,
  changeAvailabilityArchive,
  createSitterProfile,
  deleteAvailability,
  getOwnSitterProfile,
  getOwnSchedule,
  getSitterAvailability,
  searchSitters,
  updateSitterProfile,
  updateAvailability
} from "../services/sitter.service";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import {
  createAvailabilitySchema,
  batchAvailabilitySchema,
  availabilitySelectionSchema,
  sitterAvailabilityQuerySchema,
  calendarQuerySchema,
  createSitterProfileSchema,
  searchSittersSchema,
  updateSitterProfileSchema
} from "../validation/sitter.schemas";

const sitterRouter = Router();
sitterRouter.get("/:profileId/reviews", rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: "RATE_LIMITED", message: "Zbyt wiele zapytań o opinie. Spróbuj ponownie za chwilę." }) }), asyncHandler(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(await publicSitterReviews(String(req.params.profileId), listReviewsSchema.parse(req.query)));
}));

sitterRouter.get("/", asyncHandler(async (req, res) => {
  const input = searchSittersSchema.parse(req.query);
  res.status(200).json(await searchSitters(input));
}));

sitterRouter.post("/me", requireAuth, asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  const input = createSitterProfileSchema.parse(req.body);
  const profile = await createSitterProfile(req.auth.accountId, req.auth.role, input);
  res.status(201).json({ profile });
}));

sitterRouter.get("/me", requireAuth, asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  const profile = await getOwnSitterProfile(req.auth.accountId, req.auth.role);
  res.status(200).json({ profile });
}));

sitterRouter.get("/me/schedule", requireAuth, asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  res.status(200).json(await getOwnSchedule(req.auth.accountId, req.auth.role, calendarQuerySchema.parse(req.query)));
}));

sitterRouter.patch("/me", requireAuth, asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  const input = updateSitterProfileSchema.parse(req.body);
  const profile = await updateSitterProfile(req.auth.accountId, req.auth.role, input);
  res.status(200).json({ profile });
}));

sitterRouter.post("/me/availability", requireAuth, asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  const input = createAvailabilitySchema.parse(req.body);
  const slot = await addAvailability(req.auth.accountId, req.auth.role, input);
  res.status(201).json({ slot });
}));

sitterRouter.delete("/me/availability/:slotId", requireAuth, asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  await deleteAvailability(req.auth.accountId, req.auth.role, String(req.params.slotId));
  res.status(204).send();
}));

sitterRouter.post("/me/availability/batch", requireAuth, asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  const { slots } = batchAvailabilitySchema.parse(req.body);
  res.status(201).json({ slots: await addAvailabilityBatch(req.auth.accountId, req.auth.role, slots) });
}));

sitterRouter.post("/me/availability/archive", requireAuth, asyncHandler(async (req, res) => {
  const { slotIds } = availabilitySelectionSchema.parse(req.body);
  await changeAvailabilityArchive(req.auth!.accountId, req.auth!.role, slotIds);
  res.status(200).json({ slotIds });
}));

sitterRouter.post("/me/availability/restore", requireAuth, asyncHandler(async (req, res) => {
  const { slotIds } = availabilitySelectionSchema.parse(req.body);
  res.json({ slots: await changeAvailabilityArchive(req.auth!.accountId, req.auth!.role, slotIds, true) });
}));

sitterRouter.patch("/me/availability/:slotId", requireAuth, asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  const input = createAvailabilitySchema.parse(req.body);
  res.status(200).json({ slot: await updateAvailability(req.auth.accountId, req.auth.role, String(req.params.slotId), input) });
}));

sitterRouter.get("/:profileId/availability", asyncHandler(async (req, res) => {
  const { sitterServiceId, ...window } = sitterAvailabilityQuerySchema.parse(req.query);
  res.status(200).json(await getSitterAvailability(String(req.params.profileId), sitterServiceId, window));
}));

export { sitterRouter };
