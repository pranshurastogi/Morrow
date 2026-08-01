import { z } from "zod";

const descriptionSchema = z
  .object({ plain: z.string().optional(), html: z.string().optional() })
  .passthrough()
  .optional();

const mediaSchema = z
  .object({
    type: z.string().optional(),
    url: z.url(),
    alt_text: z.string().optional(),
  })
  .passthrough();

const optionSchema = z
  .object({ name: z.string(), label: z.string() })
  .passthrough();

const sellerSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1).optional(),
    url: z.url().optional(),
    domain: z.string().min(1).optional(),
  })
  .passthrough();

export const ucpVariantSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: descriptionSchema,
    url: z.url().optional(),
    price: z.object({
      amount: z.number().int().nonnegative(),
      currency: z.string().length(3),
    }),
    availability: z
      .object({ available: z.boolean().optional() })
      .passthrough()
      .optional(),
    options: z.array(optionSchema).default([]),
    media: z.array(mediaSchema).default([]),
    seller: sellerSchema.optional(),
    checkout_url: z.url().optional(),
    eligible: z
      .object({ native_checkout: z.boolean().optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const ucpProductSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: descriptionSchema,
    url: z.url().optional(),
    media: z.array(mediaSchema).default([]),
    variants: z.array(ucpVariantSchema).default([]),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const ucpStructuredContentSchema = z
  .object({
    ucp: z
      .object({ version: z.string(), status: z.string().optional() })
      .passthrough(),
    products: z.array(ucpProductSchema).default([]),
    messages: z.array(z.unknown()).default([]),
    pagination: z
      .object({
        has_next_page: z.boolean().optional(),
        total_count: z.number().int().nonnegative().optional(),
        cursor: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const ucpSearchResponseSchema = z
  .object({
    jsonrpc: z.literal("2.0"),
    id: z.union([z.string(), z.number()]),
    result: z
      .object({
        structuredContent: ucpStructuredContentSchema,
        isError: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    error: z
      .object({
        code: z.number(),
        message: z.string(),
        data: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const cartStructuredContentSchema = z
  .object({
    id: z.string().min(1),
    currency: z.string().length(3),
    totals: z.array(
      z
        .object({
          type: z.string(),
          amount: z.number().int().nonnegative(),
          display_text: z.string().optional(),
        })
        .passthrough(),
    ),
    expires_at: z.string().optional(),
    continue_url: z.url().optional(),
    messages: z.array(z.unknown()).default([]),
  })
  .passthrough();

export const ucpCartResponseSchema = z
  .object({
    jsonrpc: z.literal("2.0"),
    id: z.union([z.string(), z.number()]),
    result: z
      .object({
        structuredContent: cartStructuredContentSchema,
        isError: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    error: z
      .object({ code: z.number(), message: z.string() })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type UcpProduct = z.infer<typeof ucpProductSchema>;
export type UcpVariant = z.infer<typeof ucpVariantSchema>;

export interface UcpCatalogResult {
  products: UcpProduct[];
  sourceEndpoint: string;
}
