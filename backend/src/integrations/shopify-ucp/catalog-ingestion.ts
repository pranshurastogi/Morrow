import { createHash } from "node:crypto";
import type { Sql } from "postgres";
import type { ProductObservation } from "../../domain/product-observation";
import { getDatabase } from "../../infrastructure/database/client";
import { normalizeText } from "../../modules/recognition/normalization";
import { normalizeUcpVariant } from "./normalization";
import type { UcpCatalogResult } from "./schemas";

function merchantSlug(name: string, domain: string): string {
  const stem = normalizeText(name).replaceAll(" ", "-").slice(0, 48);
  const digest = createHash("sha256").update(domain).digest("hex").slice(0, 8);
  return `${stem || "merchant"}-${digest}`;
}

export function catalogIdentityKey(input: {
  brand: string | null;
  name: string;
  size: { value: number; unit: string } | null;
  gtin: string | null;
  variant: string | null;
  merchantDomain: string;
  attributes: Record<string, string>;
}): string {
  const normalizedBrand = normalizeText(input.brand ?? "");
  let normalizedName = normalizeText(input.name);
  // Global Catalog commonly prefixes the maker while the merchant storefront
  // exposes the same title without it. The maker remains a separate identity
  // dimension, so removing only a leading duplicate is deterministic and does
  // not merge products across brands.
  if (
    normalizedBrand &&
    (normalizedName === normalizedBrand ||
      normalizedName.startsWith(`${normalizedBrand} `))
  ) {
    normalizedName = normalizedName.slice(normalizedBrand.length).trim();
  }
  const variantOptions = Object.entries(input.attributes)
    .filter(
      ([key]) =>
        key.startsWith("option_") &&
        key !== "option_title" &&
        !/(size|volume|weight|capacity)/.test(key),
    )
    .map(([key, value]) => `${key}:${normalizeText(value)}`)
    .sort();
  const identity = input.gtin
    ? `gtin:${input.gtin}`
    : [
        normalizeText(input.brand ?? input.merchantDomain),
        normalizedName,
        input.size ? `${input.size.value}:${input.size.unit}` : "size:unknown",
        ...variantOptions,
        ...(!input.size && variantOptions.length === 0 && input.variant
          ? [normalizeText(input.variant)]
          : []),
      ].join("|");
  return createHash("sha256").update(identity).digest("hex");
}

export async function ingestUcpCatalog(input: {
  results: UcpCatalogResult[];
  observation: ProductObservation;
  sql?: Sql;
}): Promise<string[]> {
  const sql = input.sql ?? getDatabase();
  const productIds: string[] = [];
  await sql.begin(async (transaction) => {
    for (const result of input.results) {
      for (const product of result.products) {
        for (const variant of product.variants) {
          const normalized = normalizeUcpVariant({
            product,
            variant,
            observation: input.observation,
            sourceEndpoint: result.sourceEndpoint,
          });
          const identityKey = catalogIdentityKey({
            brand: normalized.brand,
            name: normalized.name,
            size: normalized.size,
            gtin: normalized.gtin,
            variant: normalized.variant,
            merchantDomain: normalized.merchantUcpDomain,
            attributes: normalized.attributes,
          });
          normalized.attributes.catalog_identity_key = identityKey;
          const [merchant] = await transaction`
            insert into merchants (
              slug, name, domain, country_code, provider, provider_endpoint,
              trust_score, authorized_seller, metadata
            ) values (
              ${merchantSlug(normalized.merchantName, normalized.merchantPublicDomain)},
              ${normalized.merchantName}, ${normalized.merchantPublicDomain}, ${normalized.merchantCountryCode},
              'shopify_ucp', ${normalized.merchantEndpoint}, 0.5, null,
              ${transaction.json({
                ucpDomain: normalized.merchantUcpDomain,
                sourceCatalogEndpoint: result.sourceEndpoint,
              })}
            ) on conflict (domain) do update set
              name = excluded.name,
              country_code = coalesce(excluded.country_code, merchants.country_code),
              provider = excluded.provider,
              provider_endpoint = excluded.provider_endpoint,
              metadata = merchants.metadata || excluded.metadata,
              active = true
            returning id
          `;
          if (!merchant) continue;
          const [canonical] = await transaction`
            insert into canonical_products (
              category, brand, name, variant, size_value, size_unit, gtin, upc,
              ean, mpn, model_number, attributes, source_provider,
              source_product_id, source_variant_id, source_merchant_domain,
              catalog_identity_key, catalog_refreshed_at
            ) values (
              ${normalized.category}, ${normalized.brand}, ${normalized.name},
              ${normalized.variant}, ${normalized.size?.value ?? null},
              ${normalized.size?.unit ?? null}, ${normalized.gtin}, ${normalized.upc},
              ${normalized.ean}, ${normalized.mpn}, ${normalized.modelNumber},
              ${transaction.json(normalized.attributes)}, 'shopify_ucp',
              ${normalized.externalProductId}, ${normalized.externalVariantId},
              ${normalized.merchantUcpDomain}, ${identityKey}, now()
            ) on conflict (catalog_identity_key)
              where catalog_identity_key is not null
            do update set
              category = excluded.category,
              brand = coalesce(excluded.brand, canonical_products.brand),
              name = excluded.name,
              variant = excluded.variant,
              size_value = excluded.size_value,
              size_unit = excluded.size_unit,
              gtin = coalesce(excluded.gtin, canonical_products.gtin),
              upc = coalesce(excluded.upc, canonical_products.upc),
              ean = coalesce(excluded.ean, canonical_products.ean),
              mpn = coalesce(excluded.mpn, canonical_products.mpn),
              model_number = coalesce(excluded.model_number, canonical_products.model_number),
              attributes = canonical_products.attributes || excluded.attributes,
              catalog_refreshed_at = now()
            returning id
          `;
          if (!canonical) continue;
          const canonicalId = String(canonical.id);
          productIds.push(canonicalId);
          if (normalized.imageUrl) {
            await transaction`
              insert into product_images (
                product_id, image_url, image_type, source
              ) values (
                ${canonicalId}, ${normalized.imageUrl}, 'primary', 'shopify_ucp'
              ) on conflict (product_id, image_url) do nothing
            `;
          }
          await transaction`
            insert into merchant_listings (
              canonical_product_id, merchant_id, external_product_id,
              external_variant_id, title, product_url, image_url, price_minor,
              currency, availability, attributes, last_seen_at
            ) values (
              ${canonicalId}, ${merchant.id}, ${normalized.externalProductId},
              ${normalized.externalVariantId}, ${normalized.title},
              ${normalized.productUrl}, ${normalized.imageUrl},
              ${normalized.priceMinor}, ${normalized.currency},
              ${normalized.availability}, ${transaction.json(normalized.attributes)}, now()
            ) on conflict (merchant_id, external_product_id, external_variant_id)
            do update set
              canonical_product_id = excluded.canonical_product_id,
              title = excluded.title,
              product_url = excluded.product_url,
              image_url = excluded.image_url,
              price_minor = excluded.price_minor,
              currency = excluded.currency,
              availability = excluded.availability,
              attributes = excluded.attributes,
              last_seen_at = now()
          `;
        }
      }
    }
  });
  return [...new Set(productIds)];
}
