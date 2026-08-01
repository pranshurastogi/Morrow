import { hasApiConfiguration, publicEnvironment } from "@/config/public-env";
import type {
  Candidate,
  EmbeddedPaymentSession,
  Offer,
  PublicPaymentResult,
  ScanRecord,
} from "./types";

export class ApiError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(input: { code: string; message: string; retryable?: boolean }) {
    super(input.message);
    this.name = "ApiError";
    this.code = input.code;
    this.retryable = input.retryable ?? false;
  }
}

function accessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem("morrow_access_token");
}

function authHeaders(): HeadersInit {
  const token = accessToken();
  if (token) return { Authorization: `Bearer ${token}` };
  if (import.meta.env.DEV && publicEnvironment.developmentUserId) {
    return {
      "X-Morrow-User-Id": publicEnvironment.developmentUserId,
      "X-Morrow-User-Email": publicEnvironment.developmentUserEmail,
    };
  }
  return {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!hasApiConfiguration()) {
    throw new ApiError({
      code: "INTEGRATION_NOT_CONFIGURED",
      message:
        "Set VITE_API_BASE_URL to connect the Morrow inspection service.",
    });
  }
  const response = await fetch(`${publicEnvironment.apiBaseUrl}/v1${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as
    | T
    | { error?: { code?: string; message?: string; retryable?: boolean } }
    | null;
  if (!response.ok) {
    const providerError =
      body && typeof body === "object" && "error" in body
        ? body.error
        : undefined;
    throw new ApiError({
      code: providerError?.code ?? "REQUEST_FAILED",
      message:
        providerError?.message ?? `Request failed with HTTP ${response.status}`,
      ...(providerError?.retryable === undefined
        ? {}
        : { retryable: providerError.retryable }),
    });
  }
  return body as T;
}

export async function uploadScanImage(
  file: File,
  purpose: "product_scan" | "additional_evidence",
): Promise<string> {
  const presign = await request<{
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
  const upload = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
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
  return request("/scans", {
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
  return request(`/scans/${scanId}/images`, {
    method: "POST",
    body: JSON.stringify({ images: [{ uploadId, role }] }),
  });
}

export function getScan(scanId: string): Promise<ScanRecord> {
  return request(`/scans/${scanId}`);
}

export function getCandidates(
  scanId: string,
): Promise<{ candidates: Candidate[] }> {
  return request(`/scans/${scanId}/candidates`);
}

export function getOffers(
  scanId: string,
  productId: string,
): Promise<{ offers: Offer[] }> {
  return request(
    `/products/${productId}/offers?${new URLSearchParams({ scanId })}`,
  );
}

export async function watchScan(
  scanId: string,
  signal: AbortSignal,
  onScan: (scan: ScanRecord) => void,
): Promise<void> {
  if (!hasApiConfiguration())
    throw new ApiError({
      code: "INTEGRATION_NOT_CONFIGURED",
      message: "The API is not configured.",
    });
  const response = await fetch(
    `${publicEnvironment.apiBaseUrl}/v1/scans/${scanId}/events`,
    {
      headers: { ...authHeaders(), Accept: "text/event-stream" },
      signal,
    },
  );
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
  return request<{ id: string }>("/purchase-intents", {
    method: "POST",
    body: JSON.stringify({ ...input, quantity: 1 }),
  });
}

export function approvePurchaseIntent(intentId: string) {
  return request(`/purchase-intents/${intentId}/approve`, { method: "POST" });
}

export function createPaymentSession(
  intentId: string,
): Promise<EmbeddedPaymentSession> {
  return request(`/purchase-intents/${intentId}/payment-session`, {
    method: "POST",
  });
}

export function getPaymentStatus(
  paymentSessionId: string,
): Promise<PublicPaymentResult> {
  return request(`/payments/${paymentSessionId}/status`);
}
