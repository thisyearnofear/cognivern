/**
 * Project A verification: end-to-end governed spend that records a real
 * approval-record tx on X Layer testnet.
 *
 * Why this script instead of demo-live.ts over HTTP:
 *   - demo-live.ts runs the same OwsWalletService.executeSpend path, but over
 *     HTTP where /api/spend is gated by a JWT auth middleware. The fix we are
 *     verifying lives one layer below: SpendController reads
 *     `x-ows-scoped-access` from request headers and forwards it as
 *     `apiKeyToken` to owsWalletService.executeSpend. The previous
 *     `X-OWS-API-KEY` header meant the token never reached the wallet
 *     service, access resolved to null, and handleApprove short-circuited to
 *     "held" before recordOnChainApproval was ever called.
 *   - Calling the service directly with a real apiKeyToken exercises the
 *     exact code path the header fix unblocks, and bypasses unrelated HTTP
 *     auth machinery.
 *
 * Pre-requisites (asserted in script):
 *   - XLAYER_PRIVATE_KEY in env, funding the ops account
 *   - XLAYER_GOVERNANCE_CONTRACT_ADDRESS set (or default 0x7556...2DD6)
 *
 * What it produces:
 *   - A real on-chain `evaluateAction` tx (call from the ops key to the live
 *     GovernanceContract) when XLAYER_PRIVATE_KEY is set and funded.
 *   - Otherwise the same script asserts the fake-hash fallback is reachable
 *     so the difference is observable.
 */

import crypto from "node:crypto";
import { ethers } from "ethers";

import { owsWalletService } from "../../src/backend/services/blockchain/OwsWalletService.js";
import { owsLocalVaultService } from "../../src/backend/services/blockchain/OwsLocalVaultService.js";
import { sharedPolicyService } from "../../src/backend/services/governance/PolicyService.js";
import { blockchainConfig } from "../../src/backend/shared/config/index.js";

type VerificationResult = {
  status: string;
  policyId?: string;
  walletId?: string;
  apiKeyId?: string;
  apiKeyToken?: string;
  intentId?: string;
  runId?: string;
  txHash?: string;
  signature?: string;
  onChainStatus?: string;
  source: "direct-service-call";
  note: string;
};

function header(label: string) {
  console.log(`\n${"═".repeat(72)}\n  ${label}\n${"═".repeat(72)}`);
}

function step(n: number, msg: string) {
  console.log(`\n  [${n}] ${msg}`);
}

function ok(msg: string) {
  console.log(`     OK  ${msg}`);
}

function fail(msg: string): never {
  console.error(`     FAIL  ${msg}`);
  throw new Error(msg);
}

