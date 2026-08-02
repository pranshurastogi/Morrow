export const MORROW_ERROR_CODES = [
  "INVALID_REQUEST",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "INTEGRATION_NOT_CONFIGURED",
  "IMAGE_TOO_LARGE",
  "IMAGE_TOO_BLURRY",
  "NO_PRODUCT_DETECTED",
  "BARCODE_UNREADABLE",
  "AI_BUDGET_EXCEEDED",
  "MORE_EVIDENCE_REQUIRED",
  "PRODUCT_AMBIGUOUS",
  "PRODUCT_NOT_AVAILABLE",
  "COMPATIBILITY_UNVERIFIED",
  "DELIVERY_ADDRESS_REQUIRED",
  "OFFER_EXPIRED",
  "FINAL_TOTAL_CHANGED",
  "FINAL_TOTAL_EXCEEDS_LIMIT",
  "PAYMENT_SESSION_EXPIRED",
  "PAYMENT_DECLINED",
  "CHECKOUT_RESULT_UNKNOWN",
  "MERCHANT_ORDER_FAILED",
  "UPSTREAM_UNAVAILABLE",
  "INTERNAL_ERROR",
] as const;

export type MorrowErrorCode = (typeof MORROW_ERROR_CODES)[number];

export class MorrowError extends Error {
  readonly code: MorrowErrorCode;
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly details: Record<string, unknown> | undefined;

  constructor(input: {
    code: MorrowErrorCode;
    message: string;
    statusCode?: number;
    retryable?: boolean;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(input.message, { cause: input.cause });
    this.name = "MorrowError";
    this.code = input.code;
    this.statusCode = input.statusCode ?? 400;
    this.retryable = input.retryable ?? false;
    this.details = input.details;
  }
}

export function toMorrowError(error: unknown): MorrowError {
  if (error instanceof MorrowError) return error;
  return new MorrowError({
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
    statusCode: 500,
    cause: error,
  });
}
