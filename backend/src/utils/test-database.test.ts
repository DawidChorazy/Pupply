import { describe, expect, it } from "vitest";
import { assertTestDatabase } from "./test-database";

describe("destructive test guard", () => {
  it("rejects development databases, missing URLs and production mode", () => {
    for (const url of [undefined, "invalid", "postgresql://localhost/pupply", "postgresql://localhost/latest", "postgresql://localhost/pupply_test_backup_prod"]) {
      expect(() => assertTestDatabase(url, "test")).toThrow();
    }
    expect(() => assertTestDatabase("postgresql://localhost/pupply_test", "production")).toThrow();
    expect(() => assertTestDatabase("postgresql://localhost/pupply_test", "test")).not.toThrow();
  });
});
