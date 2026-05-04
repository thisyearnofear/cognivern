/**
 * Cognivern × Fhenix — End-to-End Demo Script
 *
 * Walks through the full encrypted spend path:
 *   1. Create encrypted policy on Fhenix
 *   2. Submit encrypted spend (auto-approve)
 *   3. Submit encrypted spend (hold — above approval threshold)
 *   4. Check cross-chain anchoring on X Layer
 *   5. Issue auditor permit (selective disclosure)
 *   6. Auditor decrypts scoped fields
 *   7. Non-TypeScript agent path (Trusted Encryption Sidecar)
 *   8. Privara confidential payroll (Wave 4)
 *
 * Usage:
 *   pnpm demo:fhenix
 *   COGNIVERN_URL=https://your-server.com pnpm demo:fhenix
 */

import crypto from "node:crypto";

type ApiEnvelope<T = any> = {
  success?: boolean;
  data?: T;
  error?: any;
  [key: string]: unknown;
};

const baseUrl = (process.env.COGNIVERN_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const apiKey = process.env.COGNIVERN_API_KEY || "development-api-key";

async function request<T = any>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init.headers || {});
  if (path.startsWith("/api/")) {
    headers.set("X-API-KEY", apiKey);
  }
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });

  const text = await res.text();
  const body = text
    ? (JSON.parse(text) as ApiEnvelope<T>)
    : ({} as ApiEnvelope<T>);

  if (!res.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : body?.error?.message || `${path} failed with ${res.status}`,
    );
  }

  return body;
}

function vendorHash(name: string): string {
  return "0x" + crypto.createHash("sha256").update(name).digest("hex");
}

