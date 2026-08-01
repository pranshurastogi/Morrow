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

export type PravaSession = z.infer<typeof sessionResponseSchema>;
export type PravaPaymentResult = z.infer<typeof paymentResultSchema>;

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

  constructor(
    status: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super({
      code: status >= 500 ? "UPSTREAM_UNAVAILABLE" : "INVALID_REQUEST",
      message,
      statusCode: status >= 500 ? 502 : status,
      retryable: status >= 500 || status === 429,
      ...(details ? { details } : {}),
    });
    this.name = "PravaApiError";
    this.upstreamStatus = status;
  }
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
  const response = await fetch(`${env.PRAVA_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.PRAVA_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(env.PRAVA_REQUEST_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      body && typeof body === "object" && "error" in body ? body.error : null;
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : `Prava request failed with HTTP ${response.status}`;
    throw new PravaApiError(response.status, message, { providerCode: error });
  }
  return body;
}

export async function createPravaSession(
  input: CreatePravaSessionInput,
): Promise<PravaSession> {
  const body = await pravaFetch("/v1/sessions", {
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
  });
  return sessionResponseSchema.parse(body);
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
