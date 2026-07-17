import { describe, expect, it } from "vitest";

import { assertOwnedPhotoKey, createPetPhotoUpload } from "./storage.service";

describe("pet photo ownership", () => {
  it("accepts only keys inside the account prefix", () => {
    expect(() => assertOwnedPhotoKey("account-a", "pets/account-a/photo.jpg")).not.toThrow();
    expect(() => assertOwnedPhotoKey("account-a", "pets/account-b/photo.jpg")).toThrow();
    expect(() => assertOwnedPhotoKey("account-a", "pets/account-a/../account-b/photo.jpg")).toThrow();
  });

  it("rejects oversized uploads before contacting storage", async () => {
    await expect(createPetPhotoUpload("account-a", "image/jpeg", 25_000_001)).rejects.toMatchObject({
      statusCode: 413,
      code: "PHOTO_TOO_LARGE"
    });
  });
});
