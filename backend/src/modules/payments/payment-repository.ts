import type { Sql } from "postgres";
import { createHash, randomUUID } from "node:crypto";
import { MorrowError } from "../../common/errors";
import {
  normalizedOfferSchema,
  type NormalizedOffer,
} from "../../domain/commerce";
import { getDatabase } from "../../infrastructure/database/client";
import { databaseJson } from "../../infrastructure/database/json";
import { resolveUserAddressId } from "../account/address-repository";

export interface PurchaseIntentRecord {
  id: string;
  userId: string;
  scanId: string;
  canonicalProductId: string;
  selectedOfferId: string;
  quantity: number;
  maxAuthorizedAmountMinor: number;
  currency: string;
  status:
    | "DRAFT"
    | "APPROVED"
    | "PAYMENT_SESSION_CREATED"
    | "CHECKOUT_IN_PROGRESS"
    | "COMPLETED"
    | "FAILED"
    | "EXPIRED";
  expiresAt: string;
  productSnapshot: Record<string, unknown>;
  offerSnapshot: NormalizedOffer;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSessionRecord {
  id: string;
  purchaseIntentId: string;
  providerSessionId: string;
  providerOrderId: string | null;
  status:
    | "PENDING"
    | "AWAITING_RESULT"
    | "CHECKOUT_IN_PROGRESS"
    | "COMPLETED"
    | "FAILED"
    | "EXPIRED"
    | "REVOKED";
  expiresAt: string | null;
  providerMetadata: Record<string, unknown>;
}

function mapIntent(row: Record<string, unknown>): PurchaseIntentRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    scanId: String(row.scan_id),
    canonicalProductId: String(row.canonical_product_id),
    selectedOfferId: String(row.selected_offer_id),
    quantity: Number(row.quantity),
    maxAuthorizedAmountMinor: Number(row.max_authorized_amount_minor),
    currency: String(row.currency).trim(),
    status: row.status as PurchaseIntentRecord["status"],
    expiresAt: new Date(String(row.expires_at)).toISOString(),
    productSnapshot: row.product_snapshot as Record<string, unknown>,
    offerSnapshot: normalizedOfferSchema.parse(row.offer_snapshot),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function mapSession(row: Record<string, unknown>): PaymentSessionRecord {
  return {
    id: String(row.id),
    purchaseIntentId: String(row.purchase_intent_id),
    providerSessionId: String(row.provider_session_id),
    providerOrderId:
      row.provider_order_id === null ? null : String(row.provider_order_id),
    status: row.status as PaymentSessionRecord["status"],
    expiresAt:
      row.expires_at === null
        ? null
        : new Date(String(row.expires_at)).toISOString(),
    providerMetadata: (row.provider_metadata as Record<string, unknown>) ?? {},
  };
}

export async function createPurchaseIntent(
  input: {
    userId: string;
    scanId: string;
    productId: string;
    offerId: string;
    quantity: number;
    maximumAuthorizedTotalMinor: number;
    currency: string;
    shippingAddressId?: string;
  },
  sql: Sql = getDatabase(),
): Promise<PurchaseIntentRecord> {
  return sql.begin(async (transaction) => {
    const shippingAddressId = await resolveUserAddressId(
      input.userId,
      input.shippingAddressId,
      transaction,
    );
    const [source] = await transaction`
      select o.*, s.user_id, cp.brand, cp.name, cp.variant, cp.size_value, cp.size_unit,
        cp.gtin, cp.model_number, cp.mpn, sc.classification,
        exists (
          select 1 from user_product_confirmations upc
          where upc.user_id = s.user_id and upc.scan_id = s.id
            and upc.product_id = o.canonical_product_id
        ) as user_confirmed
      from offers o
      join scans s on s.id = o.scan_id
      join canonical_products cp on cp.id = o.canonical_product_id
      join scan_candidates sc on sc.scan_id = s.id
        and sc.product_id = o.canonical_product_id
      where o.id = ${input.offerId} and o.scan_id = ${input.scanId}
        and o.canonical_product_id = ${input.productId} and s.user_id = ${input.userId}
        and s.selected_product_id = ${input.productId} and s.status = 'OFFERS_READY'
      for update
    `;
    if (!source)
      throw new MorrowError({
        code: "NOT_FOUND",
        message: "Verified offer not found",
        statusCode: 404,
      });
    if (source.illustrative) {
      throw new MorrowError({
        code: "FORBIDDEN",
        message: "Illustrative offers cannot be purchased",
        statusCode: 409,
      });
    }
    if (source.identity_status !== "verified") {
      throw new MorrowError({
        code: "MORE_EVIDENCE_REQUIRED",
        message: "The merchant variant is not verified for purchase",
        statusCode: 409,
      });
    }
    if (source.classification !== "exact_verified" && !source.user_confirmed) {
      throw new MorrowError({
        code: "MORE_EVIDENCE_REQUIRED",
        message: "Confirm the proposed product before approving a purchase",
        statusCode: 409,
      });
    }
    if (String(source.currency).trim() !== input.currency.toUpperCase()) {
      throw new MorrowError({
        code: "INVALID_REQUEST",
        message: "Offer currency does not match approval currency",
      });
    }
    if (
      Number(source.estimated_total_minor) * input.quantity >
      input.maximumAuthorizedTotalMinor
    ) {
      throw new MorrowError({
        code: "FINAL_TOTAL_EXCEEDS_LIMIT",
        message: "The offer exceeds the requested maximum",
        statusCode: 409,
      });
    }
    if (
      source.expires_at &&
      new Date(String(source.expires_at)) <= new Date()
    ) {
      throw new MorrowError({
        code: "OFFER_EXPIRED",
        message: "The selected offer has expired",
        statusCode: 409,
      });
    }

    const productSnapshot = {
      id: String(source.canonical_product_id),
      brand: source.brand,
      name: source.name,
      variant: source.variant,
      size:
        source.size_value === null
          ? null
          : { value: Number(source.size_value), unit: source.size_unit },
      gtin: source.gtin,
      modelNumber: source.model_number,
      partNumber: source.mpn,
    };
    const offerSnapshot = normalizedOfferSchema.parse(source.snapshot);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1_000);
    const [row] = await transaction`
      insert into purchase_intents (
        id, user_id, scan_id, canonical_product_id, selected_offer_id, quantity,
        max_authorized_amount_minor, currency, shipping_address_id, status, expires_at,
        product_snapshot, offer_snapshot
      ) values (
        ${randomUUID()}, ${input.userId}, ${input.scanId}, ${input.productId}, ${input.offerId},
        ${input.quantity}, ${input.maximumAuthorizedTotalMinor}, ${input.currency.toUpperCase()},
        ${shippingAddressId}, 'DRAFT', ${expiresAt}, ${transaction.json(productSnapshot)},
        ${transaction.json(offerSnapshot)}
      ) returning *
    `;
    await transaction`
      update scans set status = 'AWAITING_APPROVAL', version = version + 1
      where id = ${input.scanId} and status = 'OFFERS_READY'
    `;
    if (!row) throw new Error("Purchase intent was not created");
    return mapIntent(row);
  });
}

