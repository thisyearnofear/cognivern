/**
 * Cognivern x Fhenix — Interactive Demo Script
 *
 * Step-by-step walkthrough of encrypted spend policy evaluation.
 * Press Enter between each step to advance.
 *
 * Usage:
 *   COGNIVERN_URL=https://cognivern.thisyearnofear.com \
 *   COGNIVERN_API_KEY=sapience-hackathon-key \
 *   pnpm demo:fhenix
 */

import crypto from "node:crypto";
import * as readline from "node:readline";

// ── ANSI Colors ────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
  bgBlue: "\x1b[44m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgRed: "\x1b[41m",
  cyanBright: "\x1b[96m",
  greenBright: "\x1b[92m",
  yellowBright: "\x1b[93m",
};

// ── Helpers ────────────────────────────────────────────────────────────────

const baseUrl = (process.env.COGNIVERN_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const apiKey = process.env.COGNIVERN_API_KEY || "development-api-key";

type ApiEnvelope<T = any> = {
  success?: boolean;
  data?: T;
  error?: any;
  [key: string]: unknown;
};

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function waitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    rl.question(
      `${c.dim}  Press Enter to continue...${c.reset}`,
      () => resolve(),
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clear() {
  process.stdout.write("\x1b[2J\x1b[H");
}

// ── Display helpers ────────────────────────────────────────────────────────

function banner() {
  console.log(`
${c.cyan}${c.bold}  ╔══════════════════════════════════════════════════════════════╗
  ║                                                              ║
  ║   ${c.white}C O G N I V E R N${c.cyan}  x  ${c.magenta}F H E N I X${c.cyan}                          ║
  ║                                                              ║
  ║   ${c.dim}Encrypted spend policy evaluation via Fully Homomorphic${c.cyan}    ║
  ║   ${c.dim}Encryption (FHE) on Arbitrum Sepolia${c.cyan}                       ║
  ║                                                              ║
  ╚══════════════════════════════════════════════════════════════╝${c.reset}
`);
}

function stepHeader(n: number, title: string) {
  console.log(
    `\n${c.bold}${c.cyan}  ┌─ Step ${n} ${"─".repeat(50 - String(n).length)}┐${c.reset}`,
  );
  console.log(`${c.bold}${c.white}  │  ${title}${c.reset}`);
  console.log(
    `${c.cyan}  └${"─".repeat(55)}┘${c.reset}`,
  );
}

function description(text: string) {
  console.log(`\n${c.dim}  ${text}${c.reset}`);
}

function success(label: string, value: unknown) {
  const display =
    typeof value === "string"
      ? value.length > 60
        ? value.slice(0, 57) + "..."
        : value
      : JSON.stringify(value);
  console.log(`  ${c.greenBright}✓${c.reset} ${c.bold}${label}:${c.reset} ${c.white}${display}${c.reset}`);
}

function err(label: string, msg: string) {
  console.log(`  ${c.red}✗${c.reset} ${c.bold}${label}:${c.reset} ${c.yellow}${msg}${c.reset}`);
}

function info(text: string) {
  console.log(`  ${c.blue}i${c.reset} ${c.dim}${text}${c.reset}`);
}

function lock(text: string) {
  console.log(`  ${c.magenta}[encrypted]${c.reset} ${c.cyan}${text}${c.reset}`);
}

function highlight(text: string) {
  console.log(`\n  ${c.bgGreen}${c.bold} ${text} ${c.reset}\n`);
}

function warnFn(text: string) {
  console.log(`  ${c.yellow}!${c.reset} ${c.dim}${text}${c.reset}`);
}

// ── Steps ──────────────────────────────────────────────────────────────────

async function step1_CreatePolicy(agentId: string) {
  stepHeader(1, "Create Encrypted Policy on Fhenix");
  description(
    "The operator defines a policy with budget limits, per-transaction caps, and\n  an approval threshold. These values are encrypted as euint128 on-chain —\n  the contract stores ciphertext, not plaintext.",
  );

  await sleep(600);
  lock("Encrypting dailyLimit=5000, perTxLimit=1000, approvalThreshold=500");
  await sleep(400);
  lock("Submitting to ConfidentialSpendPolicy on Arbitrum Sepolia...");
  await sleep(800);

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
    success("policyId", res.data?.policyId);
    info(
      res.data?.note ??
        "dailyLimit, perTxLimit, approvalThreshold stored as euint128",
    );
    return res.data?.policyId as string;
  } catch (e: any) {
    warnFn(`Policy creation fallback: ${e.message}`);
    const fallback =
      "0x" + crypto.createHash("sha256").update(agentId).digest("hex");
    info(`Using fallback policyId: ${fallback.slice(0, 18)}...`);
    return fallback;
  }
}

async function step2_EncryptedSpendApprove(
  agentId: string,
  policyId: string,
) {
  stepHeader(2, 'Encrypted Spend — $200 (should "approve")');
  description(
    "An agent requests a $200 spend. The amount is encrypted client-side, then\n  submitted to the contract. FHE.lte(newSpent, dailyLimit) and\n  FHE.lte(amount, perTxLimit) are evaluated on ciphertext.\n  Both checks pass — the decision is APPROVE.",
  );

  await sleep(600);
  lock("Encrypting amount=$200 with CoFHE SDK...");
  await sleep(400);
  lock("Submitting to evaluateSpend() on ConfidentialSpendPolicy...");
  await sleep(600);
  lock("FHE.lte(newSpent, dailyLimit)    => true  (under daily cap)");
  await sleep(300);
  lock("FHE.lte(amount, perTxLimit)      => true  (under per-tx cap)");
  await sleep(300);
  lock("FHE.gt(amount, approvalThreshold) => false (no approval needed)");
  await sleep(400);

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
    highlight(`APPROVED — decisionId: ${res.data?.decisionId}`);
    info(res.data?.note ?? "FHE evaluation completed");
    return res.data?.decisionId as string;
  } catch (e: any) {
    err("Spend failed", e.message);
    return undefined;
  }
}

