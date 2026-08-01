import type { ScanRecord } from "@/features/scan/api/types";

export type { ScanRecord };

export interface PurchaseIntentSummary {
  id: string;
  scanId: string;
  canonicalProductId: string;
  selectedOfferId: string;
  quantity: number;
  maxAuthorizedAmountMinor: number;
  currency: string;
  status:
    | "DRAFT"
    | "APPROVED"
    | "PAYMENT_SESSION_CREATED"
    | "CHECKOUT_IN_PROGRESS"
    | "COMPLETED"
    | "FAILED"
    | "EXPIRED";
  expiresAt: string;
  productSnapshot: Record<string, unknown>;
  offerSnapshot: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OrderSummary {
  id: string;
  merchantOrderId: string | null;
  merchantName: string;
  quantity: number;
  totalMinor: number;
  currency: string;
  status:
    | "CREATED"
    | "PAYMENT_APPROVED"
    | "MERCHANT_CONFIRMED"
    | "PROCESSING"
    | "SHIPPED"
    | "DELIVERED"
    | "RETURN_REQUESTED"
    | "RETURNED"
    | "REFUNDED"
    | "FAILED";
  deliveryEstimate: Record<string, unknown> | null;
  tracking: Record<string, unknown> | null;
  returnDeadline: string | null;
  productSnapshot: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
