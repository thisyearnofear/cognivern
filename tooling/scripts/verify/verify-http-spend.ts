/**
 * Verify the HTTP auth fix by calling POST /api/spend from outside the
 * process with an OWS scoped key. This is the path a real external agent
 * would use.
 *
 * Pre-requisites: backend running on http://localhost:3001 with the auth
 * fix applied; XLAYER_PRIVATE_KEY funded in the backend's environment.
 *
 * What it does:
 *   1. Boot a small in-process OWS vault + policy
 *   2. Create an agent wallet, an active spend policy, and a scoped API key
 *   3. Use those to issue an HTTP POST /api/spend
 *   4. Assert the response includes a real on-chain txHash (not the
 *      fabricated keccak256(signature) fallback) and onChainStatus=recorded
 */

import crypto from "node:crypto";
import { ethers } from "ethers";

import { owsWalletService } from "../../src/backend/services/blockchain/OwsWalletService.js";
import { owsLocalVaultService } from "../../src/backend/services/blockchain/OwsLocalVaultService.js";
import { sharedPolicyService } from "../../src/backend/services/governance/PolicyService.js";
import { blockchainConfig } from "../../src/backend/shared/config/index.js";

const BASE = process.env.COGNIVERN_URL || "http://localhost:3001";
const X_API_KEY = process.env.COGNIVERN_API_KEY || "";

if (!X_API_KEY) {
  console.error("COGNIVERN_API_KEY is required to call /api/spend over HTTP");
  process.exit(1);
}

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: any;
};

async function request<T = any>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init.headers || {});
  if (path.startsWith("/api/")) {
    headers.set("X-API-KEY", X_API_KEY);
  }
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  const text = await res.text();
  return text ? (JSON.parse(text) as ApiEnvelope<T>) : {};
}

function header(label: string) {
  console.log(`\n${"═".repeat(72)}\n  ${label}\n${"═".repeat(72)}`);
}

async function main() {
  header("HTTP auth gap fix — external agent routes spend via /api/spend");

  if (!blockchainConfig.privateKey) {
    throw new Error("XLAYER_PRIVATE_KEY not set in env — backend can't record on-chain");
  }

  // ---- 1. Set up wallet + policy + scoped key in the in-process vault
  const status = await owsLocalVaultService.getStatus();
  console.log(`\n  Local vault: ${status.walletCount} wallets, ${status.apiKeyCount} keys`);

  const agentPk = "0x" + crypto.randomBytes(32).toString("hex");
  const wallet = await owsLocalVaultService.importWallet({
    name: `HTTP verify ${new Date().toISOString()}`,
    privateKey: agentPk,
    chainId: "eip155:1952",
    metadata: { purpose: "http-auth-verify" },
  });

  const policy = await sharedPolicyService.createPolicy(
    `HTTP Verify Policy ${crypto.randomUUID()}`,
    "Allow low-value USDC up to $20",
    [
      {
        id: `rule-allow-${crypto.randomUUID()}`,
        type: "allow",
        condition: "Number(action.metadata.amountUsd || 0) <= 20",
        action: { type: "approve", parameters: {} },
        metadata: { reason: "within low-value allow" },
      },
    ],
  );
  await sharedPolicyService.updatePolicyStatus(policy.id, "active");

  const { token } = await owsLocalVaultService.createApiKey({
    name: `HTTP verify agent ${new Date().toISOString()}`,
    walletIds: [wallet.id],
    policyIds: [policy.id],
    metadata: { agentId: "http-verify-agent" },
  } as any);

  console.log(`\n  wallet  : ${wallet.id} (${wallet.accounts[0]?.address})`);
  console.log(`  policy  : ${policy.id} (active)`);
  console.log(`  api key : ${token.slice(0, 14)}...`);

  // ---- 2. POST /api/spend via HTTP (the path an external agent uses)
  console.log(`\n  POST ${BASE}/api/spend`);
  const intentBody = {
    agentId: "http-verify-agent",
    recipient: "0x1111111111111111111111111111111111111111",
    amount: "12",
    asset: "USDC",
    reason: "External agent HTTP auth-gap verification",
    metadata: {
      walletId: wallet.id,
      policyId: policy.id,
      amountUsd: 12,
      vendor: "stable-email",
      chain: "xlayer",
      purpose: "http_auth_verify",
    },
  };

  const res = await request<{
    intentId: string;
    status: string;
    runId?: string;
    txHash?: string;
    signature?: string;
    onChainStatus?: string;
    policyId?: string;
    error?: string;
    reason?: string;
  }>("/api/spend", {
    method: "POST",
    headers: {
      "x-ows-scoped-access": token,
    },
    json: intentBody,
  });

  console.log("  Response:");
  console.log(`    success      : ${res.success}`);
  console.log(`    status       : ${res.data?.status}`);
  console.log(`    onChainStatus: ${res.data?.onChainStatus ?? "<missing>"}`);
  console.log(`    txHash       : ${res.data?.txHash ?? "<none>"}`);
  console.log(`    signature    : ${(res.data?.signature ?? "<none>").slice(0, 22)}...`);
  console.log(`    runId        : ${res.data?.runId ?? "<none>"}`);

  if (!res.success) {
    throw new Error(
      `HTTP call did not succeed: ${JSON.stringify(res.error ?? res.data)}`,
    );
  }
  if (res.data?.status !== "approved") {
    throw new Error(
      `Expected status=approved, got ${res.data?.status}: ${res.data?.error ?? res.data?.reason}`,
    );
  }
  if (res.data?.onChainStatus !== "recorded") {
    throw new Error(
      `Expected onChainStatus=recorded, got ${res.data?.onChainStatus}. ` +
        `txHash=${res.data?.txHash}. This is the fail-loud behavior — the chain write ` +
        `failed and we no longer fabricate a hash.`,
    );
  }
  if (!res.data?.txHash || !/^0x[0-9a-fA-F]{64}$/.test(res.data.txHash)) {
    throw new Error(`txHash is not a real hex receipt: ${res.data?.txHash}`);
  }

  // ---- 3. Confirm txHash is on-chain
  const provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);
  const receipt = await provider.getTransactionReceipt(res.data.txHash);
  if (!receipt) {
    throw new Error(`txHash ${res.data.txHash} not found on-chain`);
  }
  console.log(`\n  On-chain receipt:`);
  console.log(`    block  : ${receipt.blockNumber}`);
  console.log(`    from   : ${receipt.from}`);
  console.log(`    to     : ${receipt.to}`);
  console.log(`    status : ${receipt.status === 1 ? "success" : "reverted"}`);
  console.log(
    `    explorer: https://www.okx.com/explorer/xlayer-test/tx/${res.data.txHash}`,
  );

  console.log(`\n  Verdict: external agent successfully routed spend via /api/spend`);
  console.log(`           and the on-chain approval record is real.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  });
