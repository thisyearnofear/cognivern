#!/usr/bin/env tsx
/**
 * KeeperHub-routed rebalance demo.
 *
 * Drives a single Sapience agent rebalance through the policy engine,
 * broadcasts the value transfer via KeeperHub, and persists the receipt
 * for the KeeperHub — Agents Onchain hackathon submission.
 *
 * Usage:
 *   pnpm tsx tooling/scripts/demo/run-keeperhub-rebalance.ts \
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
 *     intentId, runId, transferTxHash, transferExecutionId, txHash,
 *     traceId, policyId, status, executionProvider, chainId, explorerUrl,
 *     executedAt
 *   }
 *
 * The submission form requires a real onchain receipt; the transferTxHash
 * field is the one that links to that receipt.
 */

import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ethers } from 'ethers';
import type { TradingAgentConfig } from '@backend/modules/agents/types/TradingAgent.js';

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
      'wallet-id': { type: 'string' },
      recipient: { type: 'string' },
      'amount-wei': { type: 'string' },
      reason: { type: 'string' },
      output: { type: 'string', default: '.artifacts/keeperhub-rebalance.json' },
      'policy-id': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  const opts = parsed.values;
  if (!opts['wallet-id']) {
    throw new Error('--wallet-id is required');
  }
  if (!opts.recipient) {
    throw new Error('--recipient is required');
  }
  if (!opts['amount-wei']) {
    throw new Error('--amount-wei is required');
  }
  if (!opts.reason) {
    throw new Error('--reason is required');
  }
  return {
    walletId: opts['wallet-id'] as string,
    recipient: opts.recipient as string,
    amountWei: opts['amount-wei'] as string,
    reason: opts.reason as string,
    output: (opts.output as string) || '.artifacts/keeperhub-rebalance.json',
    policyId: opts['policy-id'] as string | undefined,
    dryRun: Boolean(opts['dry-run']),
  };
}

