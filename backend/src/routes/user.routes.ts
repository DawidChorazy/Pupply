import { Router } from "express";

import { requireAuth } from "../middleware/require-auth";
import { getCurrentUserProfile } from "../services/auth.service";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";

const userRouter = Router();

userRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
    }

    const profile = await getCurrentUserProfile(req.auth.accountId);

    res.status(200).json({
      profile
    });
  })
);

export { userRouter };
