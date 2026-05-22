/**
 * ChainGPT Integration - Full Test
 * Tests the complete ChainGPTAuditService with live API
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env file from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", "..", ".env");
dotenv.config({ path: envPath });

async function testChainGPTIntegration() {
  console.log("🔗 Testing ChainGPT Audit Service Integration\n");

  const { ChainGPTAuditService } = await import("./ChainGPTAuditService.js");

  const apiKey = process.env.CHAINGPT_API_KEY;
  if (!apiKey) {
    console.error("❌ CHAINGPT_API_KEY not found");
    process.exit(1);
  }

  const service = new ChainGPTAuditService({
    apiKey,
    blockOnSeverity: "high",
    holdOnMedium: true,
    timeoutMs: 60000,
  });

  // Test 1: Audit a contract (vulnerable vault)
  console.log("Test 1: Audit vulnerable contract");
  try {
    const result = await service.auditContract("0x1234567890abcdef1234567890abcdef12345678", {
      sourceCode: `pragma solidity ^0.8.0;
contract VulnerableVault {
    mapping(address => uint256) public balances;

    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        // Vulnerable: state update after external call
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        balances[msg.sender] -= amount;
    }
}`
    });

    console.log(`  ✓ Decision: ${result.decision}`);
    console.log(`  Score: ${result.audit.score}`);
    console.log(`  Safe: ${result.audit.safe}`);
    console.log(`  Severity: ${result.audit.severity}`);
    console.log(`  Findings: ${result.audit.findings.length}`);

    if (result.audit.findings.length > 0) {
      console.log("  Top findings:");
      result.audit.findings.slice(0, 3).forEach((f, i) => {
        console.log(`    ${i + 1}. ${f.title} (${f.severity})`);
      });
    }

    const summary = service.getAuditSummary(result.audit);
    console.log(`  Summary: ${summary}`);
  } catch (error) {
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  // Test 2: Audit a safe contract
  console.log("\nTest 2: Audit safe contract");
  try {
    const result = await service.auditContract("0xabcdef1234567890abcdef1234567890abcdef12", {
      sourceCode: `pragma solidity ^0.8.0;
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SafeVault is ReentrancyGuard {
    mapping(address => uint256) public balances;

    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) public nonReentrant {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
}`
    });

    console.log(`  ✓ Decision: ${result.decision}`);
    console.log(`  Score: ${result.audit.score}`);
    console.log(`  Safe: ${result.audit.safe}`);
    console.log(`  Summary: ${service.getAuditSummary(result.audit)}`);
  } catch (error) {
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  // Test 3: Cache test
  console.log("\nTest 3: Cache test");
  try {
    const start = Date.now();
    await service.auditContract("0x1234567890abcdef1234567890abcdef12345678");
    const elapsed = Date.now() - start;
    console.log(`  ✓ Cached response time: ${elapsed}ms (should be <50ms)`);
  } catch (error) {
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  console.log("\n✅ Integration test complete!");
}

testChainGPTIntegration().catch(console.error);
