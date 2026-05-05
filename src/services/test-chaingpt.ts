/**
 * ChainGPT Audit Service - Manual Test Script
 *
 * Tests the ChainGPTAuditService with mock responses.
 * Run with: npx tsx src/services/test-chaingpt.ts
 */

import { ChainGPTAuditService } from "./ChainGPTAuditService.js";

// Mock fetch for testing
const originalFetch = globalThis.fetch;
let fetchCallCount = 0;

async function mockFetch(url: string, options?: any) {
  fetchCallCount++;
  console.log(`  [Mock Fetch] Called: ${url}`);

  // Simulate API response
  return {
    ok: true,
    json: async () => ({
      score: 85,
      findings: [
        {
          title: "Centralization Risk",
          description: "Owner has excessive privileges",
          severity: "medium",
          location: "setOwner()",
          recommendation: "Implement timelock or multisig",
        },
      ],
      summary: "Medium severity issues found",
    }),
  } as Response;
}

async function testChainGPTAuditService() {
  console.log("🧪 Testing ChainGPT Audit Service (Mock Mode)\n");

  // Override fetch with mock
  globalThis.fetch = mockFetch;

  const service = new ChainGPTAuditService({
    apiKey: "test-key", // pragma: allowlist secret
    blockOnSeverity: "high",
    holdOnMedium: true,
  });

  // Test 1: Audit a contract
  console.log("Test 1: Audit a contract address");
  fetchCallCount = 0;
  const result1 = await service.auditContract("0x1234567890abcdef1234567890abcdef12345678");
  console.log(`  Decision: ${result1.decision}`);
  console.log(`  Score: ${result1.audit.score}`);
  console.log(`  Findings: ${result1.audit.findings.length}`);
  console.log(`  API calls: ${fetchCallCount}`);
  console.log(`  ✓ Expected: hold (medium severity with holdOnMedium=true)\n`);

  // Test 2: Cache hit
  console.log("Test 2: Cache hit test");
  fetchCallCount = 0;
  const result2 = await service.auditContract("0x1234567890abcdef1234567890abcdef12345678");
  console.log(`  Decision: ${result2.decision}`);
  console.log(`  API calls: ${fetchCallCount} (should be 0 - cache hit)`);
  console.log(`  ✓ Expected: 0 API calls (cached)\n`);

  // Test 3: Skip cache
  console.log("Test 3: Skip cache test");
  fetchCallCount = 0;
  const result3 = await service.auditContract("0x1234567890abcdef1234567890abcdef12345678", { skipCache: true });
  console.log(`  Decision: ${result3.decision}`);
  console.log(`  API calls: ${fetchCallCount} (should be 1 - cache skipped)`);
  console.log(`  ✓ Expected: 1 API call\n`);

  // Test 4: Parse contract input
  console.log("Test 4: Parse contract input");
  const address = "0x1234567890abcdef1234567890abcdef12345678";
  const parsed = service.parseContractInput(address);
  console.log(`  Input: ${address}`);
  console.log(`  Parsed: ${parsed}`);
  console.log(`  ✓ Expected: same address\n`);

  // Test 5: Get audit summary
  console.log("Test 5: Get audit summary");
  const summary = service.getAuditSummary(result1.audit);
  console.log(`  Summary: ${summary}`);
  console.log(`  ✓ Expected: contains score\n`);

  // Test 6: Batch audit
  console.log("Test 6: Batch audit multiple contracts");
  fetchCallCount = 0;
  const contracts = [
    "0xabcdef1234567890abcdef1234567890abcdef12",
    "0x9876543210abcdef9876543210abcdef98765432",
  ];
  const results = await service.auditContracts(contracts);
  console.log(`  Contracts audited: ${results.size}`);
  console.log(`  API calls: ${fetchCallCount}`);
  console.log(`  ✓ Expected: 2 API calls\n`);

  // Restore original fetch
  globalThis.fetch = originalFetch;

  console.log("✅ All tests completed!");
}

// Run tests
testChainGPTAuditService().catch(console.error);
