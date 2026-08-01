import { createHash } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import type { ProductObservation } from "../../domain/product-observation";
import { getDatabase } from "../../infrastructure/database/client";
import { normalizeText } from "../../modules/recognition/normalization";
import {
  normalizeUcpVariant,
  type NormalizedUcpVariant,
} from "./normalization";
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

async function upsertCanonicalProduct(
  sql: TransactionSql,
  normalized: NormalizedUcpVariant,
  identityKey: string,
): Promise<string | null> {
  // Multiple scans can discover the same item concurrently. Serialize only
  // this semantic identity while reconciling source-specific catalogue rows.
  await sql`
    select pg_advisory_xact_lock(hashtextextended(${identityKey}, 0))
  `;
  const [identityRecord] = await sql`
    select id
    from canonical_products
    where catalog_identity_key = ${identityKey}
    for update
  `;
  const [sourceRecord] = await sql`
    select id
    from canonical_products
    where source_provider = 'shopify_ucp'
      and source_merchant_domain = ${normalized.merchantUcpDomain}
      and source_variant_id = ${normalized.externalVariantId}
    for update
  `;

  const targetId = identityRecord?.id ?? sourceRecord?.id;
  if (!targetId) {
    const [inserted] = await sql`
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
        ${sql.json(normalized.attributes)}, 'shopify_ucp',
        ${normalized.externalProductId}, ${normalized.externalVariantId},
        ${normalized.merchantUcpDomain}, ${identityKey}, now()
      )
      returning id
    `;
    return inserted ? String(inserted.id) : null;
  }

  if (
    identityRecord &&
    sourceRecord &&
    String(identityRecord.id) !== String(sourceRecord.id)
  ) {
    // Keep the established semantic record stable for scan/audit references.
    // The source row remains as provenance, while its sellable listing is
    // re-linked to the semantic record below.
    await sql`
      update canonical_products
      set catalog_identity_key = null
      where id = ${sourceRecord.id}
    `;
  }

  const [updated] = await sql`
    update canonical_products
    set
      category = ${normalized.category},
      brand = coalesce(${normalized.brand}, brand),
      name = ${normalized.name},
      variant = ${normalized.variant},
      size_value = ${normalized.size?.value ?? null},
      size_unit = ${normalized.size?.unit ?? null},
      gtin = coalesce(${normalized.gtin}, gtin),
      upc = coalesce(${normalized.upc}, upc),
      ean = coalesce(${normalized.ean}, ean),
      mpn = coalesce(${normalized.mpn}, mpn),
      model_number = coalesce(${normalized.modelNumber}, model_number),
      attributes = attributes || ${sql.json(normalized.attributes)},
      catalog_identity_key = ${identityKey},
      catalog_refreshed_at = now()
    where id = ${targetId}
    returning id
  `;
  return updated ? String(updated.id) : null;
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
          const canonicalId = await upsertCanonicalProduct(
            transaction,
            normalized,
            identityKey,
          );
          if (!canonicalId) continue;
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
