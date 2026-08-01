import { MorrowError } from "../../common/errors";
import {
  decimalToMinorUnits,
  minorUnitsToDecimal,
  validateFinalTotal,
} from "../../common/money";
import { writeAuditEvent } from "../../infrastructure/database/audit-repository";
import {
  extractCheckoutCredential,
  getPravaPaymentResult,
  reportPravaStatus,
} from "../../integrations/prava/client";
import {
  completeOrder,
  getCheckoutContext,
  markCheckoutFailed,
  markCheckoutInProgress,
  recordCheckoutIssue,
} from "../payments/payment-repository";
import { getUserAddress } from "../account/address-repository";
import { executeRestrictedCheckout } from "./executor";

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function executeCheckoutUnsafe(
  paymentSessionId: string,
): Promise<{ orderId: string }> {
  const context = await getCheckoutContext(paymentSessionId);
  const providerResult = await getPravaPaymentResult(
    context.paymentSession.providerSessionId,
  );
  const credential = extractCheckoutCredential(providerResult);
  if (!credential) {
    throw new MorrowError({
      code: "CHECKOUT_RESULT_UNKNOWN",
      message: "Prava has not issued checkout credentials for this session",
      statusCode: 409,
    });
  }
  const approvedTotalMinor = decimalToMinorUnits(credential.totalAmount);
  validateFinalTotal({
    quotedTotalMinor: context.offerSnapshot.price.estimatedTotalMinor,
    finalTotalMinor: approvedTotalMinor,
    authorizedMaximumMinor: context.maxAuthorizedAmountMinor,
  });

  if (!context.shippingAddressId) {
    throw new MorrowError({
      code: "DELIVERY_ADDRESS_REQUIRED",
      message: "A delivery address is required before merchant checkout",
      statusCode: 409,
    });
  }
  const address = await getUserAddress(
    context.shippingAddressId,
    context.userId,
  );

  await markCheckoutInProgress(paymentSessionId);
  await writeAuditEvent({
    userId: context.userId,
    entityType: "payment_session",
    entityId: paymentSessionId,
    eventType: "CHECKOUT_STARTED",
    actorType: "worker",
    payload: {
      merchant: context.offerSnapshot.merchant.name,
      authorizedMaximumMinor: context.maxAuthorizedAmountMinor,
      currency: context.currency,
    },
  });

  const checkout = await executeRestrictedCheckout({
    paymentSessionId,
    offer: context.offerSnapshot,
    shippingAddress: {
      reference: address.id,
      recipientName: address.recipientName,
      line1: address.line1,
      line2: address.line2 ?? null,
      city: address.city,
      region: address.region,
      postalCode: address.postalCode,
      countryCode: address.countryCode,
      phone: address.phone,
    },
    authorizedMaximumMinor: context.maxAuthorizedAmountMinor,
    currency: context.currency,
    credential: {
      token: credential.token,
      dynamicCvv: credential.dynamicCvv,
      expiryMonth: credential.expiryMonth,
      expiryYear: credential.expiryYear,
    },
  });
  if (checkout.status === "unknown") {
    throw new MorrowError({
      code: "CHECKOUT_RESULT_UNKNOWN",
      message:
        "Merchant checkout outcome is unknown; no automatic retry will occur",
      statusCode: 502,
    });
  }

  const finalTotalMinor = checkout.finalTotalMinor ?? approvedTotalMinor;
  validateFinalTotal({
    quotedTotalMinor: context.offerSnapshot.price.estimatedTotalMinor,
    finalTotalMinor,
    authorizedMaximumMinor: context.maxAuthorizedAmountMinor,
  });
  if (checkout.status === "approved" && !checkout.merchantOrderId) {
    throw new MorrowError({
      code: "CHECKOUT_RESULT_UNKNOWN",
      message:
        "Merchant checkout reported approval without an order identifier",
      statusCode: 502,
    });
  }
  await reportPravaStatus({
    sessionId: context.paymentSession.providerSessionId,
    transactionReferenceId: credential.transactionReferenceId,
    approved: checkout.status === "approved",
    amountPaid: minorUnitsToDecimal(finalTotalMinor),
    ...(checkout.authorizationCode
      ? { authorizationCode: checkout.authorizationCode }
      : {}),
    ...(checkout.responseCode ? { responseCode: checkout.responseCode } : {}),
  });

  if (checkout.status === "declined") {
    await markCheckoutFailed(
      paymentSessionId,
      "The merchant declined the checkout",
    );
    throw new MorrowError({
      code: "PAYMENT_DECLINED",
      message: "The merchant declined the payment",
      statusCode: 402,
    });
  }
  // The approved branch was checked before reporting success to Prava.
  const merchantOrderId = checkout.merchantOrderId!;

  let finalPravaStatus = providerResult.status;
  for (
    let attempt = 0;
    attempt < 4 && finalPravaStatus !== "completed";
    attempt += 1
  ) {
    if (attempt > 0) await wait(500 * attempt);
    finalPravaStatus = (
      await getPravaPaymentResult(context.paymentSession.providerSessionId)
    ).status;
  }
  if (finalPravaStatus !== "completed") {
    throw new MorrowError({
      code: "CHECKOUT_RESULT_UNKNOWN",
      message:
        "Merchant checkout succeeded but Prava final confirmation is pending",
      statusCode: 502,
    });
  }

  const orderId = await completeOrder({
    paymentSessionId,
    providerOrderId: providerResult.order_id,
    merchantOrderId,
    finalTotalMinor,
    transactionReferenceId: credential.transactionReferenceId,
  });
  await writeAuditEvent({
    userId: context.userId,
    entityType: "order",
    entityId: orderId,
    eventType: "ORDER_CONFIRMED",
    actorType: "worker",
    payload: {
      merchantOrderId,
      finalTotalMinor,
      currency: context.currency,
    },
  });
  return { orderId };
}

export async function executeCheckout(
  paymentSessionId: string,
): Promise<{ orderId: string }> {
  try {
    return await executeCheckoutUnsafe(paymentSessionId);
  } catch (error) {
    const issue =
      error instanceof MorrowError
        ? { code: error.code, message: error.message }
        : {
            code: "CHECKOUT_RESULT_UNKNOWN",
            message: "Checkout stopped without a verified final result",
          };
    await recordCheckoutIssue(paymentSessionId, issue).catch(() => undefined);
    throw error;
  }
}
