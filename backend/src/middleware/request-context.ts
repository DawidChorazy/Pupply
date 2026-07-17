import crypto from "node:crypto";
import { RequestHandler } from "express";

import { env } from "../config/env";

export const requestContext: RequestHandler = (req, res, next) => {
  const incomingId = req.header("x-request-id")?.trim();
  req.requestId = incomingId && incomingId.length <= 100 ? incomingId : crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);

  if (env.NODE_ENV !== "test") {
    const startedAt = Date.now();
    res.on("finish", () => {
      const entry = {
        level: res.statusCode >= 500 ? "error" : "info",
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt
      };

      console.log(JSON.stringify(entry));
    });
  }

  next();
};
