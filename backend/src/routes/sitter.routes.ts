import { Router } from "express";

import { requireAuth } from "../middleware/require-auth";
import {
  addAvailability,
  createSitterProfile,
  deleteAvailability,
  getOwnSitterProfile,
  searchSitters,
  updateSitterProfile
} from "../services/sitter.service";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import {
  createAvailabilitySchema,
  createSitterProfileSchema,
  searchSittersSchema,
  updateSitterProfileSchema
} from "../validation/sitter.schemas";

const sitterRouter = Router();

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

export { sitterRouter };
