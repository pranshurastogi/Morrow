import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getEnvironment } from "../config/env";

interface EncryptedEnvelope {
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  ciphertext: string;
}

function key(): Buffer {
  const encoded = getEnvironment().SESSION_TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new Error("SESSION_TOKEN_ENCRYPTION_KEY is required");
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.byteLength !== 32)
    throw new Error("Invalid session-token encryption key");
  return decoded;
}

export function encryptTransientSecret(value: string): EncryptedEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
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

export function decryptTransientSecret(envelope: EncryptedEnvelope): string {
  if (envelope.algorithm !== "aes-256-gcm")
    throw new Error("Unsupported encryption envelope");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export type { EncryptedEnvelope };
