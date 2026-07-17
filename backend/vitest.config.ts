import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      AUTH_RATE_LIMIT_MAX: "1000"
    },
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
    coverage: { reporter: ["text", "json-summary"] }
  }
});
