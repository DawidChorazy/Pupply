import { Router } from "express";

import {
  login,
  refreshSession,
  registerClinic,
  registerUser
} from "../services/auth.service";
import { asyncHandler } from "../utils/async-handler";
import {
  loginSchema,
  refreshTokenSchema,
  registerClinicSchema,
  registerUserSchema
} from "../validation/auth.schemas";

const authRouter = Router();

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
  "/refresh",
  asyncHandler(async (req, res) => {
    const payload = refreshTokenSchema.parse(req.body);
    const result = await refreshSession(payload);

    res.status(200).json(result);
  })
);

export { authRouter };