async function main() {
  header("Project A: verified on-chain approval-record on X Layer testnet");

  if (!blockchainConfig.privateKey) {
    fail(
      "XLAYER_PRIVATE_KEY is not set. Add it to .env or export it. " +
        "Without it, the fake-hash fallback in OwsWalletService.ts:343 will kick in and you cannot tell if the on-chain path works.",
    );
  }

  const opsWallet = new ethers.Wallet(blockchainConfig.privateKey);
  const provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);
  const net = await provider.getNetwork();
  const opsBalance = await provider.getBalance(opsWallet.address);

  console.log(`\n  X Layer ops account : ${opsWallet.address}`);
  console.log(`  RPC chainId         : ${net.chainId.toString()}`);
  console.log(`  OKB balance         : ${ethers.formatEther(opsBalance)}`);
  console.log(`  Governance contract : ${blockchainConfig.contracts.governance}`);

  if (opsBalance === 0n) {
    fail("Ops account has 0 OKB — cannot pay for evaluateAction gas on testnet.");
  }

  step(1, "Bootstrap OWS local vault");
  const status = await owsLocalVaultService.getStatus();
  console.log(
    `     vault: ${status.walletCount} wallets, ${status.apiKeyCount} api keys, path=${status.vaultPath}`,
  );

  step(2, "Create agent wallet, policy, and scoped API key in vault");
  const agentPk = "0x" + crypto.randomBytes(32).toString("hex");
  const wallet = await owsLocalVaultService.importWallet({
    name: `Project A agent ${new Date().toISOString()}`,
    privateKey: agentPk,
    chainId: "eip155:1952",
    metadata: { purpose: "project-a-verification" },
  });
  ok(`wallet ${wallet.id} (${wallet.accounts[0]?.address})`);

  const policy = await sharedPolicyService.createPolicy(
    `Project A Spend Policy ${crypto.randomUUID()}`,
    "Allow low-value USDC up to $20",
    [
      {
        id: `rule-allow-${crypto.randomUUID()}`,
        type: "allow",
        condition: "Number(action.metadata.amountUsd || 0) <= 20",
        action: { type: "approve", parameters: {} },
        metadata: { reason: "within low-value allow" },
      },
      {
        id: `rule-deny-${crypto.randomUUID()}`,
        type: "deny",
        condition: "Number(action.metadata.amountUsd || 0) > 20",
        action: {
          type: "block",
          parameters: { reason: "above $20" },
        },
        metadata: { reason: "above threshold" },
      },
    ],
  );
  await sharedPolicyService.updatePolicyStatus(policy.id, "active");
  ok(`policy ${policy.id} (active, ${policy.rules.length} rules)`);

  const { apiKey, token } = await owsLocalVaultService.createApiKey({
    name: `Project A agent ${new Date().toISOString()}`,
    walletIds: [wallet.id],
    policyIds: [policy.id],
    metadata: { agentId: "project-a-agent" },
  } as any);
  ok(`api key ${apiKey.id} (token len ${token.length})`);

  step(3, "Resolve access with the scoped token (this is what the header fix unblocks)");
  const access = await owsLocalVaultService.resolveAccess({
    walletId: wallet.id,
    apiKeyToken: token,
  });
  if (!access) {
    fail("resolveAccess returned null with a fresh token. Vault wiring broken.");
  }
  if (!access.wallet || access.wallet.id !== wallet.id) {
    fail(`resolveAccess returned wrong wallet: ${access.wallet?.id}`);
  }
  if (!access.apiKey || access.apiKey.id !== apiKey.id) {
    fail(`resolveAccess returned wrong api key: ${access.apiKey?.id}`);
  }
  ok(`access resolved for wallet ${access.wallet.id} + key ${access.apiKey.id}`);

  step(4, "Build spend intent and call owsWalletService.executeSpend with apiKeyToken");
  const intent = {
    id: `spend-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    agentId: "project-a-agent",
    recipient: "0x1111111111111111111111111111111111111111",
    amount: "12",
    asset: "USDC",
    reason: "Project A end-to-end on-chain verification",
    metadata: {
      walletId: wallet.id,
      policyId: policy.id,
      amountUsd: 12,
      vendor: "stable-email",
      chain: "xlayer",
      purpose: "project_a_verify",
    },
  } as any;

  const result = await owsWalletService.executeSpend(intent, {
    apiKeyToken: token,
    walletId: wallet.id,
  });

  console.log("\n     executeSpend result:");
  console.log(`       status       : ${result.status}`);
  console.log(`       policyId     : ${result.policyId ?? "<none>"}`);
  console.log(`       walletId     : ${result.walletId ?? "<none>"}`);
  console.log(`       walletAddress: ${result.walletAddress ?? "<none>"}`);
  console.log(`       txHash       : ${result.txHash ?? "<none>"}`);
  console.log(`       signature    : ${(result.signature ?? "<none>").slice(0, 22)}...`);

  if (result.status !== "approved") {
    fail(
      `Expected status=approved with the fix, got ${result.status}. ` +
        `If this is "held" or "denied", the policy/agent/wallet/key wiring is wrong.`,
    );
  }
  if (!result.txHash) {
    fail("Approved result has no txHash. recordOnChainApproval returned nothing.");
  }

  step(5, "Classify the txHash (real on-chain receipt vs fake-hash fallback)");
  const isHex64 = /^0x[0-9a-fA-F]{64}$/.test(result.txHash);
  console.log(`       hex 64?      : ${isHex64}`);
  let receipt: ethers.TransactionReceipt | null = null;
  if (isHex64) {
    try {
      receipt = await provider.getTransactionReceipt(result.txHash);
    } catch (e: any) {
      console.log(`       receipt err  : ${e.message}`);
    }
  }
  if (receipt) {
    console.log(`       block        : ${receipt.blockNumber}`);
    console.log(`       from         : ${receipt.from}`);
    console.log(`       to           : ${receipt.to}`);
    console.log(`       status       : ${receipt.status === 1 ? "success" : "reverted"}`);
    console.log(
      `       explorer     : https://www.okx.com/explorer/xlayer-test/tx/${result.txHash}`,
    );
  } else {
    console.log(
      `       receipt      : <not found on-chain — this is the fake-hash fallback>`,
    );
  }

  const isRealOnChain =
    !!receipt && receipt.from.toLowerCase() === opsWallet.address.toLowerCase();
  const usedFallback = !isRealOnChain;

  step(6, "Verdict");
  const verdict = {
    headerFixUnblocksOnChainPath: !!access && isRealOnChain,
    realOnChainTxRecorded: isRealOnChain,
    fakeHashFallbackUsed: usedFallback,
    txHash: result.txHash,
    explorerUrl: receipt
      ? `https://www.okx.com/explorer/xlayer-test/tx/${result.txHash}`
      : null,
  };
  console.log(JSON.stringify(verdict, null, 2));

  const out: VerificationResult = {
    status: result.status,
    policyId: policy.id,
    walletId: wallet.id,
    apiKeyId: apiKey.id,
    apiKeyToken: token,
    intentId: intent.id,
    runId: result.runId,
    txHash: result.txHash,
    signature: result.signature,
    onChainStatus: isRealOnChain ? "recorded" : usedFallback ? "offline" : "unknown",
    source: "direct-service-call",
    note: usedFallback
      ? "ops account has no OKB or RPC is down; OwsWalletService.ts:343 fabricated a keccak256(signature) hash and returned approved. The on-chain governance record was NOT recorded."
      : "real evaluateAction tx confirmed on X Layer testnet via ops account",
  };

  console.log("\n     Result JSON:");
  console.log(JSON.stringify(out, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  });
