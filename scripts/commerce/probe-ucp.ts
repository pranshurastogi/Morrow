import { searchUcpCatalog } from "../../backend/src/integrations/shopify-ucp/client";
import { INDIA_UCP_MERCHANTS } from "../../backend/src/integrations/shopify-ucp/merchant-registry";

const args = process.argv.slice(2);
const probeAll = args.includes("--all");
const query =
  args
    .filter((argument) => argument !== "--all")
    .join(" ")
    .trim() || "Minimalist niacinamide serum";
const countryCode = "IN";
const currency = "INR";

async function probe(endpoint: string, searchQuery: string) {
  return searchUcpCatalog({
    endpoint,
    query: searchQuery,
    countryCode,
    currency,
    intent: "Validate Morrow merchant catalogue connectivity.",
    limit: probeAll ? 1 : 3,
  });
}

if (probeAll) {
  const rows: Array<{
    merchant: string;
    endpoint: string;
    status: "ready" | "failed";
    products: number;
    sample: string;
  }> = [];
  const queue = [...INDIA_UCP_MERCHANTS];
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length > 0) {
      const merchant = queue.shift();
      if (!merchant) return;
      try {
        const result = await probe(merchant.endpoint, merchant.name);
        rows.push({
          merchant: merchant.name,
          endpoint: new URL(merchant.endpoint).hostname,
          status: "ready",
          products: result.products.length,
          sample: result.products[0]?.title ?? "No matching product",
        });
      } catch (error) {
        rows.push({
          merchant: merchant.name,
          endpoint: new URL(merchant.endpoint).hostname,
          status: "failed",
          products: 0,
          sample: error instanceof Error ? error.message : "Unknown failure",
        });
      }
    }
  });
  await Promise.all(workers);
  rows.sort((left, right) => left.merchant.localeCompare(right.merchant));
  console.table(rows);
  const ready = rows.filter((row) => row.status === "ready").length;
  console.log(
    `${ready}/${rows.length} registered Indian UCP catalogues responded.`,
  );
  if (ready === 0) process.exitCode = 1;
} else {
  const endpoint =
    process.env.UCP_GLOBAL_CATALOG_URL ??
    "https://catalog.shopify.com/api/ucp/mcp";
  const result = await probe(endpoint, query);
  console.table(
    result.products.flatMap((product) =>
      product.variants.slice(0, 2).map((variant) => ({
        product: product.title,
        variant: variant.options.map((option) => option.label).join(", "),
        merchant:
          variant.seller?.name ??
          variant.seller?.domain ??
          (variant.url ? new URL(variant.url).hostname : "catalog result"),
        price: `${(variant.price.amount / 100).toFixed(2)} ${variant.price.currency}`,
        available: variant.availability?.available ?? "unknown",
      })),
    ),
  );
}
