import type { NormalizedOffer } from "../../domain/commerce";
import type { CanonicalProductCandidate } from "../matching/verification";
import {
  jaccardSimilarity,
  normalizeBarcode,
  normalizeIdentifier,
  normalizeText,
  sizesEquivalent,
} from "../recognition/normalization";
import { normalizedSizeSchema } from "../../domain/product-observation";

function listingAttribute(
  offer: NormalizedOffer,
  ...names: string[]
): string | null {
  for (const name of names) {
    const value = offer.product.attributes[name];
    if (value) return value;
  }
  return null;
}

export interface CatalogEquivalence {
  status: "verified" | "likely" | "rejected";
  score: number;
  contradictions: string[];
  basis:
    | "same_catalogue_record"
    | "exact_identifier"
    | "brand_store_bridge"
    | "unproven";
}

function productBarcode(product: CanonicalProductCandidate): string | null {
  return product.gtin ?? product.ean ?? product.upc;
}

function sameProductIdentifier(
  left: string | null,
  right: string | null,
  normalizer: (value: string) => string | null,
): boolean | null {
  if (!left || !right) return null;
  return normalizer(left) === normalizer(right);
}

/**
 * Proves that a sellable UCP record represents the already-verified product.
 * The brand-store bridge is intentionally narrow: it requires an identifier
 * on the selected record, an official registered storefront, exact brand and
 * size agreement, and strong deterministic title overlap.
 */
export function verifyCatalogEquivalence(input: {
  selected: CanonicalProductCandidate;
  listingProduct: CanonicalProductCandidate;
  officialBrandStore: boolean;
}): CatalogEquivalence {
  const { selected, listingProduct } = input;
  if (selected.id === listingProduct.id) {
    return {
      status: "verified",
      score: 1,
      contradictions: [],
      basis: "same_catalogue_record",
    };
  }

  const contradictions: string[] = [];
  const barcodeMatch = sameProductIdentifier(
    productBarcode(selected),
    productBarcode(listingProduct),
    normalizeBarcode,
  );
  const modelMatch = sameProductIdentifier(
    selected.modelNumber,
    listingProduct.modelNumber,
    normalizeIdentifier,
  );
  const partMatch = sameProductIdentifier(
    selected.mpn,
    listingProduct.mpn,
    normalizeIdentifier,
  );
  if (barcodeMatch === false) contradictions.push("Catalogue barcode differs");
  if (modelMatch === false)
    contradictions.push("Catalogue model number differs");
  if (partMatch === false) contradictions.push("Catalogue part number differs");

  const selectedBrand = normalizeText(selected.brand ?? "");
  const listingBrand = normalizeText(listingProduct.brand ?? "");
  const brandMatch =
    Boolean(selectedBrand && listingBrand) && selectedBrand === listingBrand;
  if (selectedBrand && listingBrand && !brandMatch) {
    contradictions.push("Catalogue brand differs");
  }

  const sizeMatch =
    selected.size && listingProduct.size
      ? sizesEquivalent(selected.size, listingProduct.size)
      : selected.size
        ? false
        : null;
  if (sizeMatch === false)
    contradictions.push("Catalogue package size differs");

  if (contradictions.length > 0) {
    return {
      status: "rejected",
      score: 0,
      contradictions,
      basis: "unproven",
    };
  }
  if (barcodeMatch || modelMatch || partMatch) {
    return {
      status: "verified",
      score: 0.98,
      contradictions: [],
      basis: "exact_identifier",
    };
  }

  const selectedHasIdentifier = Boolean(
    productBarcode(selected) ?? selected.modelNumber ?? selected.mpn,
  );
  const titleSimilarity = jaccardSimilarity(
    [selected.brand, selected.name, selected.variant].filter(Boolean).join(" "),
    [listingProduct.brand, listingProduct.name, listingProduct.variant]
      .filter(Boolean)
      .join(" "),
  );
  if (
    selectedHasIdentifier &&
    input.officialBrandStore &&
    brandMatch &&
    sizeMatch !== false &&
    titleSimilarity >= 0.4
  ) {
    return {
      status: "verified",
      score: Math.min(0.94, 0.78 + titleSimilarity * 0.2),
      contradictions: [],
      basis: "brand_store_bridge",
    };
  }
  return {
    status: "likely",
    score: Math.min(0.74, titleSimilarity),
    contradictions: [
      "The merchant record is not linked by an exact identifier or official brand-store proof",
    ],
    basis: "unproven",
  };
}

