import { AccountRole } from "@prisma/client";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import { env } from "../config/env";

type AccessPayload = {
  accountId: string;
  role: AccountRole;
};

type RefreshPayload = AccessPayload & {
  tokenId: string;
  type: "refresh";
};

export function signAccessToken(accountId: string, role: AccountRole) {
  return jwt.sign({ role }, env.JWT_ACCESS_SECRET, {
    subject: accountId,
    issuer: "pupply-api",
    audience: "pupply-app",
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  });
}

export function signRefreshToken(accountId: string, role: AccountRole, tokenId: string) {
  return jwt.sign({ role, tokenId, type: "refresh" }, env.JWT_REFRESH_SECRET, {
    subject: accountId,
    issuer: "pupply-api",
    audience: "pupply-app",
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: "pupply-api",
    audience: "pupply-app"
  }) as jwt.JwtPayload & {
    role?: AccountRole;
  };

  if (!decoded.sub || !decoded.role) {
    throw new Error("Invalid access token payload");
  }

  return {
    accountId: decoded.sub,
    role: decoded.role
  };
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: "pupply-api",
    audience: "pupply-app"
  }) as jwt.JwtPayload & {
    role?: AccountRole;
    tokenId?: string;
    type?: string;
  };

  if (!decoded.sub || !decoded.role || !decoded.tokenId || decoded.type !== "refresh") {
    throw new Error("Invalid refresh token payload");
  }

  return {
    accountId: decoded.sub,
    role: decoded.role,
    tokenId: decoded.tokenId,
    type: "refresh"
  };
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createRefreshTokenId() {
  return crypto.randomUUID();
}

export function createOpaqueToken() {
  return crypto.randomBytes(32).toString("base64url");
}