export async function approvePurchaseIntent(
  intentId: string,
  userId: string,
  sql: Sql = getDatabase(),
): Promise<PurchaseIntentRecord> {
  const [row] = await sql`
    update purchase_intents set status = 'APPROVED', approved_at = now(), version = version + 1
    where id = ${intentId} and user_id = ${userId} and status = 'DRAFT' and expires_at > now()
    returning *
  `;
  if (!row) {
    throw new MorrowError({
      code: "FORBIDDEN",
      message: "Purchase intent is unavailable, expired, or already approved",
      statusCode: 409,
    });
  }
  return mapIntent(row);
}

export async function getPurchaseIntent(
  intentId: string,
  userId: string,
  sql: Sql = getDatabase(),
): Promise<PurchaseIntentRecord> {
  const [row] =
    await sql`select * from purchase_intents where id = ${intentId} and user_id = ${userId}`;
  if (!row)
    throw new MorrowError({
      code: "NOT_FOUND",
      message: "Purchase intent not found",
      statusCode: 404,
    });
  return mapIntent(row);
}

export async function listPurchaseIntents(
  userId: string,
  sql: Sql = getDatabase(),
): Promise<PurchaseIntentRecord[]> {
  const rows = await sql`
    select * from purchase_intents
    where user_id = ${userId}
    order by created_at desc
    limit 100
  `;
  return rows.map(mapIntent);
}

