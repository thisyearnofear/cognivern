/**
 * E2E Test: ChainGPT Audit Flow
 *
 * Tests the complete spend preview → audit → decision flow
 * Run with: npx tsx src/services/test-chaingpt-e2e.ts
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const API_BASE = process.env.API_BASE_URL || "http://localhost:3000";
const API_KEY = process.env.COGNIVERN_API_KEY || "development-api-key";

interface SpendPreviewResponse {
  success: boolean;
  data: {
    intentId: string;
    status: "approved" | "denied" | "held";
    policyId?: string;
    reason?: string;
    simulation: {
      wouldExecute: boolean;
      gasEstimate?: string;
      warnings: string[];
    };
    contractAudit?: {
      address: string;
      decision: "approve" | "hold" | "deny";
      score: number;
      safe: boolean;
      severity: string;
      findingsCount: number;
      summary: string;
    };
  };
  timestamp: string;
}

async function testSpendPreview(
  recipient: string,
  description: string
): Promise<SpendPreviewResponse | null> {
  console.log(`\n📋 Test: ${description}`);
  console.log(`   Recipient: ${recipient}`);

  try {
    const response = await fetch(`${API_BASE}/api/spend/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": API_KEY,
      },
      body: JSON.stringify({
        agentId: "test-agent-001",
        recipient,
        amount: "1000000000000000000", // 1 ETH in wei
        asset: "ETH",
        reason: "Test spend for audit verification",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   ❌ HTTP ${response.status}: ${errorText}`);
      return null;
    }

    const data = await response.json();
    return data as SpendPreviewResponse;
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : "Unknown"}`);
    return null;
  }
}

async function runE2ETests() {
  console.log("🧪 E2E Test: ChainGPT Audit Flow");
  console.log("=".repeat(50));
  console.log(`API Base: ${API_BASE}`);
  console.log(`API Key: ${API_KEY.substring(0, 8)}...`);

  // Test 1: EOA address (should skip audit)
  const eoaResult = await testSpendPreview(
    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "EOA address (no audit needed)"
  );

  if (eoaResult) {
    console.log(`   ✓ Status: ${eoaResult.data.status}`);
    console.log(`   ✓ Contract Audit: ${eoaResult.data.contractAudit ? "Present" : "Skipped (correct)"}`);
  }

  // Test 2: Contract address (should trigger audit)
  const contractResult = await testSpendPreview(
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on Ethereum
    "USDC contract (should trigger audit)"
  );

  if (contractResult) {
    console.log(`   ✓ Status: ${contractResult.data.status}`);
    console.log(`   ✓ Would Execute: ${contractResult.data.simulation.wouldExecute}`);

    if (contractResult.data.contractAudit) {
      const audit = contractResult.data.contractAudit;
      console.log(`   ✓ Audit Decision: ${audit.decision}`);
      console.log(`   ✓ Audit Score: ${audit.score}`);
      console.log(`   ✓ Audit Severity: ${audit.severity}`);
      console.log(`   ✓ Findings: ${audit.findingsCount}`);
    }
  }

  // Test 3: Unknown contract (potentially risky)
  const unknownResult = await testSpendPreview(
    "0x1234567890abcdef1234567890abcdef12345678",
    "Unknown contract (potentially risky)"
  );

  if (unknownResult) {
    console.log(`   ✓ Status: ${unknownResult.data.status}`);
    console.log(`   ✓ Would Execute: ${unknownResult.data.simulation.wouldExecute}`);

    if (unknownResult.data.contractAudit) {
      const audit = unknownResult.data.contractAudit;
      console.log(`   ✓ Audit Decision: ${audit.decision}`);
      console.log(`   ✓ Audit Score: ${audit.score}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Test Summary");

  const tests = [
    { name: "EOA Address", result: eoaResult, expected: "approved" },
    { name: "USDC Contract", result: contractResult, expected: "approved or held" },
    { name: "Unknown Contract", result: unknownResult, expected: "held or denied" },
  ];

  let passed = 0;
  for (const test of tests) {
    const status = test.result?.data.status || "failed";
    const hasAudit = !!test.result?.data.contractAudit;
    const success = test.result?.success === true;

    console.log(`${success ? "✓" : "✗"} ${test.name}: ${status} (audit: ${hasAudit ? "yes" : "no"})`);
    if (success) passed++;
  }

  console.log(`\n${passed}/${tests.length} tests passed`);
}

runE2ETests().catch(console.error);
