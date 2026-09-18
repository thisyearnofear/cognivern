#!/usr/bin/env tsx
/**
 * Provision a Dynamic MPC server wallet for Cognivern.
 *
 * Creates a wallet with backUpToDynamic=true and writes walletMetadata to
 * `.cognivern/dynamic-server-wallet.json` (or DYNAMIC_WALLET_METADATA_PATH).
 *
 * Usage:
 *   DYNAMIC_ENABLED=true \
 *   DYNAMIC_ENVIRONMENT_ID=... \
 *   DYNAMIC_API_TOKEN=... \
 *   DYNAMIC_WALLET_PASSWORD=... \
 *   pnpm dynamic:provision
 */

import {
  isDynamicConfigured,
  provisionDynamicServerWallet,
} from "../../../src/backend/services/blockchain/dynamic/DynamicServerWalletClient.js";

async function main() {
  if (!isDynamicConfigured()) {
    console.error("Dynamic is not configured.");
    console.error(
      "Set DYNAMIC_ENABLED=true, DYNAMIC_ENVIRONMENT_ID, DYNAMIC_API_TOKEN.",
    );
    process.exit(1);
  }

  console.log("Provisioning Dynamic server wallet…");
  const result = await provisionDynamicServerWallet();
  console.log();
  console.log("Account address:", result.accountAddress);
  console.log("Metadata path:  ", result.metadataPath);
  console.log();
  console.log("Next:");
  console.log(`  export DYNAMIC_SERVER_WALLET_ADDRESS=${result.accountAddress}`);
  console.log(
    "  PATCH an OWS wallet with executionProvider/signingProvider=dynamic,",
  );
  console.log("  dynamicAccountAddress, and dynamicWalletMetadata from the file.");
  console.log("  Fund the address on your execution rail, then pnpm demo:dynamic");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