export async function reserveIdempotencyKey(
  input: { key: string; operation: string; ownerId: string; request: unknown },
  sql: Sql = getDatabase(),
): Promise<"reserved" | "completed" | "in_progress" | "unknown"> {
  const requestHash = createHash("sha256")
    .update(JSON.stringify(input.request))
    .digest("hex");
  const [inserted] = await sql`
    insert into idempotency_records (key, operation, owner_id, request_hash, status, expires_at)
    values (${input.key}, ${input.operation}, ${input.ownerId}, ${requestHash}, 'STARTED', now() + interval '1 day')
    on conflict (key) do nothing returning status
  `;
  if (inserted) return "reserved";
  const [existing] = await sql`
    select status, owner_id, request_hash from idempotency_records where key = ${input.key}
  `;
  if (
    !existing ||
    existing.owner_id !== input.ownerId ||
    existing.request_hash !== requestHash
  ) {
    throw new MorrowError({
      code: "FORBIDDEN",
      message: "Idempotency key was used for another request",
      statusCode: 409,
    });
  }
  if (existing.status === "COMPLETED") return "completed";
  if (existing.status === "UNKNOWN") return "unknown";
  if (existing.status === "FAILED") {
    await sql`update idempotency_records set status = 'STARTED', response = null where key = ${input.key}`;
    return "reserved";
  }
  return "in_progress";
}

export async function finalizePaymentSession(
  input: {
    idempotencyKey: string;
    intentId: string;
    providerSessionId: string;
    providerOrderId: string;
    expiresAt: Date;
    iframeUrl: string;
    encryptedSessionToken: unknown;
  },
  sql: Sql = getDatabase(),
): Promise<PaymentSessionRecord> {
  return sql.begin(async (transaction) => {
    const [row] = await transaction`
      insert into payment_sessions (
        purchase_intent_id, provider, provider_session_id, provider_order_id,
        status, expires_at, provider_metadata
      ) values (
        ${input.intentId}, 'prava', ${input.providerSessionId}, ${input.providerOrderId},
        'PENDING', ${input.expiresAt}, ${transaction.json(
          databaseJson({
            iframeUrl: input.iframeUrl,
            encryptedSessionToken: input.encryptedSessionToken,
          }),
        )}
      ) returning *
    `;
    await transaction`
      update purchase_intents set status = 'PAYMENT_SESSION_CREATED', version = version + 1
      where id = ${input.intentId} and status = 'APPROVED'
    `;
    await transaction`
      update scans set status = 'PAYMENT_SESSION_CREATED', version = version + 1
      where id = (select scan_id from purchase_intents where id = ${input.intentId})
        and status = 'AWAITING_APPROVAL'
    `;
    await transaction`
      update idempotency_records set status = 'COMPLETED', response = ${transaction.json({ paymentSessionId: row?.id })}
      where key = ${input.idempotencyKey}
    `;
    if (!row) throw new Error("Payment session was not persisted");
    return mapSession(row);
  });
}

