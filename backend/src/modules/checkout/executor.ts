import { z } from "zod";
import { MorrowError } from "../../common/errors";
import { getEnvironment } from "../../config/env";
import type { NormalizedOffer } from "../../domain/commerce";

export interface RestrictedCheckoutInput {
  paymentSessionId: string;
  offer: NormalizedOffer;
  shippingAddress: {
    reference: string;
    recipientName: string;
    line1: string;
    line2: string | null;
    city: string;
    region: string;
    postalCode: string;
    countryCode: string;
    phone: string;
  };
  authorizedMaximumMinor: number;
  currency: string;
  credential: {
    token: string;
    dynamicCvv: string;
    expiryMonth: string;
    expiryYear: string;
  };
}

const executorResponseSchema = z.object({
  status: z.enum(["approved", "declined", "unknown"]),
  merchantOrderId: z.string().optional(),
  transactionReferenceId: z.string().optional(),
  finalTotalMinor: z.number().int().nonnegative().optional(),
  authorizationCode: z.string().optional(),
  responseCode: z.string().optional(),
  errorCode: z.string().optional(),
});

export type RestrictedCheckoutResult = z.infer<typeof executorResponseSchema>;

export async function executeRestrictedCheckout(
  input: RestrictedCheckoutInput,
): Promise<RestrictedCheckoutResult> {
  const env = getEnvironment();
  if (
    !env.MERCHANT_CHECKOUT_EXECUTOR_URL ||
    !env.MERCHANT_CHECKOUT_EXECUTOR_SECRET
  ) {
    throw new MorrowError({
      code: "INTEGRATION_NOT_CONFIGURED",
      message: "A restricted merchant checkout executor is not configured",
      statusCode: 503,
    });
  }
  try {
    const response = await fetch(env.MERCHANT_CHECKOUT_EXECUTOR_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MERCHANT_CHECKOUT_EXECUTOR_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(90_000),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new MorrowError({
        code: "CHECKOUT_RESULT_UNKNOWN",
        message: `Checkout executor returned HTTP ${response.status}`,
        statusCode: 502,
      });
    }
    return executorResponseSchema.parse(body);
  } catch (error) {
    if (error instanceof MorrowError) throw error;
    throw new MorrowError({
      code: "CHECKOUT_RESULT_UNKNOWN",
      message:
        "Checkout outcome is unknown and will not be retried automatically",
      statusCode: 502,
      cause: error,
    });
  }
}