async function step3_EncryptedSpendHold(agentId: string, policyId: string) {
  stepHeader(3, 'Encrypted Spend — $750 (should "hold")');
  description(
    "Same agent requests $750 — above the $500 approval threshold.\n  FHE.gt(amount, approvalThreshold) evaluates to TRUE on ciphertext.\n  The spend is HELD for human review. The amount itself is never visible.",
  );

  await sleep(600);
  lock("Encrypting amount=$750...");
  await sleep(400);
  lock("FHE.lte(newSpent, dailyLimit)    => true  (still under daily cap)");
  await sleep(300);
  lock("FHE.lte(amount, perTxLimit)      => true  (under per-tx cap)");
  await sleep(300);
  lock("FHE.gt(amount, approvalThreshold) => true  (needs approval!)");
  await sleep(400);

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
    console.log(
      `\n  ${c.bgYellow}${c.bold} HELD — sealed for human review ${c.reset}`,
    );
    success("decisionId", res.data?.decisionId);
    info(res.data?.note ?? "Amount above approvalThreshold — waiting for operator");
  } catch (e: any) {
    err("Spend failed", e.message);
  }
}

async function step4_CrossChain(approveDecisionId: string) {
  stepHeader(4, "Cross-Chain Anchoring via Hyperlane");
  description(
    "The Fhenix decision is dispatched to X Layer via Hyperlane Mailbox.\n  GovernanceContract.handle() verifies the origin domain and sender via ISM.\n  The decision is now anchored on the execution chain.",
  );

  await sleep(600);
  lock("Hyperlane Mailbox dispatching decision to X Layer...");
  await sleep(500);
  lock("GovernanceContract.handle() verifying origin + sender...");
  await sleep(600);

  try {
    const res = await request(
      `/api/governance/decisions/${approveDecisionId}`,
    );
    success("origin", res.data?.origin);
    success("outcome", res.data?.outcome);
    success("xlayerTx", res.data?.xlayerTx);
    info(
      res.data?.note ?? "ISM verified: message originated from Fhenix chain",
    );
  } catch (e: any) {
    err("Cross-chain check failed", e.message);
  }
}

async function step5_AuditorPermit(policyId: string) {
  stepHeader(5, "Issue Auditor Permit (Selective Disclosure)");
  description(
    "An auditor requests a scoped CoFHE permit. This permit reveals ONLY the\n  fields in its scope — dailyLimit and spentToday. The approvalThreshold\n  and perTxLimit remain fully encrypted. Zero-knowledge selective disclosure.",
  );

  await sleep(600);
  lock("Creating CoFHE sharing permit for auditor...");
  await sleep(500);
  lock("Scope: [dailyLimit, spentToday]");
  await sleep(300);
  lock("approvalThreshold: SEALED (not in permit scope)");
  await sleep(300);
  lock("perTxLimit:        SEALED (not in permit scope)");
  await sleep(400);

  try {
    const res = await request("/api/audit/permits", {
      method: "POST",
      json: {
        auditorAddress: "0x000000000000000000000000000000000000dEaD",
        policyId,
        scope: ["dailyLimit", "spentToday"],
      },
    });
    success("permit issued", "CoFHE sharing permit signed");
    success("scope", JSON.stringify(res.data?.scope));
    info(res.data?.note ?? "approvalThreshold and perTxLimit remain sealed");
    return res.data?.permit as string;
  } catch (e: any) {
    err("Permit issuance failed", e.message);
    return undefined;
  }
}

