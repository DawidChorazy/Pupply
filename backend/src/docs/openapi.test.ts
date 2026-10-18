import SwaggerParser from "@apidevtools/swagger-parser";
import { describe, expect, it } from "vitest";

import { openApiSpec } from "./openapi";

describe("OpenAPI contract", () => {
  it("is a valid OpenAPI document", async () => {
    const parsed = await SwaggerParser.validate(openApiSpec as unknown as string);
    expect((parsed as unknown as { openapi: string }).openapi).toBe("3.0.3");
  });
});
