#!/usr/bin/env tsx
/**
 * Dynamic × Cognivern demo — readiness + optional governed spend.
 *
 * Always:
 *   1. Checks DYNAMIC_* config
 *   2. Loads provisioned walletMetadata
 *   3. Signs a sample spend-envelope message via Dynamic MPC
 *
 * Optional live transfer (when DYNAMIC_DEMO_WALLET_ID + API key set):
 *   4. executeSpend through OwsWalletService with executionProvider=dynamic
 *
 * Usage:
 *   pnpm demo:dynamic
 *   DYNAMIC_DEMO_WALLET_ID=... DYNAMIC_DEMO_API_KEY=... DYNAMIC_DEMO_WORKSPACE_ID=... pnpm demo:dynamic
 */

import crypto from "node:crypto";
import { owsLocalVaultService } from "../../../src/backend/services/blockchain/OwsLocalVaultService.js";
import {
  OwsWalletService,
  type SpendIntent,
} from "../../../src/backend/services/blockchain/OwsWalletService.js";
import {
  isDynamicConfigured,
  loadDynamicWalletMetadata,
  signDynamicMessage,
} from "../../../src/backend/services/blockchain/dynamic/DynamicServerWalletClient.js";
import { explorerTxUrl } from "@cognivern/shared";

async function main() {
  console.log("=".repeat(72));
  console.log("Dynamic × Cognivern — agent wallet demo");
  console.log("=".repeat(72));
  console.log();

  if (!isDynamicConfigured()) {
    console.error("❌ Dynamic is not configured (DYNAMIC_ENABLED / env id / token).");
    process.exit(1);
  }

  const metadata = await loadDynamicWalletMetadata();
  if (!metadata?.accountAddress) {
    console.error("❌ No Dynamic walletMetadata found.");
    console.error("Run: pnpm dynamic:provision");
    process.exit(1);
  }

  console.log("✅ Dynamic configured");
  console.log("   Account:", metadata.accountAddress);
  console.log();

  console.log("Step 1: Dynamic MPC signMessage (spend-envelope shape)…");
  const sample = JSON.stringify({
    kind: "cognivern.spend_envelope",
    recipient: "0x0000000000000000000000000000000000000001",
    amountWei: "1000",
    ts: new Date().toISOString(),
  });
  const signed = await signDynamicMessage({
    message: sample,
    walletMetadata: metadata,
  });
  console.log("   Signer:   ", signed.signer);
  console.log("   Signature:", signed.signature.slice(0, 18) + "…");
  console.log();

  const walletId = process.env.DYNAMIC_DEMO_WALLET_ID?.trim();
  if (!walletId) {
    console.log("Skipping live spend (set DYNAMIC_DEMO_WALLET_ID to run executeSpend).");
    console.log("Demo complete — Dynamic signing works.");
    return;
  }

  const apiKey =
    process.env.DYNAMIC_DEMO_API_KEY?.trim() ||
    process.env.OWS_API_KEY?.trim() ||
    "";
  const workspaceId =
    process.env.DYNAMIC_DEMO_WORKSPACE_ID?.trim() || "demo-dynamic";

  if (!apiKey) {
    console.error("Set DYNAMIC_DEMO_API_KEY or OWS_API_KEY for the spend path.");
    process.exit(1);
  }

  const wallets = await owsLocalVaultService.listWallets();
  const wallet = wallets.find((w) => w.id === walletId);
  if (!wallet) {
    console.error(`Wallet not found: ${walletId}`);
    process.exit(1);
  }

  await owsLocalVaultService.updateWalletMetadata(walletId, {
    dynamicWalletMetadata: metadata,
    dynamicAccountAddress: metadata.accountAddress,
    executionProvider: "dynamic",
    signingProvider: "dynamic",
  });

  const recipient =
    process.env.DYNAMIC_DEMO_RECIPIENT?.trim() ||
    "0x0000000000000000000000000000000000000001";
  const amountWei = process.env.DYNAMIC_DEMO_AMOUNT_WEI || "1000";

  const intent: SpendIntent = {
    id: crypto.randomUUID(),
    agentId: "demo-dynamic-agent",
    recipient,
    amount: amountWei,
    asset: "ETH",
    reason: "Runtime Dynamic demo — governed agent spend",
    timestamp: new Date().toISOString(),
  };

  console.log("Step 2: Governed executeSpend via Dynamic…");
  console.log("  wallet:   ", walletId);
  console.log("  workspace:", workspaceId);
  console.log("  recipient:", recipient);
  console.log("  amountWei:", amountWei);
  console.log();

  const service = new OwsWalletService();
  const result = await service.executeSpend(intent, {
    workspaceId,
    apiKeyToken: apiKey,
    walletId,
  });

  console.log("Result:");
  console.log(JSON.stringify(result, null, 2));

  if (result.transferTxHash) {
    const chainId = (wallet.metadata as { chainId?: number } | undefined)?.chainId;
    console.log();
    console.log("Explorer:", explorerTxUrl(chainId, result.transferTxHash) || result.transferTxHash);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
