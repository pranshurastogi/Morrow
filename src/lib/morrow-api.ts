import { hasApiConfiguration, publicEnvironment } from "@/config/public-env";
import { getAccessToken } from "@/features/auth/access-token";

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

export function apiEndpoint(path: string): string {
  if (!hasApiConfiguration()) {
    throw new ApiError({
      code: "INTEGRATION_NOT_CONFIGURED",
      message: "The Morrow inspection service is not configured.",
    });
  }

  return `${publicEnvironment.apiBaseUrl}/v1${path}`;
}

export async function apiAuthHeaders(
  explicitAccessToken?: string,
): Promise<Record<string, string>> {
  const token = explicitAccessToken ?? (await getAccessToken());
  if (token) return { Authorization: `Bearer ${token}` };

  if (import.meta.env.DEV && publicEnvironment.developmentUserId) {
    return {
      "X-Morrow-User-Id": publicEnvironment.developmentUserId,
      "X-Morrow-User-Email": publicEnvironment.developmentUserEmail,
    };
  }

  return {};
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  explicitAccessToken?: string,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(apiEndpoint(path), {
      ...init,
      headers: {
        ...(await apiAuthHeaders(explicitAccessToken)),
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError({
      code: "SERVICE_UNAVAILABLE",
      message:
        "The secure inspection service could not be reached. Please try again in a moment.",
      retryable: true,
    });
  }

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
