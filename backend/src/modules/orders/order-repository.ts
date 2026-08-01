import type { Sql } from "postgres";
import { MorrowError } from "../../common/errors";
import { getDatabase } from "../../infrastructure/database/client";

export async function listOrders(userId: string, sql: Sql = getDatabase()) {
  return sql`
    select id, merchant_order_id, merchant_name, quantity, total_minor, currency, status,
      delivery_estimate, tracking, return_deadline, product_snapshot, created_at, updated_at
    from orders where user_id = ${userId} order by created_at desc limit 100
  `;
}

export async function getOrder(
  orderId: string,
  userId: string,
  sql: Sql = getDatabase(),
) {
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
  return row;
}
