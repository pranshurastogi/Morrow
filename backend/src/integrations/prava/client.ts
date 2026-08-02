import { z } from "zod";
import { MorrowError } from "../../common/errors";
import { getEnvironment } from "../../config/env";

const sessionResponseSchema = z.object({
  session_id: z.string(),
  session_token: z.string(),
  iframe_url: z.url(),
  order_id: z.string(),
  expires_at: z.iso.datetime(),
});

const lineItemSchema = z.object({
  txn_ref_id: z.string(),
  merchant_name: z.string().nullable().optional(),
  merchant_url: z.string().nullable().optional(),
  total_amount: z.string(),
  status: z.string(),
  token: z.string().nullable().optional(),
  dynamic_cvv: z.string().nullable().optional(),
  expiry_month: z.string().nullable().optional(),
  expiry_year: z.string().nullable().optional(),
  products: z.array(z.unknown()).default([]),
});

const paymentResultSchema = z.object({
  session_id: z.string(),
  order_id: z.string().nullable(),
  status: z.enum(["pending", "awaiting_result", "completed", "failed"]),
  transactions: z.array(
    z.object({
      txn_id: z.string(),
      status: z.string(),
      line_items: z.array(lineItemSchema).default([]),
      error: z.object({ code: z.string(), message: z.string() }).optional(),
    }),
  ),
});

const cardSchema = z.object({
  card_id: z.string(),
  card_last4: z.string(),
  card_brand: z.string().nullable(),
  card_exp_month: z.number().int().min(1).max(12).nullable(),
  card_exp_year: z.number().int().nullable(),
  is_default: z.boolean(),
  status: z.enum(["active", "deleted"]),
  created_at: z.iso.datetime(),
});

const cardListResponseSchema = z.object({
  cards: z.array(cardSchema),
  count: z.number().int().nonnegative(),
});

const deleteCardResponseSchema = z.object({
  success: z.boolean(),
  card_id: z.string(),
  was_default: z.boolean(),
  network_token_deleted: z.boolean(),
});

export type PravaSession = z.infer<typeof sessionResponseSchema>;
export type PravaPaymentResult = z.infer<typeof paymentResultSchema>;
export type PravaCard = z.infer<typeof cardSchema>;

export interface CreatePravaSessionInput {
  userId: string;
  userEmail: string;
  totalAmount: string;
  currency: string;
  callbackUrl?: string;
  externalOrderReference: string;
  merchant: {
    name: string;
    url: string;
    countryCode: string;
    categoryCode?: string;
    category?: string;
  };
  product: {
    id: string;
    description: string;
    unitPrice: string;
    quantity: number;
  };
}

export class PravaApiError extends MorrowError {
  readonly upstreamStatus: number;
  readonly providerCode: string | null;
  readonly responseId: string | null;

  constructor(
    status: number,
    message: string,
    providerCode: string | null,
    responseId: string | null,
  ) {
    const details = {
      ...(providerCode ? { providerCode } : {}),
      ...(responseId ? { responseId } : {}),
    };
    super({
      code: status >= 500 ? "UPSTREAM_UNAVAILABLE" : "INVALID_REQUEST",
      message,
      statusCode: status >= 500 ? 502 : status,
      retryable: status >= 500 || status === 429,
      ...(Object.keys(details).length > 0 ? { details } : {}),
    });
    this.name = "PravaApiError";
    this.upstreamStatus = status;
    this.providerCode = providerCode;
    this.responseId = responseId;
  }
}

const RETRYABLE_SESSION_CREATION_STATUSES = new Set([500, 502, 503, 504]);

