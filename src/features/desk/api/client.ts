import { apiRequest } from "@/lib/morrow-api";
import type {
  ArchiveDossier,
  OrderSummary,
  PurchaseIntentSummary,
  ScanRecord,
} from "./types";

export async function listArchive(
  accessToken: string,
): Promise<ArchiveDossier[]> {
  const response = await apiRequest<{ dossiers: ArchiveDossier[] }>(
    "/archive",
    {},
    accessToken,
  );
  return response.dossiers;
}

export function repeatArchiveInspection(
  accessToken: string,
  input: {
    scanId: string;
    action: "reorder" | "prepare_approval";
    quantity: number;
    maxBudgetMinor?: number;
    currency?: string;
  },
): Promise<{ scanId: string; status: ScanRecord["status"] }> {
  return apiRequest(
    `/archive/${input.scanId}/repeat`,
    {
      method: "POST",
      body: JSON.stringify({
        action: input.action,
        quantity: input.quantity,
        ...(input.maxBudgetMinor === undefined
          ? {}
          : { maxBudgetMinor: input.maxBudgetMinor }),
        ...(input.currency === undefined ? {} : { currency: input.currency }),
      }),
    },
    accessToken,
  );
}

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
