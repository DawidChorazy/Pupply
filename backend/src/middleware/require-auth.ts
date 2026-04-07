import { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/app-error";
import { verifyAccessToken } from "../utils/tokens";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.header("authorization");

  if (!authHeader) {
    next(new AppError(401, "Missing Authorization header", "AUTH_REQUIRED"));
    return;
  }

  if (!authHeader.startsWith("Bearer ")) {
    next(new AppError(401, "Invalid Authorization header", "AUTH_INVALID"));
    return;
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    next(new AppError(401, "Token is missing", "AUTH_INVALID"));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = payload;
    next();
  } catch (_error) {
    next(new AppError(401, "Invalid or expired access token", "AUTH_INVALID"));
  }
}
