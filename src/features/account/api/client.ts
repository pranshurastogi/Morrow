import { apiRequest } from "@/lib/morrow-api";
import type {
  AddressInput,
  AiUsageSummary,
  PravaCardSummary,
  UserAddress,
} from "./types";

export function getAiUsage(): Promise<AiUsageSummary> {
  return apiRequest("/account/ai-usage");
}

export async function listAddresses(): Promise<UserAddress[]> {
  const response = await apiRequest<{ addresses: UserAddress[] }>(
    "/account/addresses",
  );
  return response.addresses;
}

export function createAddress(input: AddressInput): Promise<UserAddress> {
  return apiRequest("/account/addresses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAddress(
  addressId: string,
  input: AddressInput,
): Promise<UserAddress> {
  return apiRequest(`/account/addresses/${addressId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function setDefaultAddress(addressId: string): Promise<UserAddress> {
  return apiRequest(`/account/addresses/${addressId}/default`, {
    method: "POST",
  });
}

export function deleteAddress(addressId: string): Promise<void> {
  return apiRequest(`/account/addresses/${addressId}`, { method: "DELETE" });
}

export async function listCards(): Promise<PravaCardSummary[]> {
  const response = await apiRequest<{ cards: PravaCardSummary[] }>(
    "/account/cards",
  );
  return response.cards;
}

export function deleteCard(cardId: string): Promise<{
  success: boolean;
  wasDefault: boolean;
  networkTokenDeleted: boolean;
}> {
  return apiRequest(`/account/cards/${encodeURIComponent(cardId)}`, {
    method: "DELETE",
  });
}
