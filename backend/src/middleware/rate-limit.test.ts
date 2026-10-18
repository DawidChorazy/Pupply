import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createAuthRateLimiter } from "./rate-limit";

describe("authentication rate limiting", () => {
  it("returns the standard error after the configured limit", async () => {
    const app = express();
    app.use(createAuthRateLimiter({ limit: 2, windowMs: 60_000 }));
    app.get("/", (_req, res) => res.status(200).json({ ok: true }));

    expect((await request(app).get("/")).status).toBe(200);
    expect((await request(app).get("/")).status).toBe(200);
    const limited = await request(app).get("/");
    expect(limited.status).toBe(429);
    expect(limited.body.error).toBe("RATE_LIMITED");
  });
});
