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

export interface ArchiveDossier {
  scanId: string;
  status: ScanRecord["status"];
  mode: "exact" | "similar_allowed";
  quantity: number;
  maxBudgetMinor: number | null;
  currency: string | null;
  observation: ScanRecord["observation"];
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string | null;
    category: string | null;
    brand: string | null;
    name: string | null;
    variant: string | null;
    size: { value: number; unit: string } | null;
    gtin: string | null;
    modelNumber: string | null;
    partNumber: string | null;
    imageUrl: string | null;
    sourceProvider: string | null;
    sourceMerchantDomain: string | null;
  };
  verification: {
    classification: string | null;
    identityScore: number | null;
    matchedEvidence: Array<{
      field?: string;
      observed?: string;
      candidate?: string;
      weight?: number;
    }>;
    contradictions: Array<{
      field?: string;
      observed?: string;
      candidate?: string;
      fatal?: boolean;
    }>;
    evidenceTypes: string[];
    evidenceCount: number;
    userConfirmed: boolean;
  };
  latestRequest: {
    id: string;
    status: string;
    maxAuthorizedAmountMinor: number;
    currency: string;
    expiresAt: string;
    createdAt: string;
  } | null;
  latestOrder: {
    id: string;
    merchantOrderId: string | null;
    merchantName: string;
    status: string;
    quantity: number;
    totalMinor: number;
    currency: string;
    createdAt: string;
  } | null;
  repeatEligibility: {
    allowed: boolean;
    reason: string;
  };
}
