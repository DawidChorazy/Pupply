import { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/app-error";
import { verifyAccessToken } from "../utils/tokens";
import { prisma } from "../config/prisma";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
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

  let payload: ReturnType<typeof verifyAccessToken>;
  try {
    payload = verifyAccessToken(token);
  } catch (_error) {
    next(new AppError(401, "Invalid or expired access token", "AUTH_INVALID"));
    return;
  }
  try {
    const account = await prisma.account.findUnique({ where: { id: payload.accountId }, select: { role: true, authVersion: true, blockedAt: true, deactivatedAt: true } });
    if (!account || account.blockedAt || account.deactivatedAt || account.authVersion !== payload.version || account.role !== payload.role) {
      next(new AppError(401, "Sesja wygasła lub konto jest nieaktywne", "AUTH_INVALID")); return;
    }
    req.auth = payload;
    if (payload.sessionId && !await prisma.refreshToken.findFirst({ where: { accountId: payload.accountId, familyId: payload.sessionId, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } })) {
      next(new AppError(401, "Sesja została zakończona", "AUTH_INVALID")); return;
    }
    next();
  } catch (error) { next(error); }
}