export function shouldRetryPravaSessionCreation(
  error: unknown,
  attempt: number,
): boolean {
  return (
    attempt === 0 &&
    error instanceof PravaApiError &&
    RETRYABLE_SESSION_CREATION_STATUSES.has(error.upstreamStatus)
  );
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function pravaFetch(path: string, init: RequestInit): Promise<unknown> {
  const env = getEnvironment();
  if (!env.PRAVA_SECRET_KEY) {
    throw new MorrowError({
      code: "INTEGRATION_NOT_CONFIGURED",
      message: "Prava is not configured",
      statusCode: 503,
    });
  }
  let response: Response;
  try {
    response = await fetch(`${env.PRAVA_API_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${env.PRAVA_SECRET_KEY}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      signal: AbortSignal.timeout(env.PRAVA_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new MorrowError({
      code: "UPSTREAM_UNAVAILABLE",
      message: "Prava could not be reached. The payment state was not changed.",
      statusCode: 502,
      retryable: true,
      cause: error,
    });
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      body && typeof body === "object" && "error" in body ? body.error : null;
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : `Prava request failed with HTTP ${response.status}`;
    const providerCode =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : null;
    throw new PravaApiError(
      response.status,
      message,
      providerCode,
      response.headers.get("x-response-id"),
    );
  }
  return body;
}

export async function createPravaSession(
  input: CreatePravaSessionInput,
): Promise<PravaSession> {
  const request: RequestInit = {
    method: "POST",
    body: JSON.stringify({
      user_id: input.userId,
      user_email: input.userEmail,
      total_amount: input.totalAmount,
      currency: input.currency.toUpperCase(),
      description: input.product.description,
      external_order_ref: input.externalOrderReference,
      integration_type: "embedding",
      ...(input.callbackUrl ? { callback_url: input.callbackUrl } : {}),
      purchase_context: [
        {
          merchant_details: {
            name: input.merchant.name,
            url: input.merchant.url,
            country_code_iso2: input.merchant.countryCode.toUpperCase(),
            category_code: input.merchant.categoryCode,
            category: input.merchant.category,
          },
          product_details: [
            {
              product_id: input.product.id,
              description: input.product.description,
              unit_price: input.product.unitPrice,
              quantity: input.product.quantity,
            },
          ],
          effective_until_minutes: 15,
        },
      ],
    }),
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const body = await pravaFetch("/v1/sessions", request);
      return sessionResponseSchema.parse(body);
    } catch (error) {
      if (!shouldRetryPravaSessionCreation(error, attempt)) throw error;
      // Session creation is permission setup, not a charge. Reusing the exact
      // external order reference keeps Prava's duplicate detection effective.
      await wait(500);
    }
  }

  throw new Error("Prava session retry exhausted unexpectedly");
}

export async function getPravaPaymentResult(
  sessionId: string,
): Promise<PravaPaymentResult> {
  const body = await pravaFetch(
    `/v1/sessions/${encodeURIComponent(sessionId)}/payment-result`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
  return paymentResultSchema.parse(body);
}

export async function listPravaCards(customerId: string): Promise<PravaCard[]> {
  try {
    const query = new URLSearchParams({
      customer_id: customerId,
      status: "active",
    });
    const body = await pravaFetch(`/v1/listCards?${query}`, {
      method: "GET",
      cache: "no-store",
    });
    return cardListResponseSchema.parse(body).cards;
  } catch (error) {
    if (
      error instanceof PravaApiError &&
      error.providerCode === "CUSTOMER_NOT_FOUND"
    ) {
      return [];
    }
    throw error;
  }
}

export async function deletePravaCard(input: {
  customerId: string;
  cardId: string;
}) {
  const body = await pravaFetch("/v1/deleteCard", {
    method: "POST",
    body: JSON.stringify({
      customer_id: input.customerId,
      card_id: input.cardId,
      reason: "CUSTOMER_CONFIRMED",
    }),
  });
  return deleteCardResponseSchema.parse(body);
}

export async function reportPravaStatus(input: {
  sessionId: string;
  transactionReferenceId: string;
  approved: boolean;
  amountPaid?: string;
  authorizationCode?: string;
  responseCode?: string;
}): Promise<void> {
  await pravaFetch(
    `/v1/sessions/${encodeURIComponent(input.sessionId)}/report-status`,
    {
      method: "POST",
      body: JSON.stringify({
        txn_ref_id: input.transactionReferenceId,
        txn_status: input.approved ? "APPROVED" : "DECLINED",
        txn_type: "PURCHASE",
        amount_paid: input.amountPaid,
        authorization_code: input.authorizationCode,
        response_code: input.responseCode,
      }),
    },
  );
}

export function publicPaymentResult(result: PravaPaymentResult) {
  return {
    sessionId: result.session_id,
    orderId: result.order_id,
    status: result.status,
    transactions: result.transactions.map((transaction) => ({
      transactionId: transaction.txn_id,
      status: transaction.status,
      error: transaction.error,
      lineItems: transaction.line_items.map((lineItem) => ({
        transactionReferenceId: lineItem.txn_ref_id,
        merchantName: lineItem.merchant_name,
        totalAmount: lineItem.total_amount,
        status: lineItem.status,
      })),
    })),
  };
}

export function extractCheckoutCredential(result: PravaPaymentResult) {
  if (result.status !== "awaiting_result") return null;
  for (const transaction of result.transactions) {
    for (const lineItem of transaction.line_items) {
      if (
        lineItem.status === "awaiting_result" &&
        lineItem.token &&
        lineItem.dynamic_cvv &&
        lineItem.expiry_month &&
        lineItem.expiry_year
      ) {
        return {
          transactionReferenceId: lineItem.txn_ref_id,
          token: lineItem.token,
          dynamicCvv: lineItem.dynamic_cvv,
          expiryMonth: lineItem.expiry_month,
          expiryYear: lineItem.expiry_year,
          totalAmount: lineItem.total_amount,
        };
      }
    }
  }
  return null;
}
