#!/usr/bin/env tsx
/**
 * KeeperHub-routed rebalance demo.
 *
 * Drives a single Sapience agent rebalance through the policy engine,
 * broadcasts the value transfer via KeeperHub, and persists the receipt
 * for the KeeperHub — Agents Onchain hackathon submission.
 *
 * Usage:
 *   pnpm tsx scripts/demo/run-keeperhub-rebalance.ts \
 *     --wallet-id $WALLET_ID \
 *     --recipient 0xRecipient \
 *     --amount-wei 1000000000000000 \
 *     --reason "Aave v3 health factor 1.42 < 1.5" \
 *     --output .artifacts/keeperhub-rebalance.json
 *
 * Reads:
 *   - COGNIVERN_API_KEY  (optional) - API key for /api/governance/evaluate fallback
 *   - KEEPERHUB_API_KEY  (required) - KeeperHub Direct Execution API key
 *
 * Writes (.artifacts/keeperhub-rebalance.json):
 *   {
 *     intentId, runId, transferTxHash, txHash, traceId,
 *     policyId, status, executionProvider, executedAt
 *   }
 *
 * The submission form requires a real onchain receipt; the transferTxHash
 * field is the one that links to that receipt.
 */

import { parseArgs } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  SapienceTradingAgent,
} from "@backend/modules/agents/implementations/SapienceTradingAgent.js";
import type {
  TradingAgentConfig,
} from "@backend/modules/agents/types/TradingAgent.js";

interface CliArgs {
  walletId: string;
  recipient: string;
  amountWei: string;
  reason: string;
  output: string;
  policyId?: string;
  dryRun: boolean;
}

function parseCliArgs(): CliArgs {
  const parsed = parseArgs({
    options: {
      "wallet-id": { type: "string" },
      "recipient": { type: "string" },
      "amount-wei": { type: "string" },
      "reason": { type: "string" },
      "output": { type: "string", default: ".artifacts/keeperhub-rebalance.json" },
      "policy-id": { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  const opts = parsed.values;
  if (!opts["wallet-id"]) {
    throw new Error("--wallet-id is required");
  }
  if (!opts.recipient) {
    throw new Error("--recipient is required");
  }
  if (!opts["amount-wei"]) {
    throw new Error("--amount-wei is required");
  }
  if (!opts.reason) {
    throw new Error("--reason is required");
  }
  return {
    walletId: opts["wallet-id"] as string,
    recipient: opts.recipient as string,
    amountWei: opts["amount-wei"] as string,
    reason: opts.reason as string,
    output: (opts.output as string) || ".artifacts/keeperhub-rebalance.json",
    policyId: opts["policy-id"] as string | undefined,
    dryRun: Boolean(opts["dry-run"]),
  };
}

async function main() {
  const args = parseCliArgs();
  if (!/^0x[0-9a-fA-F]{40}$/.test(args.recipient)) {
    throw new Error(`Invalid recipient address: ${args.recipient}`);
  }
  let amountWei: bigint;
  try {
    amountWei = BigInt(args.amountWei);
  } catch {
    throw new Error(`Invalid --amount-wei: ${args.amountWei}`);
  }
  if (amountWei <= 0n) {
    throw new Error(`--amount-wei must be positive (got ${amountWei})`);
  }
  if (!process.env.KEEPERHUB_API_KEY && !args.dryRun) {
    throw new Error(
      "KEEPERHUB_API_KEY is not set. Either set it or pass --dry-run to skip the broadcast.",
    );
  }

  const agentConfig: TradingAgentConfig = {
    apiKey: process.env.COGNIVERN_API_KEY,
    maxTradeSize: 0,
    riskTolerance: 0.1,
    tradingPairs: [],
    strategies: [],
    governanceRules: [],
  };
  const agent = new SapienceTradingAgent("keeperhub-rebalance-demo", agentConfig);
  await agent.initialize();
  await agent.start();

  console.log("[rebalance] invoking Sapience agent → KeeperHub pipeline");
  console.log(`  wallet:        ${args.walletId}`);
  console.log(`  recipient:     ${args.recipient}`);
  console.log(`  amount (wei):  ${amountWei.toString()}`);
  console.log(`  reason:        ${args.reason}`);
  console.log(`  policy:        ${args.policyId || "sapience-trading-policy"}`);
  console.log(`  mode:          ${args.dryRun ? "dry-run" : "broadcast"}`);

  const result = await agent.runKeeperHubRebalanceCycle({
    walletId: args.walletId,
    recipient: args.recipient,
    amountWei,
    reason: args.reason,
    policyId: args.policyId,
  });

  const executedAt = new Date().toISOString();
  if (!result.ok) {
    console.error(`[rebalance] FAILED: ${result.error}`);
    if (result.traceId) {
      console.error(`  traceId: ${result.traceId}`);
    }
    const failureReceipt = {
      ok: false,
      error: result.error,
      traceId: result.traceId,
      executedAt,
    };
    await fs.mkdir(path.dirname(args.output), { recursive: true });
    await fs.writeFile(args.output, JSON.stringify(failureReceipt, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(`[rebalance] status: ${result.status}`);
  if (result.traceId) console.log(`  traceId:        ${result.traceId}`);
  if (result.runId) console.log(`  runId:          ${result.runId}`);
  if (result.policyId) console.log(`  policyId:       ${result.policyId}`);
  if (result.transferTxHash) {
    console.log(`  transferTxHash: ${result.transferTxHash}`);
  }
  if (result.txHash) {
    console.log(`  onchain audit:  ${result.txHash}`);
  }

  const receipt = {
    ok: true,
    intentId: result.intentId,
    runId: result.runId,
    transferTxHash: result.transferTxHash,
    txHash: result.txHash,
    traceId: result.traceId,
    policyId: result.policyId,
    status: result.status,
    executionProvider: result.executionProvider,
    executedAt,
  };

  await fs.mkdir(path.dirname(args.output), { recursive: true });
  await fs.writeFile(args.output, JSON.stringify(receipt, null, 2));
  console.log(`[rebalance] receipt written to ${args.output}`);

  await agent.shutdown();
}

main().catch((error) => {
  console.error("[rebalance] unhandled error:", error);
  process.exit(1);
});
