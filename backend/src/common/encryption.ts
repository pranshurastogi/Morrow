import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getEnvironment } from "../config/env";

interface EncryptedEnvelope {
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  ciphertext: string;
}

function decodeKey(encoded: string | undefined, name: string): Buffer {
  if (!encoded) throw new Error(`${name} is required`);
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.byteLength !== 32) throw new Error(`Invalid ${name}`);
  return decoded;
}

function sessionKey(): Buffer {
  return decodeKey(
    getEnvironment().SESSION_TOKEN_ENCRYPTION_KEY,
    "SESSION_TOKEN_ENCRYPTION_KEY",
  );
}

function accountDataKey(): Buffer {
  return decodeKey(
    getEnvironment().ACCOUNT_DATA_ENCRYPTION_KEY,
    "ACCOUNT_DATA_ENCRYPTION_KEY",
  );
}

function encrypt(
  value: string,
  encryptionKey: Buffer,
  authenticatedContext?: string,
): EncryptedEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  if (authenticatedContext) {
    cipher.setAAD(Buffer.from(authenticatedContext, "utf8"));
  }
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return {
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decrypt(
  envelope: EncryptedEnvelope,
  encryptionKey: Buffer,
  authenticatedContext?: string,
): string {
  if (envelope.algorithm !== "aes-256-gcm")
    throw new Error("Unsupported encryption envelope");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey,
    Buffer.from(envelope.iv, "base64"),
  );
  if (authenticatedContext) {
    decipher.setAAD(Buffer.from(authenticatedContext, "utf8"));
  }
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptTransientSecret(value: string): EncryptedEnvelope {
  return encrypt(value, sessionKey());
}

export function decryptTransientSecret(envelope: EncryptedEnvelope): string {
  return decrypt(envelope, sessionKey());
}

export function encryptAccountData(
  value: unknown,
  authenticatedContext: string,
): EncryptedEnvelope {
  return encrypt(JSON.stringify(value), accountDataKey(), authenticatedContext);
}

export function decryptAccountData<T>(
  envelope: EncryptedEnvelope,
  authenticatedContext: string,
): T {
  return JSON.parse(
    decrypt(envelope, accountDataKey(), authenticatedContext),
  ) as T;
}

export type { EncryptedEnvelope };
