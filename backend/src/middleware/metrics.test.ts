import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { env } from "../config/env";
import { collectMetrics, metrics } from "./metrics";

describe("operational metrics", () => {
  it("requires the metrics token and never labels requests with user identifiers", async () => {
    const previous = env.METRICS_TOKEN;
    env.METRICS_TOKEN = "test_metrics_secret_at_least_32_characters";
    try {
      const app = express(); app.use(collectMetrics);
      app.get("/pets/:petId", (_req, res) => { res.json({ ok: true }); }); app.get("/metrics", metrics);
      await request(app).get("/pets/private-pet-id?secret=sensitive");
      expect((await request(app).get("/metrics")).status).toBe(404);
      expect((await request(app).get("/metrics").set("Authorization", "Bearer invalid")).status).toBe(404);
      const response = await request(app).get("/metrics").set("Authorization", `Bearer ${env.METRICS_TOKEN}`);
      expect(response.status).toBe(200); expect(response.text).toContain('route="/pets/:petId"');
      expect(response.text).not.toContain("private-pet-id"); expect(response.text).not.toContain("sensitive");
    } finally { env.METRICS_TOKEN = previous; }
  });
});
