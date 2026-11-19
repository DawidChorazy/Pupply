import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { AppError } from "../utils/app-error";

export const locationRouter = Router();
locationRouter.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false,
  message: { message: "Zbyt wiele zapytań o lokalizację. Spróbuj za chwilę." } }));

const featureSchema = z.object({
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z.object({ name: z.string().optional(), city: z.string().optional(), state: z.string().optional(),
    county: z.string().optional(), countrycode: z.string().optional(), osm_id: z.union([z.string(), z.number()]).optional() })
});
const cache = new Map<string, { expires: number; items: ReturnType<typeof parsePlaces> }>();

function parsePlaces(data: unknown, reverse: boolean) {
  const parsed = z.object({ features: z.array(featureSchema) }).parse(data);
  const seen = new Set<string>();
  return parsed.features.flatMap(({ geometry, properties: p }) => {
    if (p.countrycode?.toUpperCase() !== "PL") return [];
    const city = (reverse ? p.city || p.name : p.name || p.city)?.trim();
    if (!city) return [];
    const region = (p.state || "").replace(/^województwo\s+/i, "");
    const key = `${city}|${region}|${p.county || ""}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ id: `${p.osm_id || key}`, city, region, county: p.county || "",
      latitude: geometry.coordinates[1], longitude: geometry.coordinates[0] }];
  });
}

async function fetchPlaces(params: URLSearchParams, reverse = false) {
  try {
    const response = await fetch(`https://photon.komoot.io/${reverse ? "reverse" : "api"}/?${params}`, {
      signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Petify/1.0", "Accept": "application/json" }
    });
    if (!response.ok) throw new Error(`Geocoder ${response.status}`);
    return parsePlaces(await response.json(), reverse);
  } catch {
    throw new AppError(503, "Wyszukiwanie miejscowości jest chwilowo niedostępne. Spróbuj ponownie.", "LOCATION_UNAVAILABLE");
  }
}

locationRouter.get("/search", async (req, res, next) => {
  try {
    const { q } = z.object({ q: z.string().trim().min(2).max(120) }).parse(req.query);
    const key = q.toLocaleLowerCase("pl");
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) { res.json({ items: cached.items }); return; }
    const params = new URLSearchParams({ q, limit: "8", countrycode: "PL", bbox: "14.07,49,24.15,54.84" });
    params.append("layer", "city");
    params.append("layer", "locality");
    const items = await fetchPlaces(params);
    if (cache.size >= 300) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: Date.now() + 3600_000, items });
    res.json({ items });
  } catch (error) { next(error); }
});

locationRouter.get("/reverse", async (req, res, next) => {
  try {
    const { latitude, longitude } = z.object({
      latitude: z.coerce.number().min(-90).max(90), longitude: z.coerce.number().min(-180).max(180)
    }).parse(req.query);
    const items = await fetchPlaces(new URLSearchParams({ lat: String(latitude), lon: String(longitude), limit: "1" }), true);
    res.setHeader("Cache-Control", "no-store");
    res.json({ items });
  } catch (error) { next(error); }
});
