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
