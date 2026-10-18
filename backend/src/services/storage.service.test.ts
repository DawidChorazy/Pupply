import { describe, expect, it } from "vitest";

import { assertOwnedPhotoKey, createPetPhotoUpload, createSitterPhotoUpload } from "./storage.service";

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

  it("keeps sitter photo ownership separate from pet uploads and other accounts", () => {
    expect(() => assertOwnedPhotoKey("account-a", "sitters/account-a/photo.jpg", "sitters")).not.toThrow();
    expect(() => assertOwnedPhotoKey("account-a", "pets/account-a/photo.jpg", "sitters")).toThrow();
    expect(() => assertOwnedPhotoKey("account-a", "sitters/account-b/photo.jpg", "sitters")).toThrow();
    expect(() => assertOwnedPhotoKey("account-a", "sitters/account-a/../photo.jpg", "sitters")).toThrow();
  });

  it("rejects oversized sitter images and unsupported formats", async () => {
    await expect(createSitterPhotoUpload("account-a", "image/jpeg", 25_000_001)).rejects.toMatchObject({ statusCode: 413 });
    await expect(createSitterPhotoUpload("account-a", "text/html", 100)).rejects.toMatchObject({ statusCode: 400 });
  });
});
