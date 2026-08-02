export type ScanStatus =
  | "CREATED"
  | "IMAGE_UPLOADED"
  | "PREPROCESSING"
  | "EVIDENCE_EXTRACTED"
  | "REQUIRES_MORE_EVIDENCE"
  | "CANDIDATES_RETRIEVED"
  | "VERIFYING"
  | "EXACT_VERIFIED"
  | "SIMILAR_FOUND"
  | "AMBIGUOUS"
  | "SEARCHING_MERCHANTS"
  | "OFFERS_READY"
  | "AWAITING_APPROVAL"
  | "PAYMENT_SESSION_CREATED"
  | "CHECKOUT_IN_PROGRESS"
  | "ORDER_COMPLETED"
  | "CHECKOUT_FAILED";

export interface ScanRecord {
  id: string;
  sourceScanId?: string | null;
  initiationSource?: "capture" | "archive_repeat";
  status: ScanStatus;
  mode: "exact" | "similar_allowed";
  quantity: number;
  maxBudgetMinor: number | null;
  currency: string | null;
  selectedProductId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  nextCapture: {
    captureType:
      | "barcode"
      | "back_label"
      | "model_number"
      | "connector"
      | "underside"
      | "full_object"
      | "measurement";
    title: string;
    message: string;
  } | null;
  observation: {
    category: string;
    brand: string | null;
    productName: string | null;
    modelNumber: string | null;
    partNumber: string | null;
    variant: string | null;
    size: { value: number; unit: string } | null;
    visibleIdentifiers: Array<{
      type: string;
      value: string;
      evidenceBasis: string;
    }>;
  } | null;
  createdAt: string;
  updatedAt: string;
  evidence?: Array<{
    id: string;
    evidence_type: string;
    value: unknown;
    source: string;
    confidence: number | null;
  }>;
}

export interface Candidate {
  id: string;
  brand: string | null;
  name: string;
  variant: string | null;
  size_value: number | null;
  size_unit: string | null;
  gtin: string | null;
  model_number: string | null;
  mpn: string | null;
  image_url: string | null;
  source_provider: string | null;
  source_merchant_domain: string | null;
  identity_score: number;
  classification:
    "exact_verified" | "likely_exact" | "similar" | "incompatible" | "rejected";
  matched_evidence: Array<{
    field: string;
    observed: string;
    candidate: string;
    weight: number;
  }>;
  contradictions: Array<{
    field: string;
    observed: string;
    candidate: string;
    fatal: boolean;
  }>;
}

export interface Offer {
  id: string;
  provider: "prava_ucp" | "shopify_ucp" | "manual" | "illustrative";
  merchant: {
    id: string;
    name: string;
    url: string;
    countryCode: string;
    trustScore: number | null;
    authorizedSeller: boolean | null;
  };
  product: {
    externalProductId: string;
    externalVariantId: string;
    title: string;
    imageUrl: string | null;
    attributes: Record<string, string>;
  };
  price: {
    subtotalMinor: number;
    shippingMinor: number | null;
    taxMinor: number | null;
    estimatedTotalMinor: number;
    currency: string;
    isBinding: boolean;
  };
  inventory: { status: "in_stock" | "limited" | "out_of_stock" | "unknown" };
  delivery: { earliest: string | null; latest: string | null } | null;
  returns: { days: number | null; freeReturns: boolean | null } | null;
  identityVerification: {
    status: "verified" | "likely" | "rejected";
    score: number;
    contradictions: string[];
  };
  illustrative: boolean;
  rankingScore: number;
  rankingReasons: string[];
  rejectedReasons: string[];
  expiresAt: string;
}

export interface CheckoutCapability {
  available: boolean;
  message: string | null;
  sandboxApprovalAvailable: boolean;
}

export interface PravaCollectionSession {
  sessionToken: string;
  iframeUrl: string;
  expiresAt: string;
}

export interface PravaBrowserCapabilities {
  secureContext: boolean;
  webAuthnAvailable: boolean;
  platformAuthenticatorAvailable: boolean | null;
}

export interface PravaClientIssue {
  event: "SDK_ERROR" | "SDK_DISMISSED" | "SESSION_REFRESH_FAILED";
  code: string;
  message: string;
  responseId: string | null;
  occurredAt: string;
  timezone: string;
  origin: string;
  capabilities: PravaBrowserCapabilities;
}

export interface EmbeddedPaymentSession extends PravaCollectionSession {
  paymentSessionId: string;
  providerSessionId: string;
}

export interface SandboxApprovalSession extends PravaCollectionSession {
  sandboxCheckId: string;
  providerOrderId: string;
}

export interface SandboxApprovalResult {
  status: "pending" | "verified" | "failed" | "expired";
  providerOrderId: string;
  orderPlaced: false;
  providerStatus: "pending" | "awaiting_result" | "completed" | "failed";
  milestones: {
    sessionCreated: true;
    cardAndPasskeyApproved: boolean;
    credentialIssued: boolean;
    merchantCheckout: "not_attempted";
    providerClosed: boolean;
  };
  message: string;
}

export interface PublicPaymentResult {
  sessionId: string;
  orderId: string | null;
  status: "pending" | "awaiting_result" | "completed" | "failed";
  providerStatus: "pending" | "awaiting_result" | "completed" | "failed";
  transactions: Array<{
    transactionId: string;
    status: string;
    lineItems: Array<{
      transactionReferenceId: string;
      merchantName?: string | null;
      totalAmount: string;
      status: string;
    }>;
  }>;
  checkoutStatus:
    | "PENDING"
    | "AWAITING_RESULT"
    | "CHECKOUT_IN_PROGRESS"
    | "COMPLETED"
    | "FAILED"
    | "EXPIRED"
    | "REVOKED";
  checkoutIssue: { code: string; message: string } | null;
}
