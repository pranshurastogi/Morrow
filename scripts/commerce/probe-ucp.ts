import { ucpSearchResponseSchema } from "../../backend/src/integrations/shopify-ucp/schemas";

const query =
  process.argv.slice(2).join(" ").trim() || "Minimalist niacinamide serum";
const endpoint =
  process.env.UCP_GLOBAL_CATALOG_URL ??
  "https://catalog.shopify.com/api/ucp/mcp";
const profile =
  process.env.UCP_AGENT_PROFILE_URL ??
  "https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json";

const response = await fetch(endpoint, {
  method: "POST",
  headers: { Accept: "application/json", "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: "morrow-catalog-probe",
    method: "tools/call",
    params: {
      name: "search_catalog",
      arguments: {
        meta: { "ucp-agent": { profile } },
        catalog: {
          query,
          context: { address_country: "IN", currency: "INR" },
          pagination: { limit: 3 },
        },
      },
    },
  }),
  signal: AbortSignal.timeout(15_000),
});

if (!response.ok) {
  throw new Error(`UCP probe failed with HTTP ${response.status}`);
}
const parsed = ucpSearchResponseSchema.parse(await response.json());
if (parsed.error) {
  throw new Error(`UCP ${parsed.error.code}: ${parsed.error.message}`);
}
const products = parsed.result?.structuredContent.products ?? [];
console.table(
  products.flatMap((product) =>
    product.variants.slice(0, 2).map((variant) => ({
      product: product.title,
      variant: variant.options.map((option) => option.label).join(", "),
      merchant: variant.seller.name,
      price: `${(variant.price.amount / 100).toFixed(2)} ${variant.price.currency}`,
      available: variant.availability?.available ?? "unknown",
    })),
  ),
);
