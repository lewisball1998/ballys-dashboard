import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Secret encryption at rest (AES-256-GCM). SCAFFOLD for v0.1 — there are no
 * module credentials to store yet, so this is unused in normal v0.1 operation.
 * It becomes load-bearing in v0.2 when modules persist API keys/tokens.
 *
 * Payload format: base64(iv) : base64(authTag) : base64(ciphertext)
 */
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

export function generateKey(): string {
  return randomBytes(KEY_BYTES).toString("base64");
}

function resolveKey(provided?: string): Buffer {
  const raw = provided ?? env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("APP_ENCRYPTION_KEY is not set (required to encrypt/decrypt secrets)");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes (base64)");
  }
  return key;
}

export function encrypt(plaintext: string, key?: string): string {
  const k = resolveKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, k, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64")).join(":");
}

export function decrypt(payload: string, key?: string): string {
  const k = resolveKey(key);
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted payload");
  }
  const decipher = createDecipheriv(ALGORITHM, k, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
