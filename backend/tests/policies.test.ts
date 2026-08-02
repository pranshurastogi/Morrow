import { describe, expect, test } from "bun:test";
import { MorrowError } from "../src/common/errors";
import {
  decimalToMinorUnits,
  minorUnitsToDecimal,
  validateFinalTotal,
} from "../src/common/money";
import { redactSensitive } from "../src/common/redaction";
import {
  reconcilePublicPaymentState,
  shouldExpirePendingPayment,
} from "../src/modules/payments/payment-status-policy";
import {
  assertScanTransition,
  canTransitionScan,
} from "../src/domain/scan-status";
import {
  normalizeBarcode,
  normalizeIdentifier,
  sizesEquivalent,
} from "../src/modules/recognition/normalization";
import { assertCandidateMayBeConfirmed } from "../src/modules/matching/confirmation-policy";
import { isCheckoutExecutorConfigured } from "../src/infrastructure/runtime/checkout-capability";
import { isPravaSandboxConfigured } from "../src/integrations/prava/environment";
import type { ProductObservation } from "../src/domain/product-observation";
import { determineNextCapture } from "../src/modules/matching/capture-policy";

const genericObservation: ProductObservation = {
  category: "computer_accessory",
  subcategory: "wireless_mouse",
  brand: null,
  productName: "wireless computer mouse",
  modelNumber: null,
  partNumber: null,
  variant: null,
  size: null,
  colors: ["black"],
  materials: ["plastic"],
  visibleIdentifiers: [],
  distinctiveFeatures: ["central scroll wheel"],
  visualSearchTerms: ["black wireless computer mouse"],
  claims: [],
  visualFingerprint: "black shell with central wheel",
  exactIdentificationPossible: false,
  missingEvidence: ["brand", "model number"],
  suggestedNextCapture: "underside",
};

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
    expect(
      canTransitionScan("SIMILAR_FOUND", "SEARCHING_MERCHANTS"),
    ).toBeTrue();
    expect(() =>
      assertScanTransition("IMAGE_UPLOADED", "ORDER_COMPLETED"),
    ).toThrow();
  });

  test("requires a non-contradictory explicit candidate choice", () => {
    expect(() =>
      assertCandidateMayBeConfirmed({
        scanStatus: "SIMILAR_FOUND",
        classification: "likely_exact",
        contradictions: [],
      }),
    ).not.toThrow();
    expect(() =>
      assertCandidateMayBeConfirmed({
        scanStatus: "AMBIGUOUS",
        classification: "similar",
        contradictions: [{ fatal: true }],
      }),
    ).toThrow(MorrowError);
  });

  test("redacts nested payment material", () => {
    expect(
      redactSensitive({
        authorization: "Bearer secret",
        nested: { token: "4111", phone: "+91 99999 99999", safe: "kept" },
      }),
    ).toEqual({
      authorization: "[REDACTED]",
      nested: { token: "[REDACTED]", phone: "[REDACTED]", safe: "kept" },
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

  test("expires only an unapproved pending Prava session", () => {
    const now = new Date("2026-08-02T12:00:00.000Z");
    expect(
      shouldExpirePendingPayment({
        providerStatus: "pending",
        localStatus: "PENDING",
        expiresAt: "2026-08-02T11:59:59.000Z",
        now,
      }),
    ).toBeTrue();
    expect(
      shouldExpirePendingPayment({
        providerStatus: "awaiting_result",
        localStatus: "AWAITING_RESULT",
        expiresAt: "2026-08-02T11:59:59.000Z",
        now,
      }),
    ).toBeFalse();
  });

  test("requires both halves of the restricted checkout executor", () => {
    expect(
      isCheckoutExecutorConfigured({
        MERCHANT_CHECKOUT_EXECUTOR_URL: "https://executor.example.com",
        MERCHANT_CHECKOUT_EXECUTOR_SECRET: "secret",
      }),
    ).toBeTrue();
    expect(
      isCheckoutExecutorConfigured({
        MERCHANT_CHECKOUT_EXECUTOR_URL: "https://executor.example.com",
        MERCHANT_CHECKOUT_EXECUTOR_SECRET: undefined,
      }),
    ).toBeFalse();
  });

  test("offers the sandbox approval path only for the exact sandbox host and test key", () => {
    expect(
      isPravaSandboxConfigured({
        PRAVA_API_URL: "https://sandbox.api.prava.space",
        PRAVA_SECRET_KEY: "sk_test_example",
      }),
    ).toBeTrue();
    expect(
      isPravaSandboxConfigured({
        PRAVA_API_URL: "https://api.prava.space",
        PRAVA_SECRET_KEY: "sk_live_example",
      }),
    ).toBeFalse();
  });

  test("preserves the observer's useful view for an object without a barcode", () => {
    expect(determineNextCapture(genericObservation)).toMatchObject({
      captureType: "underside",
      title: "Show the underside",
    });
  });

  test("asks packaged goods for a barcode when no better view was observed", () => {
    expect(
      determineNextCapture({
        ...genericObservation,
        category: "skincare",
        suggestedNextCapture: "none",
      }),
    ).toMatchObject({ captureType: "barcode" });
  });
});
