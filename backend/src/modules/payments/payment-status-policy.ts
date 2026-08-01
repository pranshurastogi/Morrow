import type { PravaPaymentResult } from "../../integrations/prava/client";
import type { PaymentSessionRecord } from "./payment-repository";

export type PublicPaymentState = PravaPaymentResult["status"];

/**
 * A provider completion is necessary but not sufficient. The public state can
 * become completed only after the worker has persisted the verified merchant
 * order and atomically marked the local payment session complete.
 */
export function reconcilePublicPaymentState(
  providerStatus: PravaPaymentResult["status"],
  localStatus: PaymentSessionRecord["status"],
): PublicPaymentState {
  if (localStatus === "COMPLETED") return "completed";
  if (["FAILED", "EXPIRED", "REVOKED"].includes(localStatus)) return "failed";
  if (providerStatus === "pending") return "pending";
  return "awaiting_result";
}

export function shouldExpirePendingPayment(input: {
  providerStatus: PravaPaymentResult["status"];
  localStatus: PaymentSessionRecord["status"];
  expiresAt: string | null;
  now?: Date;
}): boolean {
  if (
    input.providerStatus !== "pending" ||
    input.localStatus !== "PENDING" ||
    !input.expiresAt
  ) {
    return false;
  }
  const expiresAt = new Date(input.expiresAt).getTime();
  if (!Number.isFinite(expiresAt)) return false;
  return expiresAt <= (input.now ?? new Date()).getTime();
}
