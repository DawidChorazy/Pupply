import { describe, expect, it } from "vitest";
import { createSitterProfileSchema, updateSitterProfileSchema } from "./sitter.schemas";

const profile = { bio: "Opiekuję się zwierzętami od kilku lat.", city: "Kraków", region: "małopolskie", latitude: 50.06, longitude: 19.93,
  services: [{ type: "DOG_WALK", durationMinutes: 30, priceCents: 3500 }, { type: "DOG_WALK", durationMinutes: 60, priceCents: 5500 }] };

describe("sitter offer validation", () => {
  it("accepts different durations with individual prices and optional photo", () => {
    const parsed = createSitterProfileSchema.parse(profile);
    expect(parsed.services).toHaveLength(2);
    expect(parsed.region).toBe("małopolskie");
    expect(createSitterProfileSchema.safeParse({ ...profile, photoKey: "sitters/account/photo.jpg" }).success).toBe(true);
  });
  it("rejects duplicate type and duration before a database write", () => {
    const services = [profile.services[0], { ...profile.services[0], priceCents: 4500 }];
    expect(createSitterProfileSchema.safeParse({ ...profile, services }).success).toBe(false);
    expect(updateSitterProfileSchema.safeParse({ services }).success).toBe(false);
  });
  it("requires an offer and a valid duration and price", () => {
    expect(createSitterProfileSchema.safeParse({ ...profile, services: [] }).success).toBe(false);
    expect(createSitterProfileSchema.safeParse({ ...profile, services: [{ ...profile.services[0], durationMinutes: 0 }] }).success).toBe(false);
    expect(createSitterProfileSchema.safeParse({ ...profile, services: [{ ...profile.services[0], priceCents: -100 }] }).success).toBe(false);
  });
  it("supports pausing a profile and explicitly removing its photo", () => {
    expect(updateSitterProfileSchema.parse({ isActive: false, photoKey: null })).toEqual({ isActive: false, photoKey: null });
  });
});