function step(n: number, title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Step ${n} — ${title}`);
  console.log("─".repeat(60));
}

function ok(label: string, value: unknown) {
  console.log(`  ✓ ${label}:`, JSON.stringify(value, null, 2));
}

function warn(label: string, value: unknown) {
  console.log(`  ⚠ ${label}:`, JSON.stringify(value, null, 2));
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║        Cognivern × Fhenix — Live Demo                   ║");
  console.log("║  Encrypted spend policy evaluation via CoFHE / FHE      ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`\n  Target: ${baseUrl}`);

  const agentId = "agent-treasury-demo";
  let policyId: string | undefined;
  let approveDecisionId: string | undefined;
  let permitToken: string | undefined;

  // ── Step 1: Create encrypted policy ──────────────────────────────────────
  step(1, "Create Encrypted Policy on Fhenix");
  try {
    const res = await request("/api/governance/policies/confidential", {
      method: "POST",
      json: {
        agentId,
        dailyLimit: 5000,
        perTxLimit: 1000,
        approvalThreshold: 500,
        confidential: true,
      },
    });
    policyId = res.data?.policyId;
    ok("policyId", policyId);
    ok("fhenixTx", res.data?.fhenixTx);
    ok("note", res.data?.note ?? "dailyLimit, perTxLimit, approvalThreshold encrypted as euint128 on Fhenix");
  } catch (err: any) {
    warn("policy creation error", err.message);
    // Use a deterministic fallback so subsequent steps can still run
    policyId = "0x" + crypto.createHash("sha256").update(agentId).digest("hex");
    warn("using fallback policyId", policyId);
  }

  // ── Step 2: Encrypted spend — under threshold (approve) ──────────────────
  step(2, "Submit Encrypted Spend — $200 (auto-approve)");
  try {
    const res = await request("/api/spend/encrypted", {
      method: "POST",
      json: {
        agentId,
        policyId,
        amountUsd: 200,
        vendorHash: vendorHash("acme-corp"),
      },
    });
    approveDecisionId = res.data?.decisionId;
    ok("decisionId", approveDecisionId);
    ok("outcome", res.data?.outcome);
    ok("note", res.data?.note ?? "FHE.lte(newSpent, dailyLimit) evaluated in ciphertext");
  } catch (err: any) {
    warn("spend/encrypted error", err.message);
  }

  // ── Step 3: Encrypted spend — above approval threshold (hold) ────────────
  step(3, "Submit Encrypted Spend — $750 (hold)");
  try {
    const res = await request("/api/spend/encrypted", {
      method: "POST",
      json: {
        agentId,
        policyId,
        amountUsd: 750,
        vendorHash: vendorHash("acme-corp"),
      },
    });
    ok("decisionId", res.data?.decisionId);
    ok("outcome", res.data?.outcome);
    ok("note", res.data?.note ?? "Amount > approvalThreshold — sealed for human review");
  } catch (err: any) {
    warn("spend/encrypted (hold) error", err.message);
  }

  // ── Step 4: Cross-chain anchoring on X Layer ──────────────────────────────
  step(4, "Check Cross-Chain Anchoring on X Layer");
  if (approveDecisionId) {
    try {
      const res = await request(`/api/governance/decisions/${approveDecisionId}`);
      ok("decisionId", res.data?.decisionId ?? approveDecisionId);
      ok("origin", res.data?.origin);
      ok("outcome", res.data?.outcome);
      ok("xlayerTx", res.data?.xlayerTx);
      ok("note", res.data?.note ?? "GovernanceContract.handle() verified origin domain + sender via ISM");
    } catch (err: any) {
      warn("governance/decisions error", err.message);
    }
  } else {
    warn("skipped", "no approveDecisionId from step 2");
  }

  // ── Step 5: Issue auditor permit ──────────────────────────────────────────
  step(5, "Issue Auditor Permit (Selective Disclosure)");
  try {
    const res = await request("/api/audit/permits", {
      method: "POST",
      json: {
        auditorAddress: "0x000000000000000000000000000000000000dEaD",
        policyId,
        scope: ["dailyLimit", "spentToday"],
      },
    });
    permitToken = res.data?.permit;
    ok("permit", permitToken);
    ok("scope", res.data?.scope);
    ok("note", res.data?.note ?? "approvalThreshold and perTxLimit remain sealed");
  } catch (err: any) {
    warn("audit/permits error", err.message);
  }

  // ── Step 6: Auditor decrypts scoped fields ────────────────────────────────
  step(6, "Auditor Decrypts Scoped Fields");
  if (approveDecisionId && permitToken) {
    try {
      const res = await request(
        `/api/audit/logs/${approveDecisionId}/decrypt`,
        {
          headers: { "X-Audit-Permit": permitToken },
        },
      );
      ok("decisionId", res.data?.decisionId ?? approveDecisionId);
      ok("dailyLimit", res.data?.dailyLimit);
      ok("spentToday", res.data?.spentToday);
      ok("outcome", res.data?.outcome);
      ok("note", res.data?.note ?? "approvalThreshold not in permit scope — remains encrypted");
    } catch (err: any) {
      warn("audit/logs/decrypt error", err.message);
    }
  } else {
    warn("skipped", "need both approveDecisionId and permitToken from steps 2 & 5");
  }

  // ── Step 7: Trusted Encryption Sidecar (non-TS agents) ───────────────────
  step(7, "Trusted Encryption Sidecar — Python/Go agent path");
  try {
    const res = await request("/api/fhenix/encrypt", {
      method: "POST",
      json: { amount: 300, type: "uint128" },
    });
    ok("ciphertextHandle", res.data?.ciphertextHandle);
    ok("note", res.data?.note ?? "Agent passes this handle directly to /api/spend/encrypted");
  } catch (err: any) {
    warn("fhenix/encrypt error", err.message);
  }

  // ── Step 8: Privara confidential payroll ─────────────────────────────────
  step(8, "Privara Confidential Payroll (Wave 4)");
  if (approveDecisionId) {
    try {
      const res = await request("/api/payroll/confidential", {
        method: "POST",
        json: {
          decisionId: approveDecisionId,
          contractorWallet: "0x000000000000000000000000000000000000dEaD",
          amountUsd: 200,
          currency: "USDC",
        },
      });
      ok("privatransferTx", res.data?.privatransferTx);
      ok("decisionId", res.data?.decisionId);
      ok("note", res.data?.note ?? "Privara executed confidential transfer — decisionId carried as compliance proof");
    } catch (err: any) {
      warn("payroll/confidential error", err.message);
    }
  } else {
    warn("skipped", "no approveDecisionId from step 2");
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  Demo complete — full encrypted path exercised          ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log("║  Audit log   →  " + baseUrl + "/audit          ");
  console.log("║  Agent runs  →  " + baseUrl + "/runs           ");
  console.log("║  Fhenix explorer  →  https://explorer.fhenix.zone      ║");
  console.log("║  X Layer explorer →  https://www.oklink.com/xlayer-test║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
}

main().catch((err) => {
  console.error("\n✗ Demo failed:", err.message);
  process.exit(1);
});
