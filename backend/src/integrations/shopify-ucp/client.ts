import { randomUUID } from "node:crypto";
import { MorrowError } from "../../common/errors";
import { getEnvironment } from "../../config/env";
import {
  extractUcpSearchContent,
  ucpSearchResponseSchema,
  type UcpCatalogResult,
} from "./schemas";
import { INDIA_UCP_MERCHANTS } from "./merchant-registry";

export function assertAllowedUcpEndpoint(endpoint: string): URL {
  const url = new URL(endpoint);
  const exactRegistryEndpoints = new Set(
    INDIA_UCP_MERCHANTS.map((merchant) => merchant.endpoint),
  );
  const allowedShopify =
    url.protocol === "https:" &&
    url.port === "" &&
    (url.hostname === "catalog.shopify.com" ||
      (url.hostname.endsWith(".myshopify.com") &&
        url.pathname === "/api/ucp/mcp"));
  if (!allowedShopify && !exactRegistryEndpoints.has(url.toString())) {
    throw new MorrowError({
      code: "FORBIDDEN",
      message: "The merchant catalogue endpoint is not allowlisted",
      statusCode: 400,
      details: { provider: "shopify_ucp" },
    });
  }
  return url;
}

export async function callUcpTool(input: {
  endpoint: string;
  method: string;
  arguments: Record<string, unknown>;
}): Promise<unknown> {
  const env = getEnvironment();
  const endpoint = assertAllowedUcpEndpoint(input.endpoint);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error("UCP request timed out")),
    env.UCP_REQUEST_TIMEOUT_MS,
  );
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Morrow-Mercantile/1.0",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: randomUUID(),
        method: "tools/call",
        params: { name: input.method, arguments: input.arguments },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new MorrowError({
        code: "UPSTREAM_UNAVAILABLE",
        message: "A merchant catalogue could not be reached",
        statusCode: 502,
        retryable: response.status >= 500,
        details: { provider: "shopify_ucp", status: response.status },
      });
    }
    return await response.json();
  } catch (error) {
    if (error instanceof MorrowError) throw error;
    throw new MorrowError({
      code: "UPSTREAM_UNAVAILABLE",
      message: "A merchant catalogue could not be reached",
      statusCode: 502,
      retryable: true,
      details: { provider: "shopify_ucp" },
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchUcpCatalog(input: {
  endpoint: string;
  query: string;
  countryCode: string;
  currency: string;
  intent: string;
  limit: number;
}): Promise<UcpCatalogResult> {
  const env = getEnvironment();
  const endpoint = assertAllowedUcpEndpoint(input.endpoint);
  const globalCatalog = endpoint.hostname === "catalog.shopify.com";
  const request = {
    meta: { "ucp-agent": { profile: env.UCP_AGENT_PROFILE_URL } },
    catalog: {
      query: input.query,
      context: {
        address_country: input.countryCode,
        currency: input.currency,
        intent: input.intent,
      },
      ...(globalCatalog
        ? {
            filters: {
              available: true,
              ships_to: { country: input.countryCode.toUpperCase() },
              ships_from: [{ country: input.countryCode.toUpperCase() }],
            },
          }
        : {}),
      pagination: { limit: input.limit },
    },
  };
  // Shopify catalogue responses carry live availability and merchant pricing.
  // They must be fetched fresh; persisting normalized rows gives us auditability
  // without serving a cached provider response as current inventory.
  const raw = await callUcpTool({
    endpoint: input.endpoint,
    method: "search_catalog",
    arguments: request,
  });
  const parsed = ucpSearchResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new MorrowError({
      code: "UPSTREAM_UNAVAILABLE",
      message: "A merchant catalogue returned an unsupported response",
      statusCode: 502,
      retryable: true,
      details: { provider: "shopify_ucp" },
    });
  }
  if (parsed.data.error || parsed.data.result?.isError) {
    throw new MorrowError({
      code: "UPSTREAM_UNAVAILABLE",
      message: "A merchant catalogue rejected the discovery request",
      statusCode: 502,
      retryable: true,
      details: {
        provider: "shopify_ucp",
        providerCode: parsed.data.error?.code ?? "tool_error",
      },
    });
  }
  const content = extractUcpSearchContent(parsed.data);
  if (!content) {
    throw new MorrowError({
      code: "UPSTREAM_UNAVAILABLE",
      message: "A merchant catalogue returned an unsupported response",
      statusCode: 502,
      retryable: true,
      details: { provider: "shopify_ucp" },
    });
  }
  return {
    products: content.products,
    sourceEndpoint: input.endpoint,
    sourceMerchantCountryCode: input.countryCode.toUpperCase(),
    query: input.query,
  };
}
