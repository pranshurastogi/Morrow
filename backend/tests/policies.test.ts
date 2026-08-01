import { describe, expect, test } from "bun:test";
import { MorrowError } from "../src/common/errors";
import {
  decimalToMinorUnits,
  minorUnitsToDecimal,
  validateFinalTotal,
} from "../src/common/money";
import { redactSensitive } from "../src/common/redaction";
import { reconcilePublicPaymentState } from "../src/modules/payments/payment-status-policy";
import {
  assertScanTransition,
  canTransitionScan,
} from "../src/domain/scan-status";
import {
  normalizeBarcode,
  normalizeIdentifier,
  sizesEquivalent,
} from "../src/modules/recognition/normalization";

describe("deterministic policies", () => {
  test("normalizes identifiers without inventing barcode digits", () => {
    expect(normalizeIdentifier("Model No. HP-67XL")).toBe("HP67XL");
    expect(normalizeBarcode("3337 8755 9719 7")).toBe("3337875597197");
    expect(normalizeBarcode("12345")).toBeNull();
  });

  test("normalizes equivalent package measures", () => {
    expect(
      sizesEquivalent({ value: 0.473, unit: "l" }, { value: 473, unit: "ml" }),
    ).toBeTrue();
    expect(
      sizesEquivalent({ value: 236, unit: "ml" }, { value: 473, unit: "ml" }),
    ).toBeFalse();
  });

  test("uses integer minor units and rejects authority overruns", () => {
    expect(decimalToMinorUnits("19.49")).toBe(1949);
    expect(minorUnitsToDecimal(1949)).toBe("19.49");
    expect(() =>
      validateFinalTotal({
        quotedTotalMinor: 1899,
        finalTotalMinor: 2099,
        authorizedMaximumMinor: 2000,
      }),
    ).toThrow(MorrowError);
  });

  test("enforces the scan state machine", () => {
    expect(canTransitionScan("IMAGE_UPLOADED", "PREPROCESSING")).toBeTrue();
    expect(() =>
      assertScanTransition("IMAGE_UPLOADED", "ORDER_COMPLETED"),
    ).toThrow();
  });

  test("redacts nested payment material", () => {
    expect(
      redactSensitive({
        authorization: "Bearer secret",
        nested: { token: "4111", safe: "kept" },
      }),
    ).toEqual({
      authorization: "[REDACTED]",
      nested: { token: "[REDACTED]", safe: "kept" },
    });
  });

  test("does not expose provider completion before the merchant order commits", () => {
    expect(
      reconcilePublicPaymentState("completed", "CHECKOUT_IN_PROGRESS"),
    ).toBe("awaiting_result");
    expect(reconcilePublicPaymentState("completed", "COMPLETED")).toBe(
      "completed",
    );
  });
});