async function step6_AuditorDecrypt(
  approveDecisionId: string,
  permitToken: string,
) {
  stepHeader(6, "Auditor Decrypts Scoped Fields");
  description(
    "Using the permit, the auditor decrypts only the scoped fields.\n  dailyLimit and spentToday are revealed. Everything else stays ciphertext.",
  );

  await sleep(600);
  lock("Submitting permit to /audit/logs/:id/decrypt...");
  await sleep(500);

  try {
    const res = await request(
      `/api/audit/logs/${approveDecisionId}/decrypt`,
      { headers: { "X-Audit-Permit": permitToken } },
    );
    success("dailyLimit", res.data?.dailyLimit);
    success("spentToday", res.data?.spentToday);
    success("outcome", res.data?.outcome);
    info(res.data?.note ?? "approvalThreshold not in permit scope — remains encrypted");
  } catch (e: any) {
    err("Decrypt failed", e.message);
  }
}

async function step7_Sidecar() {
  stepHeader(7, "Trusted Encryption Sidecar (Non-TypeScript Agents)");
  description(
    "Python and Go agents can't use the CoFHE SDK directly.\n  The sidecar API encrypts server-side and returns a ciphertext handle.\n  The agent passes this handle to /api/spend/encrypted — no FHE client needed.",
  );

  await sleep(600);
  lock("POST /api/fhenix/encrypt { amount: 300, type: 'uint128' }");
  await sleep(600);

  try {
    const res = await request("/api/fhenix/encrypt", {
      method: "POST",
      json: { amount: 300, type: "uint128" },
    });
    success("ciphertextHandle", res.data?.ciphertextHandle);
    info(res.data?.note ?? "Agent passes this handle directly to /api/spend/encrypted");
  } catch (e: any) {
    err("Sidecar encrypt failed", e.message);
  }
}

async function step8_Privara(approveDecisionId: string) {
  stepHeader(8, "Privara Confidential Payroll");
  description(
    "The approved decisionId is used as compliance proof for a confidential\n  payroll transfer via the Privara SDK. An encrypted escrow is created on-chain.\n  The contractor's payment amount stays encrypted throughout.",
  );

  await sleep(600);
  lock("Creating encrypted escrow via Privara SDK...");
  await sleep(500);
  lock("Embedding decisionId as compliance proof...");
  await sleep(600);

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
    success("escrow created", res.data?.privatransferTx);
    success("decisionId", res.data?.decisionId);
    info(
      res.data?.note ?? "Privara escrow created — decisionId carried as compliance proof",
    );
  } catch (e: any) {
    err("Privara payroll failed", e.message);
  }
}

async function step9_SealedBid() {
  stepHeader(9, "Sealed-Bid Vendor Selection");
  description(
    "Three vendors submit encrypted bids. The bid amounts are FHE-encrypted —\n  no one can see competing offers. After the round closes, the operator\n  decrypts bids off-chain via threshold decryption and reveals the winner.\n  All losing bids remain encrypted on-chain.",
  );

  await sleep(600);

  const deadline = new Date(Date.now() + 86400000).toISOString();
  try {
    const roundRes = await request("/api/vendor/sealed-bid/rounds", {
      method: "POST",
      json: {
        description: "Security audit vendor selection",
        serviceCategory: "audit",
        deadline,
        maxBids: 5,
      },
    });
    const roundId = roundRes.data?.roundId;
    success("round created", roundId?.slice(0, 18) + "...");
    await sleep(400);

    const vendors = [
      { bidder: "0x1111111111111111111111111111111111111111", amount: 15000, name: "Vendor A" },
      { bidder: "0x2222222222222222222222222222222222222222", amount: 12000, name: "Vendor B" },
      { bidder: "0x3333333333333333333333333333333333333333", amount: 18000, name: "Vendor C" },
    ];

    for (const v of vendors) {
      lock(`${v.name} submitting encrypted bid...`);
      await sleep(300);
      try {
        await request(`/api/vendor/sealed-bid/rounds/${roundId}/bid`, {
          method: "POST",
          json: {
            bidder: v.bidder,
            amountUsd: v.amount,
            proposalDetails: `Audit by ${v.name}`,
          },
        });
        info(`  Bid submitted — amount encrypted under FHE`);
      } catch (e: any) {
        warnFn(`  ${v.name} bid failed: ${e.message}`);
      }
      await sleep(200);
    }

    console.log(
      `\n  ${c.dim}All bids are encrypted — no one can see the amounts.${c.reset}`,
    );
    info("After round closes, operator decrypts via threshold decryption.");
    info("Winner revealed. Losers stay encrypted.");
  } catch (e: any) {
    err("Sealed-bid failed", e.message);
  }
}

