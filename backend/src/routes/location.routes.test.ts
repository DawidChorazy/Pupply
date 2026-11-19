import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { locationRouter } from "./location.routes";
import { AppError } from "../utils/app-error";
import { ZodError } from "zod";

const app = express();
app.use("/locations", locationRouter);
app.use(((error, _req, res, _next) => {
  res.status(error instanceof ZodError ? 400 : error instanceof AppError ? error.statusCode : 500).json({ message: error.message });
}) as express.ErrorRequestHandler);

const feature = (name: string, countrycode = "PL") => ({
  geometry: { coordinates: [19.9368, 50.0619] },
  properties: { name, city: "Kraków", state: "województwo małopolskie", countrycode, osm_id: 123 }
});
afterEach(() => vi.unstubAllGlobals());

describe("location endpoints", () => {
  it("rejects incomplete searches and coordinates before contacting the provider", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect((await request(app).get("/locations/search?q=A")).status).toBe(400);
    expect((await request(app).get("/locations/reverse?latitude=999&longitude=19")).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns Polish places with region and coordinates, deduplicates and caches searches", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ features: [feature("Kraków"), feature("Kraków"), feature("Berlin", "DE")] })));
    vi.stubGlobal("fetch", fetchMock);
    const result = await request(app).get("/locations/search?q=Krakow-test");
    expect(result.status).toBe(200);
    expect(result.body.items).toEqual([{ id: "123", city: "Kraków", region: "małopolskie", county: "", latitude: 50.0619, longitude: 19.9368 }]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("countrycode=PL");
    await request(app).get("/locations/search?q=Krakow-test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("uses city instead of a street or landmark in reverse lookup and disables caching", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ features: [feature("Rynek Główny")] }))));
    const result = await request(app).get("/locations/reverse?latitude=50.0619&longitude=19.9368");
    expect(result.status).toBe(200);
    expect(result.body.items[0].city).toBe("Kraków");
    expect(result.headers["cache-control"]).toBe("no-store");
  });
  it("reports provider failures as a recoverable service error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unavailable")));
    const result = await request(app).get("/locations/search?q=offline-test");
    expect(result.status).toBe(503);
    expect(result.body.message).toContain("chwilowo niedostępne");
  });
});
