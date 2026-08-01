import type { Sql } from "postgres";
import { createHash } from "node:crypto";
import type { NormalizedOffer } from "../../domain/commerce";
import { getDatabase } from "../../infrastructure/database/client";
import type { CanonicalProductCandidate } from "../matching/verification";
import { normalizedSizeSchema } from "../../domain/product-observation";
import {
  rankOffers,
  type OfferRequirements,
  verifyCatalogEquivalence,
  verifyMerchantVariant,
} from "./offer-policy";
import { createUcpCartQuote } from "../../integrations/shopify-ucp/cart";
import {
  brandIndianMerchants,
  merchantByDomain,
} from "../../integrations/shopify-ucp/merchant-registry";

function stableOfferId(scanId: string, listingId: string): string {
  const bytes = Buffer.from(
    createHash("sha256")
      .update(`${scanId}:${listingId}`)
      .digest("hex")
      .slice(0, 32),
    "hex",
  );
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function mapProduct(row: Record<string, unknown>): CanonicalProductCandidate {
  const size = normalizedSizeSchema.safeParse({
    value: Number(row.size_value),
    unit: row.size_unit,
  });
  return {
    id: String(row.id),
    category: String(row.category),
    brand: row.brand === null ? null : String(row.brand),
    name: String(row.name),
    variant: row.variant === null ? null : String(row.variant),
    size: size.success ? size.data : null,
    gtin: row.gtin === null ? null : String(row.gtin),
    upc: row.upc === null ? null : String(row.upc),
    ean: row.ean === null ? null : String(row.ean),
    mpn: row.mpn === null ? null : String(row.mpn),
    modelNumber: row.model_number === null ? null : String(row.model_number),
    attributes: (row.attributes as Record<string, unknown>) ?? {},
    retrievalScore: 1,
    imageSimilarity: 0,
    historyMatch: false,
    sourceProvider:
      row.source_provider === null
        ? null
        : String(row.source_provider ?? "") || null,
    sourceProductId:
      row.source_product_id === null
        ? null
        : String(row.source_product_id ?? "") || null,
    sourceVariantId:
      row.source_variant_id === null
        ? null
        : String(row.source_variant_id ?? "") || null,
    sourceMerchantDomain:
      row.source_merchant_domain === null
        ? null
        : String(row.source_merchant_domain ?? "") || null,
  };
}

function mapListingProduct(
  row: Record<string, unknown>,
): CanonicalProductCandidate {
  return mapProduct({
    id: row.listing_product_id,
    category: row.listing_category,
    brand: row.listing_brand,
    name: row.listing_name,
    variant: row.listing_variant,
    size_value: row.listing_size_value,
    size_unit: row.listing_size_unit,
    gtin: row.listing_gtin,
    upc: row.listing_upc,
    ean: row.listing_ean,
    mpn: row.listing_mpn,
    model_number: row.listing_model_number,
    attributes: row.listing_product_attributes,
    source_provider: row.listing_source_provider,
    source_product_id: row.listing_source_product_id,
    source_variant_id: row.listing_source_variant_id,
    source_merchant_domain: row.listing_source_merchant_domain,
  });
}

export function isPurchasableOffer(
  offer: Awaited<ReturnType<typeof searchVerifiedListings>>[number],
): boolean {
  return (
    !offer.illustrative &&
    offer.identityVerification.status === "verified" &&
    offer.rejectedReasons.length === 0
  );
}

export async function searchVerifiedListings(
  input: { scanId: string; productId: string; requirements: OfferRequirements },
  sql: Sql = getDatabase(),
) {
  const [productRow] = await sql`
    select cp.*, s.country_code as scan_country_code
    from canonical_products cp
    join scans s on s.id = ${input.scanId}
    where cp.id = ${input.productId}
  `;
  if (!productRow) return [];
  const product = mapProduct(productRow);
  const brandStores = brandIndianMerchants(product.brand);
  const brandStoreDomains = brandStores.map((merchant) => merchant.domain);
  const brandStoreCondition = brandStoreDomains.length
    ? sql`m.domain in ${sql(brandStoreDomains)}`
    : sql`false`;
  const rows = await sql`
    select ml.*, m.slug as merchant_slug, m.name as merchant_name, m.domain,
      m.country_code, m.provider, m.trust_score, m.authorized_seller,
      cp.id as listing_product_id, cp.category as listing_category,
      cp.brand as listing_brand, cp.name as listing_name,
      cp.variant as listing_variant, cp.size_value as listing_size_value,
      cp.size_unit as listing_size_unit, cp.gtin as listing_gtin,
      cp.upc as listing_upc, cp.ean as listing_ean, cp.mpn as listing_mpn,
      cp.model_number as listing_model_number,
      cp.attributes as listing_product_attributes,
      cp.source_provider as listing_source_provider,
      cp.source_product_id as listing_source_product_id,
      cp.source_variant_id as listing_source_variant_id,
      cp.source_merchant_domain as listing_source_merchant_domain,
      sc.classification as scan_classification,
      sc.identity_score as scan_identity_score
    from merchant_listings ml
    join merchants m on m.id = ml.merchant_id
    join canonical_products cp on cp.id = ml.canonical_product_id
    left join scan_candidates sc on sc.scan_id = ${input.scanId}
      and sc.product_id = ml.canonical_product_id
      and sc.classification in ('exact_verified', 'likely_exact', 'similar')
    where (
        ml.canonical_product_id = ${input.productId}
        or sc.product_id is not null
        or ${brandStoreCondition}
      )
      and m.active = true
      and ml.price_minor is not null and ml.currency is not null
      and ml.product_url is not null and ml.last_seen_at > now() - interval '1 day'
    order by
      case when ml.canonical_product_id = ${input.productId} then 0 else 1 end,
      sc.identity_score desc nulls last,
      ml.last_seen_at desc
    limit 200
  `;
  const offers: NormalizedOffer[] = await Promise.all(
    rows.map(async (row) => {
      const listingProduct = mapListingProduct(row);
      const registryMerchant = merchantByDomain(String(row.domain));
      const officialBrandStore = brandStores.some(
        (merchant) => merchant.endpoint === registryMerchant?.endpoint,
      );
      let offer: NormalizedOffer = {
        id: stableOfferId(input.scanId, String(row.id)),
        provider:
          row.provider === "prava_ucp"
            ? "prava_ucp"
            : row.provider === "shopify_ucp"
              ? "shopify_ucp"
              : "manual",
        merchant: {
          id: String(row.merchant_id),
          name: String(row.merchant_name),
          url: `https://${String(row.domain)}`,
          countryCode: String(
            row.country_code ?? productRow.scan_country_code ?? "IN",
          ).trim(),
          trustScore: row.trust_score === null ? null : Number(row.trust_score),
          authorizedSeller:
            row.authorized_seller === null
              ? null
              : Boolean(row.authorized_seller),
        },
        product: {
          externalProductId: String(row.external_product_id),
          externalVariantId: String(row.external_variant_id),
          title: String(row.title),
          imageUrl: row.image_url === null ? null : String(row.image_url),
          attributes: Object.fromEntries(
            Object.entries(
              (row.attributes as Record<string, unknown>) ?? {},
            ).map(([key, value]) => [key, String(value)]),
          ),
        },
        price: {
          subtotalMinor: Number(row.price_minor),
          shippingMinor: null,
          taxMinor: null,
          estimatedTotalMinor: Number(row.price_minor),
          currency: String(row.currency).trim(),
          isBinding: false,
        },
        inventory: {
          status: ["in_stock", "limited", "out_of_stock"].includes(
            String(row.availability),
          )
            ? (row.availability as "in_stock" | "limited" | "out_of_stock")
            : "unknown",
        },
        delivery: null,
        returns: null,
        identityVerification: {
          status: "likely",
          score: 0,
          contradictions: [],
        },
        illustrative: false,
      };
      const sourceVerification = verifyMerchantVariant(listingProduct, offer);
      const equivalence = verifyCatalogEquivalence({
        selected: product,
        listingProduct,
        officialBrandStore,
      });
      const identityVerification =
        sourceVerification.status === "verified" &&
        equivalence.status === "verified"
          ? {
              status: "verified" as const,
              score: Math.min(sourceVerification.score, equivalence.score),
              contradictions: [],
            }
          : sourceVerification.status === "rejected" ||
              equivalence.status === "rejected"
            ? {
                status: "rejected" as const,
                score: 0,
                contradictions: [
                  ...sourceVerification.contradictions,
                  ...equivalence.contradictions,
                ],
              }
            : {
                status: "likely" as const,
                score: Math.min(sourceVerification.score, equivalence.score),
                contradictions: [
                  ...sourceVerification.contradictions,
                  ...equivalence.contradictions,
                ],
              };
      offer = {
        ...offer,
        product: {
          ...offer.product,
          attributes: {
            ...offer.product.attributes,
            identity_basis: equivalence.basis,
            verified_product_id: product.id,
          },
        },
        identityVerification,
      };
      const listingAttributes = offer.product.attributes;
      if (
        identityVerification.status === "verified" &&
        offer.provider === "shopify_ucp" &&
        listingAttributes.ucp_endpoint &&
        offer.product.externalVariantId
      ) {
        try {
          const quote = await createUcpCartQuote({
            endpoint: listingAttributes.ucp_endpoint,
            variantId: offer.product.externalVariantId,
            quantity: 1,
            countryCode: offer.merchant.countryCode,
          });
          offer = {
            ...offer,
            product: {
              ...offer.product,
              attributes: {
                ...offer.product.attributes,
                ucp_cart_id: quote.cartId,
                ...(quote.continueUrl
                  ? { ucp_continue_url: quote.continueUrl }
                  : {}),
                ...(quote.expiresAt
                  ? { ucp_cart_expires_at: quote.expiresAt }
                  : {}),
              },
            },
            price: {
              subtotalMinor: quote.subtotalMinor,
              shippingMinor: quote.shippingMinor,
              taxMinor: quote.taxMinor,
              estimatedTotalMinor: quote.estimatedTotalMinor,
              currency: quote.currency,
              isBinding: false,
            },
          };
        } catch {
          // Catalogue price remains a clearly labelled estimate when Cart MCP is unavailable.
        }
      }
      return offer;
    }),
  );
  const ranked = rankOffers(offers, input.requirements);

  await sql.begin(async (transaction) => {
    for (const item of ranked) {
      await transaction`
        insert into offers (
          id, scan_id, canonical_product_id, merchant_id, provider, provider_offer_id,
          external_product_id, external_variant_id, subtotal_minor, shipping_minor, tax_minor,
          estimated_total_minor, currency, inventory_status, identity_status, identity_score,
          ranking_score, ranking_reasons, rejected_reasons, illustrative, snapshot, expires_at
        ) values (
          ${item.id}, ${input.scanId}, ${input.productId}, ${item.merchant.id}, ${item.provider},
          ${`${item.merchant.id}:${item.product.externalVariantId}`}, ${item.product.externalProductId},
          ${item.product.externalVariantId}, ${item.price.subtotalMinor}, ${item.price.shippingMinor},
          ${item.price.taxMinor}, ${item.price.estimatedTotalMinor}, ${item.price.currency},
          ${item.inventory.status}, ${item.identityVerification.status}, ${item.identityVerification.score},
          ${item.rankingScore}, ${transaction.json(item.rankingReasons)}, ${transaction.json(item.rejectedReasons)},
          ${item.illustrative}, ${transaction.json(item)}, now() + interval '10 minutes'
        ) on conflict (scan_id, provider, provider_offer_id) do update set
          canonical_product_id = excluded.canonical_product_id,
          estimated_total_minor = excluded.estimated_total_minor, identity_status = excluded.identity_status,
          identity_score = excluded.identity_score, ranking_score = excluded.ranking_score,
          ranking_reasons = excluded.ranking_reasons, rejected_reasons = excluded.rejected_reasons,
          snapshot = excluded.snapshot, expires_at = excluded.expires_at, created_at = now()
      `;
    }
  });
  return ranked;
}

export async function listOffersForUser(
  scanId: string,
  productId: string,
  userId: string,
  sql: Sql = getDatabase(),
) {
  const rows = await sql`
    select o.snapshot, o.ranking_score, o.ranking_reasons, o.rejected_reasons, o.expires_at
    from offers o join scans s on s.id = o.scan_id
    where o.scan_id = ${scanId} and o.canonical_product_id = ${productId} and s.user_id = ${userId}
    order by o.ranking_score desc nulls last
  `;
  return rows.map((row) => ({
    ...row.snapshot,
    rankingScore: Number(row.ranking_score),
    rankingReasons: row.ranking_reasons,
    rejectedReasons: row.rejected_reasons,
    expiresAt: new Date(String(row.expires_at)).toISOString(),
  }));
}
