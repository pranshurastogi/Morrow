import { randomUUID } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import { z } from "zod";
import {
  decryptAccountData,
  encryptAccountData,
  type EncryptedEnvelope,
} from "../../common/encryption";
import { MorrowError } from "../../common/errors";
import { getDatabase } from "../../infrastructure/database/client";
import { databaseJson } from "../../infrastructure/database/json";

export const addressInputSchema = z.object({
  label: z.string().trim().min(1).max(40),
  recipientName: z.string().trim().min(1).max(100),
  line1: z.string().trim().min(1).max(120),
  line2: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().min(1).max(80),
  region: z.string().trim().min(1).max(80),
  postalCode: z.string().trim().min(2).max(16),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/),
  phone: z.string().trim().min(7).max(24),
  isDefault: z.boolean().default(false),
});

export type AddressInput = z.infer<typeof addressInputSchema>;

export interface UserAddress extends AddressInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

const encryptedEnvelopeSchema = z.object({
  algorithm: z.literal("aes-256-gcm"),
  iv: z.string(),
  authTag: z.string(),
  ciphertext: z.string(),
});

const privateAddressSchema = addressInputSchema.omit({
  label: true,
  isDefault: true,
});

type PrivateAddress = z.infer<typeof privateAddressSchema>;
type Queryable = Sql | TransactionSql;

function authenticatedContext(userId: string, addressId: string): string {
  return `morrow-address:v1:${userId}:${addressId}`;
}

function privatePayload(input: AddressInput): PrivateAddress {
  return {
    recipientName: input.recipientName,
    line1: input.line1,
    line2: input.line2 ?? null,
    city: input.city,
    region: input.region,
    postalCode: input.postalCode,
    countryCode: input.countryCode.toUpperCase(),
    phone: input.phone,
  };
}

function mapAddress(row: Record<string, unknown>): UserAddress {
  const id = String(row.id);
  const userId = String(row.user_id);
  const envelope = encryptedEnvelopeSchema.parse(
    row.encrypted_payload,
  ) as EncryptedEnvelope;
  const payload = privateAddressSchema.parse(
    decryptAccountData<unknown>(envelope, authenticatedContext(userId, id)),
  );
  return {
    id,
    label: String(row.label),
    ...payload,
    isDefault: Boolean(row.is_default),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

async function ownedAddressRow(
  addressId: string,
  userId: string,
  sql: Queryable,
) {
  const [row] = await sql`
    select * from user_addresses
    where id = ${addressId} and user_id = ${userId} and deleted_at is null
    limit 1
  `;
  if (!row) {
    throw new MorrowError({
      code: "NOT_FOUND",
      message: "Delivery address not found",
      statusCode: 404,
    });
  }
  return row;
}

export async function listUserAddresses(
  userId: string,
  sql: Sql = getDatabase(),
): Promise<UserAddress[]> {
  const rows = await sql`
    select * from user_addresses
    where user_id = ${userId} and deleted_at is null
    order by is_default desc, created_at desc
  `;
  return rows.map(mapAddress);
}

export async function getUserAddress(
  addressId: string,
  userId: string,
  sql: Queryable = getDatabase(),
): Promise<UserAddress> {
  return mapAddress(await ownedAddressRow(addressId, userId, sql));
}

export async function resolveUserAddressId(
  userId: string,
  requestedAddressId: string | undefined,
  sql: Queryable = getDatabase(),
): Promise<string> {
  if (requestedAddressId) {
    await ownedAddressRow(requestedAddressId, userId, sql);
    return requestedAddressId;
  }
  const [row] = await sql`
    select id from user_addresses
    where user_id = ${userId} and is_default and deleted_at is null
    limit 1
  `;
  if (!row) {
    throw new MorrowError({
      code: "DELIVERY_ADDRESS_REQUIRED",
      message: "Add a delivery address before approving this dispatch",
      statusCode: 409,
    });
  }
  return String(row.id);
}

export async function createUserAddress(
  userId: string,
  rawInput: AddressInput,
  sql: Sql = getDatabase(),
): Promise<UserAddress> {
  const input = addressInputSchema.parse(rawInput);
  return sql.begin(async (transaction) => {
    const id = randomUUID();
    const [existing] = await transaction`
      select id from user_addresses
      where user_id = ${userId} and deleted_at is null
      limit 1
      for update
    `;
    const makeDefault = input.isDefault || !existing;
    if (makeDefault) {
      await transaction`
        update user_addresses set is_default = false
        where user_id = ${userId} and deleted_at is null and is_default
      `;
    }
    const encryptedPayload = encryptAccountData(
      privatePayload(input),
      authenticatedContext(userId, id),
    );
    const [row] = await transaction`
      insert into user_addresses (
        id, user_id, label, encrypted_payload, country_code, is_default
      ) values (
        ${id}, ${userId}, ${input.label},
        ${transaction.json(databaseJson(encryptedPayload))},
        ${input.countryCode.toUpperCase()}, ${makeDefault}
      ) returning *
    `;
    if (!row) throw new Error("Delivery address was not created");
    return mapAddress(row);
  });
}

export async function updateUserAddress(
  addressId: string,
  userId: string,
  rawInput: AddressInput,
  sql: Sql = getDatabase(),
): Promise<UserAddress> {
  const input = addressInputSchema.parse(rawInput);
  return sql.begin(async (transaction) => {
    await ownedAddressRow(addressId, userId, transaction);
    if (input.isDefault) {
      await transaction`
        update user_addresses set is_default = false
        where user_id = ${userId} and id <> ${addressId}
          and deleted_at is null and is_default
      `;
    }
    const encryptedPayload = encryptAccountData(
      privatePayload(input),
      authenticatedContext(userId, addressId),
    );
    const [row] = await transaction`
      update user_addresses set
        label = ${input.label},
        encrypted_payload = ${transaction.json(databaseJson(encryptedPayload))},
        country_code = ${input.countryCode.toUpperCase()},
        is_default = case when ${input.isDefault} then true else is_default end
      where id = ${addressId} and user_id = ${userId} and deleted_at is null
      returning *
    `;
    if (!row) throw new Error("Delivery address was not updated");
    return mapAddress(row);
  });
}

export async function setDefaultUserAddress(
  addressId: string,
  userId: string,
  sql: Sql = getDatabase(),
): Promise<UserAddress> {
  return sql.begin(async (transaction) => {
    await ownedAddressRow(addressId, userId, transaction);
    await transaction`
      update user_addresses set is_default = false
      where user_id = ${userId} and deleted_at is null and is_default
    `;
    await transaction`
      update user_addresses set is_default = true
      where id = ${addressId} and user_id = ${userId} and deleted_at is null
    `;
    return mapAddress(await ownedAddressRow(addressId, userId, transaction));
  });
}

export async function deleteUserAddress(
  addressId: string,
  userId: string,
  sql: Sql = getDatabase(),
): Promise<void> {
  await sql.begin(async (transaction) => {
    const existing = await ownedAddressRow(addressId, userId, transaction);
    await transaction`
      update user_addresses set deleted_at = now(), is_default = false
      where id = ${addressId} and user_id = ${userId} and deleted_at is null
    `;
    if (existing.is_default) {
      await transaction`
        update user_addresses set is_default = true
        where id = (
          select id from user_addresses
          where user_id = ${userId} and deleted_at is null
          order by created_at desc
          limit 1
        )
      `;
    }
  });
}

export async function assertUserAddressOwnership(
  addressId: string,
  userId: string,
  sql: Queryable = getDatabase(),
): Promise<void> {
  await ownedAddressRow(addressId, userId, sql);
}
