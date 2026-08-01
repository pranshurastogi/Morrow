import type { Sql } from "postgres";
import { MorrowError } from "../../common/errors";
import { getDatabase } from "../../infrastructure/database/client";

export interface OrderRecord {
  id: string;
  merchantOrderId: string | null;
  merchantName: string;
  quantity: number;
  subtotalMinor: number | null;
  shippingMinor: number | null;
  taxMinor: number | null;
  totalMinor: number;
  currency: string;
  status:
    | "CREATED"
    | "PAYMENT_APPROVED"
    | "MERCHANT_CONFIRMED"
    | "PROCESSING"
    | "SHIPPED"
    | "DELIVERED"
    | "RETURN_REQUESTED"
    | "RETURNED"
    | "REFUNDED"
    | "FAILED";
  deliveryEstimate: Record<string, unknown> | null;
  tracking: Record<string, unknown> | null;
  returnDeadline: string | null;
  productSnapshot: Record<string, unknown>;
  merchantSnapshot?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function optionalMinorUnit(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function mapOrder(row: Record<string, unknown>): OrderRecord {
  return {
    id: String(row.id),
    merchantOrderId:
      row.merchant_order_id === null ? null : String(row.merchant_order_id),
    merchantName: String(row.merchant_name),
    quantity: Number(row.quantity),
    subtotalMinor: optionalMinorUnit(row.subtotal_minor),
    shippingMinor: optionalMinorUnit(row.shipping_minor),
    taxMinor: optionalMinorUnit(row.tax_minor),
    totalMinor: Number(row.total_minor),
    currency: String(row.currency).trim(),
    status: row.status as OrderRecord["status"],
    deliveryEstimate:
      (row.delivery_estimate as Record<string, unknown> | null) ?? null,
    tracking: (row.tracking as Record<string, unknown> | null) ?? null,
    returnDeadline:
      row.return_deadline === null
        ? null
        : new Date(String(row.return_deadline)).toISOString(),
    productSnapshot: row.product_snapshot as Record<string, unknown>,
    ...(row.merchant_snapshot === undefined
      ? {}
      : {
          merchantSnapshot: row.merchant_snapshot as Record<string, unknown>,
        }),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function listOrders(
  userId: string,
  sql: Sql = getDatabase(),
): Promise<OrderRecord[]> {
  const rows = await sql`
    select id, merchant_order_id, merchant_name, quantity, total_minor, currency, status,
      delivery_estimate, tracking, return_deadline, product_snapshot, created_at, updated_at
    from orders where user_id = ${userId} order by created_at desc limit 100
  `;
  return rows.map(mapOrder);
}

export async function getOrder(
  orderId: string,
  userId: string,
  sql: Sql = getDatabase(),
): Promise<OrderRecord> {
  const [row] = await sql`
    select id, merchant_order_id, merchant_name, quantity, subtotal_minor, shipping_minor,
      tax_minor, total_minor, currency, status, delivery_estimate, tracking, return_deadline,
      product_snapshot, merchant_snapshot, created_at, updated_at
    from orders where id = ${orderId} and user_id = ${userId}
  `;
  if (!row)
    throw new MorrowError({
      code: "NOT_FOUND",
      message: "Order not found",
      statusCode: 404,
    });
  return mapOrder(row);
}
