import {
  ApiError,
  apiAuthHeaders,
  apiEndpoint,
  apiRequest,
} from "@/lib/morrow-api";
import type {
  Candidate,
  EmbeddedPaymentSession,
  Offer,
  PublicPaymentResult,
  ScanRecord,
} from "./types";

export async function uploadScanImage(
  file: File,
  purpose: "product_scan" | "additional_evidence",
): Promise<string> {
  const presign = await apiRequest<{
    uploadId: string;
    uploadUrl: string;
    maxBytes: number;
  }>("/uploads/presign", {
    method: "POST",
    body: JSON.stringify({ mimeType: file.type, purpose }),
  });
  if (file.size > presign.maxBytes) {
    throw new ApiError({
      code: "IMAGE_TOO_LARGE",
      message: "This image is larger than the upload limit.",
    });
  }
  let upload: Response;
  try {
    upload = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
  } catch {
    throw new ApiError({
      code: "UPLOAD_UNAVAILABLE",
      message:
        "The photograph could not reach Morrow's private image store. Please try again.",
      retryable: true,
    });
  }
  if (!upload.ok)
    throw new ApiError({
      code: "UPLOAD_FAILED",
      message: "The image could not be uploaded.",
    });
  return presign.uploadId;
}

export async function createScanFromFile(
  file: File,
): Promise<{ scanId: string }> {
  const uploadId = await uploadScanImage(file, "product_scan");
  return apiRequest("/scans", {
    method: "POST",
    body: JSON.stringify({
      images: [{ uploadId, role: "primary" }],
      intent: {
        mode: "exact",
        quantity: 1,
        maxBudget: { amountMinor: 200_000, currency: "INR" },
        countryCode: "IN",
      },
    }),
  });
}

export async function addEvidenceImage(
  scanId: string,
  file: File,
  role: "label" | "barcode",
) {
  const uploadId = await uploadScanImage(file, "additional_evidence");
  return apiRequest(`/scans/${scanId}/images`, {
    method: "POST",
    body: JSON.stringify({ images: [{ uploadId, role }] }),
  });
}

export function getScan(scanId: string): Promise<ScanRecord> {
  return apiRequest(`/scans/${scanId}`);
}

export function getCandidates(
  scanId: string,
): Promise<{ candidates: Candidate[] }> {
  return apiRequest(`/scans/${scanId}/candidates`);
}

export function getOffers(
  scanId: string,
  productId: string,
): Promise<{ offers: Offer[] }> {
  return apiRequest(
    `/products/${productId}/offers?${new URLSearchParams({ scanId })}`,
  );
}

export async function watchScan(
  scanId: string,
  signal: AbortSignal,
  onScan: (scan: ScanRecord) => void,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(apiEndpoint(`/scans/${scanId}/events`), {
      headers: { ...(await apiAuthHeaders()), Accept: "text/event-stream" },
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ApiError({
      code: "SERVICE_UNAVAILABLE",
      message:
        "The live inspection channel could not be reached. Please try again in a moment.",
      retryable: true,
    });
  }
  if (!response.ok || !response.body)
    throw new ApiError({
      code: "EVENT_STREAM_FAILED",
      message: "Live scan updates are unavailable.",
    });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const data = event
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6))
        .join("\n");
      if (data) onScan(JSON.parse(data) as ScanRecord);
    }
  }
}

export function createPurchaseIntent(input: {
  scanId: string;
  productId: string;
  offerId: string;
  maximumAuthorizedTotalMinor: number;
  currency: string;
}) {
  return apiRequest<{ id: string }>("/purchase-intents", {
    method: "POST",
    body: JSON.stringify({ ...input, quantity: 1 }),
  });
}

export function approvePurchaseIntent(intentId: string) {
  return apiRequest(`/purchase-intents/${intentId}/approve`, {
    method: "POST",
  });
}

export function createPaymentSession(
  intentId: string,
): Promise<EmbeddedPaymentSession> {
  return apiRequest(`/purchase-intents/${intentId}/payment-session`, {
    method: "POST",
  });
}

export function getPaymentStatus(
  paymentSessionId: string,
): Promise<PublicPaymentResult> {
  return apiRequest(`/payments/${paymentSessionId}/status`);
}

export { ApiError };