async function verifyArbitrumSepoliaReceipt(params: {
  txHash: string;
  recipient: string;
  sender: string;
  valueWei: bigint;
}) {
  const rpcUrl =
    process.env.ARBITRUM_SEPOLIA_RPC_URL ||
    process.env.FHENIX_RPC_URL ||
    'https://sepolia-rollup.arbitrum.io/rpc';
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  if (network.chainId !== 421614n) {
    throw new Error(
      `Receipt verification RPC is not Arbitrum Sepolia (chain ${network.chainId.toString()})`,
    );
  }
  const receipt = await provider.waitForTransaction(params.txHash, 1, 15_000);
  if (!receipt) {
    throw new Error(`No confirmed receipt found for ${params.txHash}`);
  }
  const transaction = await provider.getTransaction(params.txHash);
  const recipientMatches = transaction?.to?.toLowerCase() === params.recipient.toLowerCase();
  const valueMatches = transaction?.value === params.valueWei;
  const senderMatches = transaction?.from?.toLowerCase() === params.sender.toLowerCase();
  if (receipt.status !== 1 || !recipientMatches || !valueMatches || !senderMatches) {
    throw new Error(
      `Receipt verification failed: status=${receipt.status}, senderMatches=${senderMatches}, recipientMatches=${recipientMatches}, valueMatches=${valueMatches}`,
    );
  }
  return {
    outcome: 'verified' as const,
    network: 'arbitrum-sepolia',
    chainId: 421614,
    blockNumber: receipt.blockNumber,
    receiptStatusOk: receipt.status === 1,
    sender: transaction?.from,
    senderMatches,
    recipientMatches,
    valueMatches,
    rpcUrl,
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
      'KEEPERHUB_API_KEY is not set. Either set it or pass --dry-run to skip the broadcast.',
    );
  }

  console.log('[rebalance] invoking Sapience agent → KeeperHub pipeline');
  console.log(`  wallet:        ${args.walletId}`);
  console.log(`  recipient:     ${args.recipient}`);
  console.log(`  amount (wei):  ${amountWei.toString()}`);
  console.log(`  reason:        ${args.reason}`);
  console.log(`  policy:        ${args.policyId || 'sapience-trading-policy'}`);
  console.log(`  mode:          ${args.dryRun ? 'dry-run (no broadcast)' : 'broadcast'}`);

  if (args.dryRun) {
    console.log(
      '[rebalance] dry-run validated inputs and configuration; no agent or wallet execution was attempted.',
    );
    return;
  }

  const { SapienceTradingAgent } = await import(
    '@backend/modules/agents/implementations/SapienceTradingAgent.js'
  );

  const agentConfig: TradingAgentConfig = {
    apiKey: process.env.COGNIVERN_API_KEY,
    maxTradeSize: 0,
    riskTolerance: 0.1,
    tradingPairs: [],
    strategies: [],
    governanceRules: [],
  };
  const agent = new SapienceTradingAgent('keeperhub-rebalance-demo', agentConfig);
  await agent.initialize();
  await agent.start();

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
  if (result.transferExecutionId) {
    console.log(`  executionId:     ${result.transferExecutionId}`);
  }
  if (result.txHash) {
    console.log(`  onchain audit:  ${result.txHash}`);
  }
  if (result.transferTransactionLink) {
    console.log(`  transactionLink: ${result.transferTransactionLink}`);
  }
  if (result.transferReceiptStatus) {
    console.log(`  receipt status:  ${result.transferReceiptStatus}`);
  }
  if (result.transferVerified !== undefined) {
    console.log(`  receipt verified: ${result.transferVerified}`);
  }
  if (result.transferSponsored !== undefined) {
    console.log(`  sponsored:       ${result.transferSponsored}`);
  }

  if (
    result.status !== 'approved' ||
    !result.transferTxHash ||
    !/^0x[0-9a-fA-F]{64}$/.test(result.transferTxHash) ||
    !result.transferExecutionId ||
    result.transferChainId !== 421614
  ) {
    throw new Error(
      'Refusing to write successful submission evidence: expected approved KeeperHub execution with a real 32-byte Arbitrum Sepolia transaction hash, executionId, and chainId.',
    );
  }

  const reportedSender = result.transferFrom;
  // Sponsored transfers may not be visible to the EOA's normal RPC history;
  // use KeeperHub's authoritative receipt only for that documented path.
  const useKeeperHubReceipt = result.transferSponsored === true;
  if (!reportedSender && !useKeeperHubReceipt) {
    throw new Error(
      'Refusing to write submission evidence: KeeperHub sender identity or authoritative receipt evidence was not returned.',
    );
  }

  let receiptVerification;
  try {
    receiptVerification = useKeeperHubReceipt
      ? {
          outcome:
            result.transferVerified === true && result.transferReceiptStatus === 'success'
              ? ('verified' as const)
              : ('unverified' as const),
          network: 'keeperhub-authoritative-receipt',
          chainId: result.transferChainId,
          transactionLink: result.transferTransactionLink,
          sponsored: result.transferSponsored,
          reportedSender,
          receiptStatus: result.transferReceiptStatus,
          receipts: result.transferReceipts,
        }
      : await verifyArbitrumSepoliaReceipt({
          txHash: result.transferTxHash,
          recipient: args.recipient,
          sender: reportedSender!,
          valueWei: amountWei,
        });
  } catch (error) {
    const unverifiedReceipt = {
      ok: false,
      status: 'unverified' as const,
      intentId: result.intentId,
      runId: result.runId,
      transferTxHash: result.transferTxHash,
      transferExecutionId: result.transferExecutionId,
      transferFrom: reportedSender,
      chainId: result.transferChainId,
      traceId: result.traceId,
      policyId: result.policyId,
      executionProvider: result.executionProvider,
      error: error instanceof Error ? error.message : String(error),
      executedAt,
    };
    await fs.mkdir(path.dirname(args.output), { recursive: true });
    await fs.writeFile(args.output, JSON.stringify(unverifiedReceipt, null, 2));
    throw new Error(
      `Broadcast succeeded but receipt verification is unavailable; preserved the transaction in ${args.output}. ${unverifiedReceipt.error}`,
    );
  }

  if (receiptVerification.outcome !== 'verified') {
    const unverifiedReceipt = {
      ok: false,
      status: 'unverified' as const,
      intentId: result.intentId,
      runId: result.runId,
      transferTxHash: result.transferTxHash,
      transferExecutionId: result.transferExecutionId,
      transferFrom: reportedSender,
      chainId: result.transferChainId,
      traceId: result.traceId,
      policyId: result.policyId,
      executionProvider: result.executionProvider,
      receiptVerification,
      executedAt,
    };
    await fs.mkdir(path.dirname(args.output), { recursive: true });
    await fs.writeFile(args.output, JSON.stringify(unverifiedReceipt, null, 2));
    throw new Error(
      `Broadcast succeeded but receipt verification is unavailable; preserved the transaction in ${args.output}.`,
    );
  }

  const receipt = {
    ok: true,
    intentId: result.intentId,
    runId: result.runId,
    transferTxHash: result.transferTxHash,
    transferExecutionId: result.transferExecutionId,
    transferFrom: reportedSender,
    transferTransactionLink: result.transferTransactionLink,
    transferSponsored: result.transferSponsored,
    transferVerified: result.transferVerified,
    transferReceiptStatus: result.transferReceiptStatus,
    transferReceipts: result.transferReceipts,
    txHash: result.txHash,
    traceId: result.traceId,
    chainId: result.transferChainId,
    explorerUrl: `https://sepolia.arbiscan.io/tx/${result.transferTxHash}`,
    receiptVerification,
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
  console.error('[rebalance] unhandled error:', error);
  process.exit(1);
});
