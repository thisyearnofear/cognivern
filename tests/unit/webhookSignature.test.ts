import { describe, expect, it } from "vitest";
import { signWebhookPayload, verifySignedWebhook } from "@backend/middleware/webhookSignature.js";
import type { Request } from "express";

const secret = "test-webhook-secret";
const body = Buffer.from('{"event":"exploit","title":"test"}', "utf8");

function request(overrides: {
  signature?: string;
  timestamp?: string;
  rawBody?: Buffer;
} = {}): Request {
  const timestamp = overrides.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature =
    overrides.signature ?? signWebhookPayload(body, timestamp, secret);
  return {
    rawBody: overrides.rawBody ?? body,
    headers: {
      "x-webhook-signature": signature,
      "x-webhook-timestamp": timestamp,
    },
  } as unknown as Request;
}

describe("webhookSignature", () => {
  it("accepts a valid HMAC over timestamp plus raw body", () => {
    expect(
      verifySignedWebhook(request(), Date.now(), { CHAINGPT_WEBHOOK_SECRET: secret }),
    ).toEqual({ ok: true });
  });

  it("rejects a missing secret", () => {
    const result = verifySignedWebhook(request(), Date.now(), {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(503);
  });

  it("rejects a tampered body", () => {
    const result = verifySignedWebhook(
      request({ rawBody: Buffer.from('{"event":"exploit","title":"forged"}') }),
      Date.now(),
      { CHAINGPT_WEBHOOK_SECRET: secret },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("rejects a stale timestamp", () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 20 * 60);
    const result = verifySignedWebhook(
      request({
        timestamp,
        signature: signWebhookPayload(body, timestamp, secret),
      }),
      Date.now(),
      { CHAINGPT_WEBHOOK_SECRET: secret },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/replay/i);
  });
});
