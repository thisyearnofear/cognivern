
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createPublicClient, http } from 'viem';
import { filecoinCalibration } from 'viem/chains';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Load .env
dotenv.config({ path: path.join(rootDir, '.env') });
// Load .env.server (override)
dotenv.config({ path: path.join(rootDir, '.env.server') });

console.log("🔍 Verifying Environment Configuration...");

const requiredKeys = [
  'SAPIENCE_PRIVATE_KEY',
  'FILECOIN_PRIVATE_KEY',
  'RECALL_API_KEY',
  'GOVERNANCE_CONTRACT_ADDRESS',
  'OPENROUTER_API_KEY'
];

let missing = [];

for (const key of requiredKeys) {
  if (!process.env[key]) {
    missing.push(key);
  } else {
    // console.log(`✅ ${key} found`); // Don't log values
  }
}

if (missing.length > 0) {
  console.error("❌ Missing Required Keys:");
  missing.forEach(k => console.error(`   - ${k}`));
  
  if (missing.every(k => k === 'OPENROUTER_API_KEY')) {
      console.log("⚠️ Proceeding with connectivity checks for configured services...");
  } else {
      process.exit(1);
  }
} else {
  console.log("✅ All required keys present.");
}

async function verifyConnectivity() {
  console.log("\n📡 Verifying Connectivity...");

  // 1. Check Filecoin RPC
  try {
     console.log("   - Connecting to Filecoin Calibration RPC...");
     const rpcUrl = process.env.FILECOIN_RPC_URL || "https://api.calibration.node.glif.io/rpc/v1";
     const client = createPublicClient({
         chain: filecoinCalibration,
         transport: http(rpcUrl)
     });
     const blockNumber = await client.getBlockNumber();
     console.log(`   ✅ Filecoin Connected. Block Height: ${blockNumber}`);
  } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`   ❌ Filecoin Connection Failed: ${msg}`);
  }

  // 2. Check Recall API
  try {
      console.log("   - Connecting to Recall Network API...");
      const recallEndpoint = process.env.RECALL_ENDPOINT || "https://api.recall.network/v1";
      // Just check if endpoint is reachable (might get 401/404 which is fine for connectivity check vs timeout)
      const res = await fetch(recallEndpoint);
      console.log(`   ✅ Recall API Reachable (Status: ${res.status})`);
  } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`   ❌ Recall API Unreachable: ${msg}`);
  }

  // 3. Check Sapience RPC (Arbitrum)
  try {
      console.log("   - Connecting to Arbitrum RPC...");
      const arbUrl = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
      const res = await fetch(arbUrl, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({jsonrpc:"2.0",method:"eth_blockNumber",params:[],id:1})
      });
      if (res.ok) console.log("   ✅ Arbitrum RPC Connected");
      else console.error(`   ❌ Arbitrum RPC Error: ${res.status}`);
  } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`   ❌ Arbitrum RPC Connection Failed: ${msg}`);
  }
  
  console.log("\n✨ Verification Complete.");
}

verifyConnectivity();
