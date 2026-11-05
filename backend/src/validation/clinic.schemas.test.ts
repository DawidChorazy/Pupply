import { describe, expect, it } from "vitest";
import { nipSchema, reviewClinicVerificationSchema } from "./clinic.schemas";
import { isValidNip } from "../utils/nip";

describe("clinic verification input", () => {
  it("checks the NIP checksum and normalizes only spaces and hyphens", () => {
    expect(nipSchema.parse(" 123-456-32-18 ")).toBe("1234563218");
    for (const nip of ["1234567890", "1234563219", "0000000000", "1111111111", "123456321", "12345632180", "PL1234563218", "abcdefghij"]) {
      expect(isValidNip(nip)).toBe(false);
      expect(nipSchema.safeParse(nip).success).toBe(false);
    }
  });
  it("requires explicit registry and representative checks plus a source for approval", () => {
    const approval = { decision: "APPROVE", expectedVersion: 1, reason: "Dane potwierdzone",
      registryConfirmed: true, representativeConfirmed: true, evidenceUrl: "https://wetsystems.org.pl/WetSystemsInfo/zinfo.html" };
    expect(reviewClinicVerificationSchema.safeParse(approval).success).toBe(true);
    for (const patch of [{ registryConfirmed: false }, { representativeConfirmed: false },
      { evidenceUrl: "http://example.com" }, { evidenceUrl: undefined }, { expectedVersion: -1 }, { reason: " " }]) {
      expect(reviewClinicVerificationSchema.safeParse({ ...approval, ...patch }).success).toBe(false);
    }
    expect(reviewClinicVerificationSchema.safeParse({ decision: "REJECT", expectedVersion: 1, reason: "Brak wpisu" }).success).toBe(true);
  });
});
