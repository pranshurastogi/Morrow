import { describe, expect, test } from "bun:test";
import {
  extractCheckoutCredential,
  parsePravaPaymentResult,
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

describe("Prava payment-result compatibility", () => {
  test("keeps Prava's internal processing state safely pending", () => {
    const result = parsePravaPaymentResult({
      session_id: "sess_processing",
      order_id: "ord_processing",
      status: "processing",
      transactions: [
        {
          txn_id: "txn_processing",
          status: "initiated",
          line_items: [
            {
              txn_ref_id: "line_processing",
              total_amount: "499.00",
              status: "pending",
              products: [],
            },
          ],
        },
      ],
    });

    expect(result.status).toBe("pending");
    expect(result.providerStatus).toBe("processing");
    expect(extractCheckoutCredential(result)).toBeNull();
  });

  test("uses complete credential material instead of provider display labels", () => {
    const result = parsePravaPaymentResult({
      session_id: "sess_ready",
      order_id: "ord_ready",
      status: "creds_generated",
      transactions: [
        {
          txn_id: "txn_ready",
          status: "initiated",
          line_items: [
            {
              txn_ref_id: "line_ready",
              total_amount: "499.00",
              status: "credential_ready",
              token: "network-token",
              dynamic_cvv: "123",
              expiry_month: "12",
              expiry_year: "2030",
              products: [],
            },
          ],
        },
      ],
    });

    expect(result.status).toBe("awaiting_result");
    expect(extractCheckoutCredential(result)).toEqual({
      transactionReferenceId: "line_ready",
      token: "network-token",
      dynamicCvv: "123",
      expiryMonth: "12",
      expiryYear: "2030",
      totalAmount: "499.00",
    });
  });

  test("turns malformed provider payloads into a retryable upstream error", () => {
    expect(() => parsePravaPaymentResult({ status: "processing" })).toThrow(
      "Prava returned an unreadable payment result.",
    );
  });
});
