import { apiRequest } from "@/lib/morrow-api";
import type { OrderSummary, PurchaseIntentSummary, ScanRecord } from "./types";

export async function listScans(accessToken: string): Promise<ScanRecord[]> {
  const response = await apiRequest<{ scans: ScanRecord[] }>(
    "/scans",
    {},
    accessToken,
  );
  return response.scans;
}

export async function listPurchaseIntents(
  accessToken: string,
): Promise<PurchaseIntentSummary[]> {
  const response = await apiRequest<{
    purchaseIntents: PurchaseIntentSummary[];
  }>("/purchase-intents", {}, accessToken);
  return response.purchaseIntents;
}

export async function listOrders(accessToken: string): Promise<OrderSummary[]> {
  const response = await apiRequest<{ orders: OrderSummary[] }>(
    "/orders",
    {},
    accessToken,
  );
  return response.orders;
}