export function verifyMerchantVariant(
  product: CanonicalProductCandidate,
  offer: NormalizedOffer,
): NormalizedOffer["identityVerification"] {
  const contradictions: string[] = [];
  let score = 0;
  let exactIdentifier = false;

  const canonicalIdentityKey = String(
    product.attributes.catalog_identity_key ?? "",
  );
  if (
    canonicalIdentityKey &&
    canonicalIdentityKey === listingAttribute(offer, "catalog_identity_key")
  ) {
    score += 0.8;
    exactIdentifier = true;
  }

  const sourceProvider =
    product.sourceProvider ?? String(product.attributes.source_provider ?? "");
  const sourceVariantId =
    product.sourceVariantId ??
    String(product.attributes.source_variant_id ?? "");
  const sourceMerchantDomain =
    product.sourceMerchantDomain ??
    String(product.attributes.source_merchant_domain ?? "");
  if (
    sourceProvider === "shopify_ucp" &&
    sourceVariantId &&
    sourceVariantId === listingAttribute(offer, "source_variant_id") &&
    sourceMerchantDomain &&
    sourceMerchantDomain === listingAttribute(offer, "source_merchant_domain")
  ) {
    score += 0.8;
    exactIdentifier = true;
  }

  const candidateBarcode = product.gtin ?? product.ean ?? product.upc;
  const listingBarcode = listingAttribute(
    offer,
    "gtin",
    "ean",
    "upc",
    "barcode",
  );
  if (candidateBarcode && listingBarcode) {
    if (
      normalizeBarcode(candidateBarcode) !== normalizeBarcode(listingBarcode)
    ) {
      contradictions.push("Barcode differs from the verified product");
    } else {
      score += 0.6;
      exactIdentifier = true;
    }
  }

  const candidatePart = product.modelNumber ?? product.mpn;
  const listingPart = listingAttribute(
    offer,
    "model_number",
    "model",
    "mpn",
    "part_number",
  );
  if (candidatePart && listingPart) {
    if (
      normalizeIdentifier(candidatePart) !== normalizeIdentifier(listingPart)
    ) {
      contradictions.push(
        "Model or part number differs from the verified product",
      );
    } else {
      score += 0.45;
      exactIdentifier = true;
    }
  }

  const listingSizeResult = normalizedSizeSchema.safeParse({
    value: Number(listingAttribute(offer, "size_value")),
    unit: listingAttribute(offer, "size_unit"),
  });
  if (product.size && listingSizeResult.success) {
    if (!sizesEquivalent(product.size, listingSizeResult.data)) {
      contradictions.push("Package size differs from the verified product");
    } else {
      score += 0.2;
    }
  } else if (product.size) {
    contradictions.push(
      "Merchant listing does not expose a verifiable package size",
    );
  }

  if (contradictions.length > 0)
    return { status: "rejected", score: 0, contradictions };
  if (exactIdentifier)
    return { status: "verified", score: Math.min(1, score), contradictions };
  return {
    status: "likely",
    score: Math.min(0.74, score),
    contradictions: ["Merchant listing has no matching exact identifier"],
  };
}

export interface OfferRequirements {
  maxTotalMinor?: number;
  currency: string;
  deliveryBefore?: string;
  blockedMerchantIds?: string[];
}

export function rankOffers(
  offers: NormalizedOffer[],
  requirements: OfferRequirements,
): Array<
  NormalizedOffer & {
    rankingScore: number;
    rankingReasons: string[];
    rejectedReasons: string[];
  }
> {
  const eligibleTotals = offers
    .filter((offer) => offer.identityVerification.status !== "rejected")
    .map((offer) => offer.price.estimatedTotalMinor);
  const minTotal = Math.min(...eligibleTotals, Number.POSITIVE_INFINITY);
  const maxTotal = Math.max(...eligibleTotals, 1);

  return offers
    .map((offer) => {
      const rejectedReasons: string[] = [];
      if (offer.identityVerification.status !== "verified")
        rejectedReasons.push("Exact merchant variant is not verified");
      if (offer.inventory.status === "out_of_stock")
        rejectedReasons.push("Out of stock");
      if (offer.price.currency !== requirements.currency.toUpperCase())
        rejectedReasons.push("Currency differs from request");
      if (
        requirements.maxTotalMinor &&
        offer.price.estimatedTotalMinor > requirements.maxTotalMinor
      ) {
        rejectedReasons.push("Exceeds the approved budget");
      }
      if (requirements.blockedMerchantIds?.includes(offer.merchant.id))
        rejectedReasons.push("Merchant is blocked");
      if (
        requirements.deliveryBefore &&
        offer.delivery?.latest &&
        new Date(offer.delivery.latest) > new Date(requirements.deliveryBefore)
      ) {
        rejectedReasons.push("Cannot meet the requested delivery date");
      }

      const trust = offer.merchant.trustScore ?? 0.5;
      const price = Number.isFinite(minTotal)
        ? 1 -
          (offer.price.estimatedTotalMinor - minTotal) /
            Math.max(1, maxTotal - minTotal)
        : 0;
      const delivery = offer.delivery?.latest ? 0.8 : 0.4;
      const returns = offer.returns?.freeReturns
        ? 1
        : offer.returns?.days
          ? 0.6
          : 0.25;
      const rankingScore =
        rejectedReasons.length > 0
          ? 0
          : offer.identityVerification.score * 0.4 +
            trust * 0.2 +
            price * 0.15 +
            delivery * 0.15 +
            returns * 0.1;
      const rankingReasons = [
        "Exact merchant variant verified",
        offer.merchant.authorizedSeller ? "Authorised seller" : null,
        offer.price.estimatedTotalMinor === minTotal
          ? "Lowest verified estimated total"
          : null,
        offer.delivery?.latest ? "Delivery window is published" : null,
      ].filter((reason): reason is string => Boolean(reason));
      return { ...offer, rankingScore, rankingReasons, rejectedReasons };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore);
}
