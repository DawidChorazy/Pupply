import { Router } from "express";

import {
  confirmEmailVerification,
  loginWithGoogle,
  login,
  logout,
  logoutAll,
  refreshSession,
  registerClinic,
  registerUser,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword
} from "../services/auth.service";
import { requireAuth } from "../middleware/require-auth";
import { authRateLimiter } from "../middleware/rate-limit";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import {
  confirmEmailVerificationSchema,
  googleLoginSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerClinicSchema,
  registerUserSchema,
  requestPasswordResetSchema,
  resetPasswordSchema
} from "../validation/auth.schemas";

const authRouter = Router();

authRouter.use(authRateLimiter);

authRouter.post(
  "/register/user",
  asyncHandler(async (req, res) => {
    const payload = registerUserSchema.parse(req.body);
    const { confirmPassword: _confirmPassword, ...registerPayload } = payload;

    const result = await registerUser(registerPayload);

    res.status(201).json(result);
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const payload = logoutSchema.parse(req.body);
    await logout(payload);
    res.status(204).send();
  })
);

authRouter.post(
  "/logout-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
    await logoutAll(req.auth.accountId);
    res.status(204).send();
  })
);

authRouter.post(
  "/password-reset/request",
  asyncHandler(async (req, res) => {
    const payload = requestPasswordResetSchema.parse(req.body);
    const result = await requestPasswordReset(payload.email);
    res.status(202).json({ accepted: true, ...result });
  })
);

authRouter.post(
  "/password-reset/confirm",
  asyncHandler(async (req, res) => {
    const payload = resetPasswordSchema.parse(req.body);
    await resetPassword(payload.token, payload.password);
    res.status(204).send();
  })
);

authRouter.post(
  "/email-verification/request",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new AppError(401, "Authentication context is missing", "AUTH_REQUIRED");
    const result = await requestEmailVerification(req.auth.accountId);
    res.status(202).json({ accepted: true, ...result });
  })
);

authRouter.post(
  "/email-verification/confirm",
  asyncHandler(async (req, res) => {
    const payload = confirmEmailVerificationSchema.parse(req.body);
    await confirmEmailVerification(payload.token);
    res.status(204).send();
  })
);

authRouter.post(
  "/register/clinic",
  asyncHandler(async (req, res) => {
    const payload = registerClinicSchema.parse(req.body);
    const { confirmPassword: _confirmPassword, ...registerPayload } = payload;

    const result = await registerClinic(registerPayload);

    res.status(201).json(result);
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const result = await login(payload);

    res.status(200).json(result);
  })
);

authRouter.post(
  "/google",
  asyncHandler(async (req, res) => {
    const payload = googleLoginSchema.parse(req.body);
    const result = await loginWithGoogle(payload);

    res.status(200).json(result);
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const payload = refreshTokenSchema.parse(req.body);
    const result = await refreshSession(payload);

    res.status(200).json(result);
  })
);

export { authRouter };