export async function markIdempotencyUnknown(
  key: string,
  sql: Sql = getDatabase(),
): Promise<void> {
  await sql`update idempotency_records set status = 'UNKNOWN' where key = ${key}`;
}

export async function markIdempotencyFailed(
  key: string,
  sql: Sql = getDatabase(),
): Promise<void> {
  await sql`update idempotency_records set status = 'FAILED' where key = ${key}`;
}

export async function getPaymentSessionByIntent(
  intentId: string,
  userId: string,
  sql: Sql = getDatabase(),
): Promise<PaymentSessionRecord | null> {
  const [row] = await sql`
    select ps.* from payment_sessions ps
    join purchase_intents pi on pi.id = ps.purchase_intent_id
    where ps.purchase_intent_id = ${intentId} and pi.user_id = ${userId}
  `;
  return row ? mapSession(row) : null;
}

export async function getPaymentSessionForUser(
  paymentSessionId: string,
  userId: string,
  sql: Sql = getDatabase(),
): Promise<PaymentSessionRecord> {
  const [row] = await sql`
    select ps.* from payment_sessions ps
    join purchase_intents pi on pi.id = ps.purchase_intent_id
    where ps.id = ${paymentSessionId} and pi.user_id = ${userId}
  `;
  if (!row)
    throw new MorrowError({
      code: "NOT_FOUND",
      message: "Payment session not found",
      statusCode: 404,
    });
  return mapSession(row);
}

export async function updatePaymentSessionStatus(
  paymentSessionId: string,
  status: PaymentSessionRecord["status"],
  clearSessionToken: boolean,
  sql: Sql = getDatabase(),
): Promise<void> {
  await sql`
    update payment_sessions set
      status = ${status},
      provider_metadata = case when ${clearSessionToken}
        then provider_metadata - 'encryptedSessionToken'
        else provider_metadata end
    where id = ${paymentSessionId}
  `;
}

export async function markCheckoutInProgress(
  paymentSessionId: string,
  sql: Sql = getDatabase(),
): Promise<void> {
  await sql.begin(async (transaction) => {
    await transaction`
      update payment_sessions set status = 'CHECKOUT_IN_PROGRESS' where id = ${paymentSessionId}
    `;
    await transaction`
      update purchase_intents set status = 'CHECKOUT_IN_PROGRESS', version = version + 1
      where id = (select purchase_intent_id from payment_sessions where id = ${paymentSessionId})
    `;
    await transaction`
      update scans set status = 'CHECKOUT_IN_PROGRESS', version = version + 1
      where id = (
        select pi.scan_id from payment_sessions ps
        join purchase_intents pi on pi.id = ps.purchase_intent_id
        where ps.id = ${paymentSessionId}
      ) and status = 'PAYMENT_SESSION_CREATED'
    `;
  });
}

export async function markCheckoutFailed(
  paymentSessionId: string,
  reason: string,
  sql: Sql = getDatabase(),
): Promise<void> {
  await sql.begin(async (transaction) => {
    await transaction`
      update payment_sessions set status = 'FAILED', provider_metadata = provider_metadata - 'encryptedSessionToken'
      where id = ${paymentSessionId}
    `;
    await transaction`
      update purchase_intents set status = 'FAILED', version = version + 1
      where id = (select purchase_intent_id from payment_sessions where id = ${paymentSessionId})
    `;
    await transaction`
      update scans set status = 'CHECKOUT_FAILED', error_code = 'MERCHANT_ORDER_FAILED',
        error_message = ${reason}, version = version + 1
      where id = (
        select pi.scan_id from payment_sessions ps
        join purchase_intents pi on pi.id = ps.purchase_intent_id
        where ps.id = ${paymentSessionId}
      )
    `;
  });
}

export async function recordCheckoutIssue(
  paymentSessionId: string,
  input: { code: string; message: string },
  sql: Sql = getDatabase(),
): Promise<void> {
  await sql`
    update payment_sessions set provider_metadata = provider_metadata || ${sql.json(
      databaseJson({
        checkoutIssue: input,
      }),
    )}
    where id = ${paymentSessionId}
  `;
}

