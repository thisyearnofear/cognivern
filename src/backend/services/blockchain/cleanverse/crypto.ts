/**
 * AES/CBC/PKCS5Padding helpers for Cleanverse encrypted endpoints.
 * Fixed IV: 16 zero bytes. Key length selects AES-128/192/256.
 */

import crypto from "node:crypto";

function resolveKeyAndAlgo(apiKey: string): { key: Buffer; algo: string } {
  let key: Buffer;
  if (apiKey.endsWith("=") || /^[A-Za-z0-9+/]+=*$/.test(apiKey)) {
    key = Buffer.from(apiKey, "base64");
  } else {
    key = Buffer.from(apiKey, "utf-8");
  }

  let algo: string;
  if (key.length === 16) {
    algo = "aes-128-cbc";
  } else if (key.length === 24) {
    algo = "aes-192-cbc";
  } else if (key.length === 32) {
    algo = "aes-256-cbc";
  } else {
    const padded = Buffer.alloc(16, 0);
    key.copy(padded, 0, 0, Math.min(key.length, 16));
    key = padded;
    algo = "aes-128-cbc";
  }

  return { key, algo };
}

export function encryptAes(data: string, apiKey: string): string {
  const { key, algo } = resolveKeyAndAlgo(apiKey);
  const iv = Buffer.alloc(16, 0);
  const cipher = crypto.createCipheriv(algo, key, iv);
  cipher.setAutoPadding(true);
  return cipher.update(data, "utf-8", "base64") + cipher.final("base64");
}

export function decryptAes(encryptedData: string, apiKey: string): string {
  const { key, algo } = resolveKeyAndAlgo(apiKey);
  const iv = Buffer.alloc(16, 0);
  const decipher = crypto.createDecipheriv(algo, key, iv);
  decipher.setAutoPadding(true);
  return (
    decipher.update(encryptedData, "base64", "utf-8") + decipher.final("utf-8")
  );
}

export function encodePayload(
  payload: Record<string, unknown>,
  apiKey: string,
): string {
  return encryptAes(JSON.stringify(payload), apiKey);
}

export function decodePayload<T>(encryptedData: string, apiKey: string): T {
  return JSON.parse(decryptAes(encryptedData, apiKey)) as T;
}
