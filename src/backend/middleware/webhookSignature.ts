import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

export function getInboundWebhookSecret(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const secret = env.CHAINGPT_WEBHOOK_SECRET || env.WEBHOOK_SECRET;
  return secret && secret.trim() ? secret.trim() : undefined;
}

export function signWebhookPayload(
  rawBody: Buffer | string,
  timestampSeconds: number | string,
  secret: string,
): string {
  const payload =
    typeof rawBody === "string"
      ? `${timestampSeconds}.${rawBody}`
      : Buffer.concat([
          Buffer.from(`${timestampSeconds}.`, "utf8"),
          rawBody,
        ]);
  const digest = createHmac("sha256", secret).update(payload).digest("hex");
  return `sha256=${digest}`;
}

function readSignatureHeader(req: Request): string | undefined {
  const header =
    req.headers["x-webhook-signature"] ||
    req.headers["x-cognivern-signature"];
  if (Array.isArray(header)) return header[0];
  return header;
}

function readTimestampHeader(req: Request): string | undefined {
  const header = req.headers["x-webhook-timestamp"];
  if (Array.isArray(header)) return header[0];
  return header;
}

export function verifySignedWebhook(
  req: Request,
  nowMs: number = Date.now(),
  env: NodeJS.ProcessEnv = process.env,
): { ok: true } | { ok: false; status: number; error: string } {
  const secret = getInboundWebhookSecret(env);
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: "Webhook secret is not configured",
    };
  }

  const rawBody = req.rawBody;
  if (!rawBody || rawBody.length === 0) {
    return { ok: false, status: 401, error: "Missing signed webhook body" };
  }

  const signature = readSignatureHeader(req);
  const timestamp = readTimestampHeader(req);
  if (!signature || !timestamp) {
    return {
      ok: false,
      status: 401,
      error: "Missing webhook signature or timestamp",
    };
  }

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(nowMs - timestampMs) > REPLAY_WINDOW_MS) {
    return { ok: false, status: 401, error: "Webhook timestamp is outside the replay window" };
  }

  const expected = signWebhookPayload(rawBody, timestamp, secret);
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signature, "utf8");
  if (
    expectedBuf.length !== actualBuf.length ||
    !timingSafeEqual(expectedBuf, actualBuf)
  ) {
    return { ok: false, status: 401, error: "Invalid webhook signature" };
  }

  return { ok: true };
}

export function verifyChainGptWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = verifySignedWebhook(req);
  if (!result.ok) {
    res.status(result.status).json({
      success: false,
      error: result.error,
      timestamp: new Date().toISOString(),
    });
    return;
  }
  next();
}
