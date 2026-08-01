import {
  ApiError,
  apiAuthHeaders,
  apiEndpoint,
  apiRequest,
} from "@/lib/morrow-api";
import type {
  Candidate,
  CheckoutCapability,
  EmbeddedPaymentSession,
  Offer,
  PravaClientIssue,
  PublicPaymentResult,
  SandboxApprovalResult,
  SandboxApprovalSession,
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

export function retryScan(scanId: string) {
  return apiRequest<{ scanId: string; status: ScanRecord["status"] }>(
    `/scans/${scanId}/retry`,
    { method: "POST" },
  );
}

export function getCandidates(
  scanId: string,
): Promise<{ candidates: Candidate[] }> {
  return apiRequest(`/scans/${scanId}/candidates`);
}

export function confirmProduct(scanId: string, productId: string) {
  return apiRequest<{ scanId: string; status: ScanRecord["status"] }>(
    `/scans/${scanId}/confirm-product`,
    {
      method: "POST",
      body: JSON.stringify({ productId }),
    },
  );
}

export function getOffers(
  scanId: string,
  productId: string,
): Promise<{ offers: Offer[]; checkout: CheckoutCapability }> {
  return apiRequest(
    `/products/${productId}/offers?${new URLSearchParams({ scanId })}`,
  );
}

const settledScanStatuses = new Set<ScanRecord["status"]>([
  "REQUIRES_MORE_EVIDENCE",
  "SIMILAR_FOUND",
  "AMBIGUOUS",
  "OFFERS_READY",
  "ORDER_COMPLETED",
  "CHECKOUT_FAILED",
]);

export function isSettledScan(scan: ScanRecord): boolean {
  return (
    settledScanStatuses.has(scan.status) ||
    (scan.errorCode !== null && scan.status !== "OFFERS_READY")
  );
}

function waitForNextPoll(signal: AbortSignal, milliseconds = 1_500) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function pollScan(
  scanId: string,
  signal: AbortSignal,
  onScan: (scan: ScanRecord) => void,
): Promise<void> {
  let lastVersion = "";
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (signal.aborted)
      throw signal.reason ?? new DOMException("Aborted", "AbortError");
    const scan = await getScan(scanId);
    const version = `${scan.updatedAt}:${scan.status}:${scan.errorCode ?? ""}`;
    if (version !== lastVersion) {
      onScan(scan);
      lastVersion = version;
    }
    if (isSettledScan(scan)) return;
    await waitForNextPoll(signal);
  }
  throw new ApiError({
    code: "INSPECTION_TIMEOUT",
    message: "The inspection is taking longer than expected.",
    retryable: true,
  });
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
    return pollScan(scanId, signal, onScan);
  }
  if (!response.ok || !response.body) {
    return pollScan(scanId, signal, onScan);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let latestScan: ScanRecord | null = null;
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
      if (data) {
        latestScan = JSON.parse(data) as ScanRecord;
        onScan(latestScan);
      }
    }
  }
  if (latestScan && isSettledScan(latestScan)) return;
  return pollScan(scanId, signal, onScan);
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

export function createSandboxApprovalCheck(input: {
  scanId: string;
  productId: string;
  offerId: string;
}): Promise<SandboxApprovalSession> {
  return apiRequest("/sandbox-approval-checks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getSandboxApprovalStatus(
  sandboxCheckId: string,
): Promise<SandboxApprovalResult> {
  return apiRequest(`/sandbox-approval-checks/${sandboxCheckId}`);
}

export function recordSandboxApprovalClientIssue(
  sandboxCheckId: string,
  issue: PravaClientIssue,
): Promise<{ recorded: true }> {
  return apiRequest(
    `/sandbox-approval-checks/${sandboxCheckId}/client-events`,
    {
      method: "POST",
      body: JSON.stringify(issue),
    },
  );
}

export { ApiError };
