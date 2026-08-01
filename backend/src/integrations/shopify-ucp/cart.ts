import { createHash } from "node:crypto";
import { MorrowError } from "../../common/errors";
import { getEnvironment } from "../../config/env";
import { rememberJson } from "../../infrastructure/cache/json-cache";
import { callUcpTool } from "./client";
import { ucpCartResponseSchema } from "./schemas";

export interface UcpCartQuote {
  cartId: string;
  subtotalMinor: number;
  shippingMinor: number | null;
  taxMinor: number | null;
  estimatedTotalMinor: number;
  currency: string;
  expiresAt: string | null;
  continueUrl: string | null;
}

export async function createUcpCartQuote(input: {
  endpoint: string;
  variantId: string;
  quantity: number;
  countryCode: string;
}): Promise<UcpCartQuote> {
  const env = getEnvironment();
  const request = {
    meta: { "ucp-agent": { profile: env.UCP_AGENT_PROFILE_URL } },
    cart: {
      line_items: [{ item: { id: input.variantId }, quantity: input.quantity }],
      context: { address_country: input.countryCode },
    },
  };
  const digest = createHash("sha256")
    .update(`${input.endpoint}:${JSON.stringify(request)}`)
    .digest("hex");
  const raw = await rememberJson(`ucp:cart:${digest}`, 5 * 60, () =>
    callUcpTool({
      endpoint: input.endpoint,
      method: "create_cart",
      arguments: request,
    }),
  );
  const parsed = ucpCartResponseSchema.safeParse(raw);
  if (
    !parsed.success ||
    parsed.data.error ||
    parsed.data.result?.isError ||
    !parsed.data.result?.structuredContent
  ) {
    throw new MorrowError({
      code: "UPSTREAM_UNAVAILABLE",
      message: "The merchant could not refresh this cart estimate",
      statusCode: 502,
      retryable: true,
      details: { provider: "shopify_ucp" },
    });
  }
  const cart = parsed.data.result.structuredContent;
  const amount = (type: string) =>
    cart.totals.find((total) => total.type === type)?.amount ?? null;
  const subtotal = amount("subtotal") ?? amount("total") ?? 0;
  return {
    cartId: cart.id,
    subtotalMinor: subtotal,
    shippingMinor: amount("shipping"),
    taxMinor: amount("tax"),
    estimatedTotalMinor: amount("total") ?? subtotal,
    currency: cart.currency.toUpperCase(),
    expiresAt: cart.expires_at ?? null,
    continueUrl: cart.continue_url ?? null,
  };
}
