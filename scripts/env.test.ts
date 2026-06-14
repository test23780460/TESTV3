import { describe, expect, it } from "vitest";
import { providerStatus, redact } from "./env";

describe("server env helpers", () => {
  it("reports provider key presence without returning secret values", () => {
    const status = providerStatus({ ALPHA_VANTAGE_API_KEY: "secret-value-1234567890" });
    expect(status.find((item) => item.provider === "alpha_vantage")?.configured).toBe(true);
  });
  it("redacts long token-like values", () => {
    expect(redact("token abcdefghijklmnopqrstuvwxyz123456")).toContain("[redacted]");
  });
});
