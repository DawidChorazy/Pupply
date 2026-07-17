import { Router } from "express";

import { requireAuth } from "../middleware/require-auth";
import { getUserProfile, updateUserProfile } from "../services/profile.service";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import { updateUserProfileSchema } from "../validation/profile.schemas";

const userRouter = Router();

userRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
    }

    const profile = await getUserProfile(req.auth.accountId, req.auth.role);

    res.status(200).json({
      profile
    });
  })
);

userRouter.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
    const input = updateUserProfileSchema.parse(req.body);
    const profile = await updateUserProfile(req.auth.accountId, req.auth.role, input);
    res.status(200).json({ profile });
  })
);

export { userRouter };
