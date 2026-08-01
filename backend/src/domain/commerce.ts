import { z } from "zod";

export const moneySchema = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
});

export const normalizedOfferSchema = z.object({
  id: z.string(),
  provider: z.enum(["prava_ucp", "shopify_ucp", "manual", "illustrative"]),
  merchant: z.object({
    id: z.string(),
    name: z.string(),
    url: z.url(),
    countryCode: z.string().length(2),
    trustScore: z.number().min(0).max(1).nullable(),
    authorizedSeller: z.boolean().nullable(),
  }),
  product: z.object({
    externalProductId: z.string(),
    externalVariantId: z.string(),
    title: z.string(),
    imageUrl: z.url().nullable(),
    attributes: z.record(z.string(), z.string()),
  }),
  price: z.object({
    subtotalMinor: z.number().int().nonnegative(),
    shippingMinor: z.number().int().nonnegative().nullable(),
    taxMinor: z.number().int().nonnegative().nullable(),
    estimatedTotalMinor: z.number().int().nonnegative(),
    currency: z.string().length(3),
    isBinding: z.boolean(),
  }),
  inventory: z.object({
    status: z.enum(["in_stock", "limited", "out_of_stock", "unknown"]),
  }),
  delivery: z
    .object({ earliest: z.string().nullable(), latest: z.string().nullable() })
    .nullable(),
  returns: z
    .object({
      days: z.number().int().nonnegative().nullable(),
      freeReturns: z.boolean().nullable(),
    })
    .nullable(),
  identityVerification: z.object({
    status: z.enum(["verified", "likely", "rejected"]),
    score: z.number().min(0).max(1),
    contradictions: z.array(z.string()),
  }),
  illustrative: z.boolean(),
});

export type NormalizedOffer = z.infer<typeof normalizedOfferSchema>;

export interface ProductSearchRequest {
  canonicalProductId: string;
  query: string;
  destinationCountry: string;
  postalCode?: string;
  currency: string;
}

export interface QuoteRequest {
  offer: NormalizedOffer;
  quantity: number;
  addressReference: string;
}

export interface CommerceQuote {
  providerQuoteId: string;
  offerId: string;
  finalTotalMinor: number;
  currency: string;
  expiresAt: Date;
  isBinding: boolean;
}

export interface CheckoutRequest {
  quote: CommerceQuote;
  credential: {
    token: string;
    dynamicCvv: string;
    expiryMonth: string;
    expiryYear: string;
  };
}

export interface CheckoutResult {
  status: "approved" | "declined" | "unknown";
  merchantOrderId?: string;
  transactionReferenceId?: string;
  finalTotalMinor?: number;
  errorCode?: string;
}

export interface CommerceProvider {
  searchProducts(request: ProductSearchRequest): Promise<NormalizedOffer[]>;
  createQuote(request: QuoteRequest): Promise<CommerceQuote>;
  checkout(request: CheckoutRequest): Promise<CheckoutResult>;
}
