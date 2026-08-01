import type { PravaError } from "@prava-sdk/core";
import type { PravaBrowserCapabilities, PravaClientIssue } from "../api/types";

const responseIdKeys = new Set([
  "responseid",
  "xresponseid",
  "requestid",
  "xrequestid",
]);

function normaliseKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findResponseId(
  value: unknown,
  depth = 0,
  seen = new Set<object>(),
): string | null {
  if (!value || typeof value !== "object" || depth > 3 || seen.has(value)) {
    return null;
  }
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (
      responseIdKeys.has(normaliseKey(key)) &&
      typeof child === "string" &&
      child.trim()
    ) {
      return child.trim().slice(0, 255);
    }
  }
  for (const child of Object.values(value)) {
    const nested = findResponseId(child, depth + 1, seen);
    if (nested) return nested;
  }
  return null;
}

export async function getPravaBrowserCapabilities(): Promise<PravaBrowserCapabilities> {
  const webAuthnAvailable = "PublicKeyCredential" in window;
  let platformAuthenticatorAvailable: boolean | null = null;
  if (
    webAuthnAvailable &&
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ===
      "function"
  ) {
    try {
      platformAuthenticatorAvailable =
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      platformAuthenticatorAvailable = null;
    }
  }
  return {
    secureContext: window.isSecureContext,
    webAuthnAvailable,
    platformAuthenticatorAvailable,
  };
}

function fallbackError(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    return {
      code:
        "code" in error && typeof error.code === "string"
          ? error.code
          : "SDK_ERROR",
      message: error.message,
    };
  }
  if (error && typeof error === "object") {
    const value = error as Partial<PravaError>;
    return {
      code: typeof value.code === "string" ? value.code : "SDK_ERROR",
      message:
        typeof value.message === "string"
          ? value.message
          : "Prava could not complete the secure approval.",
    };
  }
  return {
    code: "SDK_ERROR",
    message: "Prava could not complete the secure approval.",
  };
}

function sanitiseMessage(value: string): string {
  return value
    .replace(/\b(?:sk|pk)_(?:test|live)_[A-Za-z0-9_-]+\b/g, "[redacted key]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[redacted token]",
    )
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted number]");
}

export async function createPravaClientIssue(input: {
  event: PravaClientIssue["event"];
  error: unknown;
  message?: string;
}): Promise<PravaClientIssue> {
  const parsed = fallbackError(input.error);
  const details =
    input.error && typeof input.error === "object" && "details" in input.error
      ? (input.error as { details?: unknown }).details
      : null;
  return {
    event: input.event,
    code: parsed.code.replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 100),
    message: sanitiseMessage(input.message ?? parsed.message).slice(0, 400),
    responseId: findResponseId(details),
    occurredAt: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
    origin: window.location.origin,
    capabilities: await getPravaBrowserCapabilities(),
  };
}

export function isPasskeyIssue(issue: PravaClientIssue): boolean {
  const text = `${issue.code} ${issue.message}`.toLowerCase();
  return [
    "security check",
    "passkey",
    "webauthn",
    "authenticator",
    "notallowederror",
    "not allowed",
    "timed out",
    "timeout",
  ].some((needle) => text.includes(needle));
}

export function sandboxSupportDetails(input: {
  issue: PravaClientIssue;
  sandboxCheckId: string;
  providerOrderId: string;
}): string {
  const { issue } = input;
  const capability = (value: boolean | null) =>
    value === null ? "unknown" : value ? "yes" : "no";
  return [
    "Morrow / Prava sandbox approval issue",
    `Environment: sandbox`,
    `Error: ${issue.code} — ${issue.message}`,
    `Timestamp: ${issue.occurredAt}`,
    `Timezone: ${issue.timezone}`,
    `Frontend origin: ${issue.origin}`,
    `Secure context: ${capability(issue.capabilities.secureContext)}`,
    `WebAuthn available: ${capability(issue.capabilities.webAuthnAvailable)}`,
    `Platform authenticator available: ${capability(issue.capabilities.platformAuthenticatorAvailable)}`,
    `Morrow check ID: ${input.sandboxCheckId}`,
    `Prava order reference: ${input.providerOrderId}`,
    `X-Response-ID: ${issue.responseId ?? "not returned to the host page"}`,
  ].join("\n");
}
