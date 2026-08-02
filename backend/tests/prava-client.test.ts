import { describe, expect, test } from "bun:test";
import {
  PravaApiError,
  shouldRetryPravaSessionCreation,
} from "../src/integrations/prava/client";

describe("Prava session creation recovery", () => {
  test("retries one explicit provider infrastructure failure", () => {
    const error = new PravaApiError(
      500,
      "Internal error",
      "INTERNAL_ERROR",
      "response-123",
    );

    expect(shouldRetryPravaSessionCreation(error, 0)).toBe(true);
    expect(shouldRetryPravaSessionCreation(error, 1)).toBe(false);
    expect(error.details).toEqual({
      providerCode: "INTERNAL_ERROR",
      responseId: "response-123",
    });
  });

  test("does not retry validation, rate-limit, or unknown network errors", () => {
    expect(
      shouldRetryPravaSessionCreation(
        new PravaApiError(400, "Invalid request", "VAL_2001", null),
        0,
      ),
    ).toBe(false);
    expect(
      shouldRetryPravaSessionCreation(
        new PravaApiError(429, "Rate limited", "RATE_LIMITED", null),
        0,
      ),
    ).toBe(false);
    expect(shouldRetryPravaSessionCreation(new Error("timeout"), 0)).toBe(
      false,
    );
  });
});
