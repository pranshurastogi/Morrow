export interface AddressInput {
  label: string;
  recipientName: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  phone: string;
  isDefault: boolean;
}

export interface UserAddress extends AddressInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface PravaCardSummary {
  id: string;
  last4: string;
  brand: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  status: "active" | "deleted";
  createdAt: string;
}

export interface AiUsageModelSummary {
  model: string;
  requests: number;
  costMicroUsd: number;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
}

export interface AiUsageSummary {
  period: "lifetime";
  limitMicroUsd: number;
  usedMicroUsd: number;
  reservedMicroUsd: number;
  remainingMicroUsd: number;
  requests: number;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  canStartInspection: boolean;
  primaryModel: string;
  escalationModel: string;
  embeddingModel: string;
  pricingVersion: string;
  pricingSource: string;
  models: AiUsageModelSummary[];
}
