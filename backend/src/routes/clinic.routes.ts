import { Router } from "express";

import { requireAuth } from "../middleware/require-auth";
import { getClinicProfile, updateClinicProfile } from "../services/profile.service";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import { updateClinicProfileSchema } from "../validation/profile.schemas";

const clinicRouter = Router();

clinicRouter.get("/me", requireAuth, asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  const profile = await getClinicProfile(req.auth.accountId, req.auth.role);
  res.status(200).json({ profile });
}));

clinicRouter.patch("/me", requireAuth, asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
  const input = updateClinicProfileSchema.parse(req.body);
  const profile = await updateClinicProfile(req.auth.accountId, req.auth.role, input);
  res.status(200).json({ profile });
}));

export { clinicRouter };
