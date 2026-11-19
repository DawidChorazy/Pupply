import { Router } from "express";

import { requireAuth } from "../middleware/require-auth";
import { getClinicProfile, updateClinicProfile } from "../services/profile.service";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import { updateClinicProfileSchema } from "../validation/profile.schemas";
import { submitClinicVerificationSchema } from "../validation/clinic.schemas";
import { submitClinicVerification } from "../services/clinic-verification.service";
import { createAuthRateLimiter } from "../middleware/rate-limit";

const clinicRouter = Router();
clinicRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

clinicRouter.post("/me/verification", requireAuth, createAuthRateLimiter({ limit: 10, keyGenerator: req => req.auth!.accountId }), asyncHandler(async (req, res) => {
  const input = submitClinicVerificationSchema.parse(req.body);
  res.status(202).json({ verification: await submitClinicVerification(req.auth!.accountId, req.auth!.role, input.expectedVersion) });
}));

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
