import { rateLimit } from "express-rate-limit";

import { env } from "../config/env";

export function createAuthRateLimiter(options: { windowMs?: number; limit?: number } = {}) {
  return rateLimit({
  windowMs: options.windowMs ?? env.AUTH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  limit: options.limit ?? env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "RATE_LIMITED",
      message: "Too many authentication attempts. Try again later.",
      requestId: req.requestId
    });
  }
  });
}

export const authRateLimiter = createAuthRateLimiter();