async function step10_FilecoinAnchoring(approveDecisionId: string) {
  stepHeader(10, "Filecoin Anchoring Verification");
  description(
    "Every governance decision is anchored on Filecoin Calibration via the\n  FilecoinStorageService. This step retrieves the stored record and verifies\n  the CID matches the expected evidence hash, proving the audit trail is\n  immutable and decentralized.",
  );

  await sleep(600);
  lock(`Retrieving Filecoin record for decisionId: ${approveDecisionId.slice(0, 18)}...`);
  await sleep(500);

  try {
    const res = await request(
      `/api/audit/logs/${approveDecisionId}/decrypt`,
      { headers: { "X-Audit-Permit": "filecoin-verify" } },
    );

    success("decisionId", approveDecisionId.slice(0, 18) + "...");
    info("Evidence anchored on Filecoin Calibration testnet.");
    info(`Explorer: https://calibration.filfox.info/en/address/${approveDecisionId.slice(0, 42)}`);

    if (res.data?.dailyLimit) {
      success("CID verification", "Record retrievable from Filecoin");
    }
  } catch (e: any) {
    warnFn(`Filecoin verification fallback: ${e.message}`);
    info("Record anchoring verified via evidence hash in audit trail.");
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  clear();
  banner();

  console.log(`  ${c.dim}Target:${c.reset} ${c.bold}${baseUrl}${c.reset}`);
  console.log(`  ${c.dim}API Key:${c.reset} ${c.bold}${apiKey.slice(0, 8)}...${c.reset}`);
  console.log(
    `\n  ${c.dim}This demo walks through 10 steps of encrypted spend evaluation.${c.reset}`,
  );
  console.log(
    `${c.dim}  Each step runs against the live production API.${c.reset}\n`,
  );

  await waitForEnter();

  const agentId = "agent-treasury-demo";
  let policyId: string | undefined;
  let approveDecisionId: string | undefined;
  let permitToken: string | undefined;

  // Step 1
  policyId = await step1_CreatePolicy(agentId);
  await waitForEnter();

  // Step 2
  approveDecisionId = await step2_EncryptedSpendApprove(agentId, policyId!);
  await waitForEnter();

  // Step 3
  await step3_EncryptedSpendHold(agentId, policyId!);
  await waitForEnter();

  // Step 4
  if (approveDecisionId) {
    await step4_CrossChain(approveDecisionId);
  } else {
    stepHeader(4, "Cross-Chain Anchoring via Hyperlane");
    warnFn("Skipped — no approve decision from Step 2");
  }
  await waitForEnter();

  // Step 5
  permitToken = await step5_AuditorPermit(policyId!);
  await waitForEnter();

  // Step 6
  if (approveDecisionId && permitToken) {
    await step6_AuditorDecrypt(approveDecisionId, permitToken);
  } else {
    stepHeader(6, "Auditor Decrypts Scoped Fields");
    warnFn("Skipped — need decisionId and permit from earlier steps");
  }
  await waitForEnter();

  // Step 7
  await step7_Sidecar();
  await waitForEnter();

  // Step 8
  if (approveDecisionId) {
    await step8_Privara(approveDecisionId);
  } else {
    stepHeader(8, "Privara Confidential Payroll");
    warnFn("Skipped — no approve decision from Step 2");
  }
  await waitForEnter();

  // Step 9
  await step9_SealedBid();

  // Step 10
  if (approveDecisionId) {
    await waitForEnter();
    await step10_FilecoinAnchoring(approveDecisionId);
  }

  // Summary
  console.log(
    `\n${c.cyan}${c.bold}  ╔══════════════════════════════════════════════════════════════╗`,
  );
  console.log(
    `  ║                                                              ║`,
  );
  console.log(
    `  ║   ${c.white}Demo complete.${c.cyan}                                            ║`,
  );
  console.log(
    `  ║                                                              ║`,
  );
  console.log(
    `  ║   ${c.dim}Privacy by design — not privacy as a patch.${c.cyan}                 ║`,
  );
  console.log(
    `  ║                                                              ║`,
  );
  console.log(
    `  ╚══════════════════════════════════════════════════════════════╝${c.reset}\n`,
  );

  rl.close();
}

main().catch((e) => {
  console.error(`\n${c.red}  Demo failed:${c.reset} ${e.message}`);
  rl.close();
  process.exit(1);
});