export async function getCheckoutContext(
  paymentSessionId: string,
  sql: Sql = getDatabase(),
) {
  const [row] = await sql`
    select ps.*, pi.user_id, pi.scan_id, pi.canonical_product_id, pi.quantity,
      pi.max_authorized_amount_minor, pi.currency, pi.shipping_address_id,
      pi.product_snapshot, pi.offer_snapshot
    from payment_sessions ps
    join purchase_intents pi on pi.id = ps.purchase_intent_id
    where ps.id = ${paymentSessionId}
  `;
  if (!row)
    throw new MorrowError({
      code: "NOT_FOUND",
      message: "Checkout session not found",
      statusCode: 404,
    });
  return {
    paymentSession: mapSession(row),
    userId: String(row.user_id),
    scanId: String(row.scan_id),
    canonicalProductId: String(row.canonical_product_id),
    quantity: Number(row.quantity),
    maxAuthorizedAmountMinor: Number(row.max_authorized_amount_minor),
    currency: String(row.currency).trim(),
    shippingAddressId:
      row.shipping_address_id === null ? null : String(row.shipping_address_id),
    productSnapshot: row.product_snapshot as Record<string, unknown>,
    offerSnapshot: normalizedOfferSchema.parse(row.offer_snapshot),
  };
}

export async function completeOrder(
  input: {
    paymentSessionId: string;
    providerOrderId: string | null;
    merchantOrderId: string;
    finalTotalMinor: number;
    transactionReferenceId: string;
  },
  sql: Sql = getDatabase(),
): Promise<string> {
  return sql.begin(async (transaction) => {
    const [context] = await transaction`
      select ps.purchase_intent_id, pi.*, ps.provider_order_id
      from payment_sessions ps join purchase_intents pi on pi.id = ps.purchase_intent_id
      where ps.id = ${input.paymentSessionId} for update
    `;
    if (!context) throw new Error("Order context not found");
    const offer = normalizedOfferSchema.parse(context.offer_snapshot);
    const [order] = await transaction`
      insert into orders (
        user_id, purchase_intent_id, payment_session_id, provider_order_id, merchant_order_id,
        merchant_name, canonical_product_id, quantity, subtotal_minor, shipping_minor, tax_minor,
        total_minor, currency, status, product_snapshot, merchant_snapshot
      ) values (
        ${context.user_id}, ${context.purchase_intent_id}, ${input.paymentSessionId},
        ${input.providerOrderId ?? context.provider_order_id}, ${input.merchantOrderId},
        ${offer.merchant.name}, ${context.canonical_product_id}, ${context.quantity},
        ${offer.price.subtotalMinor}, ${offer.price.shippingMinor}, ${offer.price.taxMinor},
        ${input.finalTotalMinor}, ${context.currency}, 'MERCHANT_CONFIRMED',
        ${transaction.json(context.product_snapshot)}, ${transaction.json({
          ...offer.merchant,
          transactionReferenceId: input.transactionReferenceId,
        })}
      )
      on conflict (purchase_intent_id) do update set
        merchant_order_id = excluded.merchant_order_id,
        total_minor = excluded.total_minor,
        status = 'MERCHANT_CONFIRMED'
      returning id
    `;
    await transaction`
      update payment_sessions set status = 'COMPLETED', provider_metadata = provider_metadata - 'encryptedSessionToken'
      where id = ${input.paymentSessionId}
    `;
    await transaction`
      update purchase_intents set status = 'COMPLETED', version = version + 1
      where id = ${context.purchase_intent_id}
    `;
    await transaction`
      update scans set status = 'ORDER_COMPLETED', version = version + 1 where id = ${context.scan_id}
    `;
    if (!order) throw new Error("Order was not created");
    return String(order.id);
  });
}
