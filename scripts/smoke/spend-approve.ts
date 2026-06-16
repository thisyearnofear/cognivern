#!/usr/bin/env tsx
/**
 * End-to-end smoke test for the held-spend approve → broadcast path.
 *
 * Use when verifying that operator approval of a held spend run actually
 * broadcasts a real native value transfer on X Layer testnet. Exercises:
 *   - POST /api/cre/runs/:runId/approval with operator JWT
 *   - fresh Idempotency-Key per call (so retry attempts re-broadcast)
 *   - response carries transferStatus + transferTxHash (no fabrication)
 *
 * Prereqs:
 *   - A held spend run exists (status=paused_for_approval, workflow=spend).
 *     Create one via the dashboard (Spend / Governance Check) or any path
 *     that calls /api/spend with a held-by-policy amount.
 *   - The scoped wallet bound to that run has X Layer testnet OKB (the
 *     21000-gas transfer + the value).
 *   - You have an operator JWT (mint by SSHing the backend and signing with
 *     JWT_SECRET, or copy from the dashboard after login).
 *
 * Usage:
 *   BASE_URL=https://cognivern.thisyearnofear.com \
 *   JWT="eyJ..." \
 *   RUN_ID=run_abc123... \
 *   tsx scripts/smoke/spend-approve.ts
 */

const BASE_URL = (process.env.BASE_URL || "http://localhost:3087").replace(
  /\/+$/,
  "",
);
const JWT = process.env.JWT || "";
const RUN_ID = process.env.RUN_ID || "";
const APPROVE = process.env.DENY === "1" ? false : true;
const EXPLORER = "https://www.oklink.com/xlayer-testnet/tx";

function fail(msg: string): never {
  console.error(`\nFAIL: ${msg}\n`);
  process.exit(1);
}

if (!JWT) fail("JWT env var is required (operator Bearer token).");
if (!RUN_ID) fail("RUN_ID env var is required.");

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function getRun(runId: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${BASE_URL}/api/cre/runs/${runId}`, {
    headers: { Authorization: `Bearer ${JWT}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    fail(`GET /cre/runs/${runId} returned ${res.status}: ${text}`);
  }
  const body = (await res.json()) as Record<string, unknown>;
  return (body.data as Record<string, unknown> | undefined) || body;
}

async function main() {
  console.log(`\n→ Base URL:  ${BASE_URL}`);
  console.log(`→ Run:       ${RUN_ID}`);
  console.log(`→ Action:    ${APPROVE ? "APPROVE" : "DENY"}\n`);

  // 1. Pre-check: run must exist and be paused.
  const before = await getRun(RUN_ID);
  if (!before) fail(`Run ${RUN_ID} not found.`);
  console.log(`Before: status=${before.status} workflow=${before.workflow}`);
  if (before.status !== "paused_for_approval") {
    fail(
      `Run is not paused_for_approval (status=${before.status}). ` +
        `Create a held spend run first.`,
    );
  }

  // 2. Submit approval with a FRESH idempotency key.
  const idemKey = uuid();
  console.log(`\n→ POST /api/cre/runs/${RUN_ID}/approval`);
  console.log(`  Idempotency-Key: ${idemKey}`);
  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}/api/cre/runs/${RUN_ID}/approval`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${JWT}`,
      "Idempotency-Key": idemKey,
    },
    body: JSON.stringify({ approve: APPROVE, reason: "smoke test" }),
  });
  const elapsed = Date.now() - t0;
  console.log(`← HTTP ${res.status} in ${elapsed}ms`);

  if (res.status === 401 || res.status === 403) {
    const text = await res.text();
    fail(
      `Auth rejected: ${text}. Check JWT validity and that the endpoint ` +
        `requires operator userId (per the auth-hole fix).`,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    fail(`Response was not JSON. Status ${res.status}.`);
  }

  console.log(`\nResponse body:\n${JSON.stringify(body, null, 2)}\n`);

  // 3. Verify the response shape matches the contract.
  const transfer = body.transfer as
    | {
        transferStatus?: string;
        transferTxHash?: string;
        transferError?: string;
      }
    | undefined;

  if (!APPROVE) {
    if (body.success !== true) fail("DENY path: expected success=true.");
    console.log("PASS: deny recorded.");
    return;
  }

  if (!transfer) {
    fail("APPROVE path: response is missing `transfer` field.");
  }

  if (transfer.transferStatus === "sent") {
    if (!transfer.transferTxHash) {
      fail(
        "Contract violation: transferStatus='sent' but no transferTxHash.",
      );
    }
    console.log(`PASS: transfer broadcast.`);
    console.log(`  tx:       ${transfer.transferTxHash}`);
    console.log(`  explorer: ${EXPLORER}/${transfer.transferTxHash}`);

    // 4. Re-fetch the run; status must now be completed.
    const after = await getRun(RUN_ID);
    console.log(`\nAfter: status=${after?.status}`);
    if (after?.status !== "completed") {
      fail(
        `Run status is ${after?.status}, expected "completed" after a ` +
          `successful broadcast.`,
      );
    }
    return;
  }

  if (transfer.transferStatus === "failed") {
    if (transfer.transferTxHash) {
      fail(
        "Contract violation: transferStatus='failed' but transferTxHash is " +
          `present (${transfer.transferTxHash}). The whole point of the ` +
          `fail-loud contract is that failed transfers never report a hash.`,
      );
    }
    console.log(`EXPECTED FAILURE: ${transfer.transferError}`);

    // Verify the run is still paused (retryable).
    const after = await getRun(RUN_ID);
    console.log(`After: status=${after?.status}`);
    if (after?.status !== "paused_for_approval") {
      fail(
        `On transfer failure, run must remain paused_for_approval for ` +
          `retry. Got status=${after?.status}.`,
      );
    }
    console.log(
      `PASS: failure surfaced correctly; run remains retryable. ` +
        `Re-run this script (fresh idem key auto-generated) to retry.`,
    );
    return;
  }

  fail(`Unexpected transferStatus: ${transfer.transferStatus}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
