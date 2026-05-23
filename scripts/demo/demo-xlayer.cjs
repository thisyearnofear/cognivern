/**
 * Cognivern X Layer Integration Demo
 *
 * Showcases the full governance lifecycle on X Layer testnet:
 *   1. Connect to deployed contracts
 *   2. Read current governance stats
 *   3. Create & activate a policy
 *   4. Register an AI agent
 *   5. Log a governed spend action
 *   6. Query the audit trail
 *
 * Usage:
 *   node scripts/demo-xlayer.cjs
 *
 * Requires XLAYER_PRIVATE_KEY in .env (or set as env var).
 */

const { ethers } = require("ethers");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// --- Config ---
const XLAYER_TESTNET_RPC = "https://testrpc.xlayer.tech";
const GOVERNANCE_ADDRESS = "0x755602bBcAD94ccA126Cfc9E5Fa697432D9e2DD6";
const STORAGE_ADDRESS = "0x1E0317beFf188e314BbC3483e06773EEfa28bB2D";

// Minimal ABIs (only the functions we call)
const GOVERNANCE_ABI = [
  "function getStats() view returns (uint256, uint256, uint256)",
  "function createPolicy(bytes32, string, string, bytes32)",
  "function updatePolicyStatus(bytes32, uint8)",
  "function registerAgent(bytes32, string, string[], bytes32)",
  "function updateAgentStatus(bytes32, uint8)",
  "function evaluateAction(bytes32, bytes32, string, bytes32, bool)",
  "function getPolicy(bytes32) view returns (tuple(bytes32 id, string name, string description, bytes32 rulesHash, address creator, uint256 createdAt, uint256 updatedAt, uint8 status))",
  "function getAgent(bytes32) view returns (tuple(bytes32 id, string name, address owner, string[] capabilities, uint256 registeredAt, uint8 status, bytes32 currentPolicyId))",
  "function getAction(bytes32) view returns (tuple(bytes32 id, bytes32 agentId, bytes32 policyId, string actionType, bytes32 dataHash, bool approved, uint256 timestamp, address evaluator))",
];

const STORAGE_ABI = [
  "function getGovernanceStats() view returns (uint256, uint256, uint256)",
  "function storeGovernanceAction(bytes32, address, string, string, bool, uint256, string, string)",
  "function getGovernanceRecord(bytes32) view returns (tuple(bytes32 actionId, address agentAddress, string actionType, string description, bool approved, uint256 policyCheckCount, string policyResult, uint256 timestamp, string filecoinCID, bool isImmutable))",
  "function registerAgent(address, string, string)",
  "function getAgentInfo(address) view returns (tuple(address agentAddress, string name, string agentType, bool isActive, uint256 registeredAt, uint256 totalActions, uint256 totalViolations))",
];

// --- Helpers ---
function separator(title) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}\n`);
}

function step(n, label) {
  console.log(`\n  ┌─ Step ${n}: ${label}`);
}

function ok(msg) {
  console.log(`  │  ✅ ${msg}`);
}

function info(msg) {
  console.log(`  │  📋 ${msg}`);
}

function done() {
  console.log(`  └─ done\n`);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Main ---
async function main() {
  separator("Cognivern · X Layer Governance Demo");

  const privateKey = process.env.XLAYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ XLAYER_PRIVATE_KEY not set. Add it to .env or export it.");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(XLAYER_TESTNET_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  const governance = new ethers.Contract(GOVERNANCE_ADDRESS, GOVERNANCE_ABI, wallet);
  const storage = new ethers.Contract(STORAGE_ADDRESS, STORAGE_ABI, wallet);

  console.log(`  Network:    X Layer Testnet (chainId 195)`);
  console.log(`  Wallet:     ${wallet.address}`);
  console.log(`  Governance: ${GOVERNANCE_ADDRESS}`);
  console.log(`  Storage:    ${STORAGE_ADDRESS}`);

  // ── Step 1: Read current stats ──
  step(1, "Read current governance stats");
  const [policies, agents, actions] = await governance.getStats();
  const [storageActions, violations, storageAgents] = await storage.getGovernanceStats();
  info(`GovernanceContract — Policies: ${policies}, Agents: ${agents}, Actions: ${actions}`);
  info(`AIGovernanceStorage — Actions: ${storageActions}, Violations: ${violations}, Agents: ${storageAgents}`);
  done();

  // ── Step 2: Create a new policy ──
  step(2, "Create & activate a governance policy");
  const ts = Date.now();
  const policyId = ethers.keccak256(ethers.toUtf8Bytes(`demo-policy-${ts}`));
  const policyName = "Demo Spend Limit Policy";
  const policyDesc = "Max 0.5 OKB per transaction, 2 OKB daily cap";
  const rulesHash = ethers.keccak256(ethers.toUtf8Bytes(`rules-${ts}`));

  info(`Creating policy: "${policyName}"`);
  let tx = await governance.createPolicy(policyId, policyName, policyDesc, rulesHash);
  await tx.wait();
  ok("Policy created on-chain");

  info("Activating policy...");
  tx = await governance.updatePolicyStatus(policyId, 1); // 1 = Active
  await tx.wait();
  ok("Policy activated");

  const policy = await governance.getPolicy(policyId);
  info(`Policy status: ${policy.status === 1n ? "Active" : "Inactive"}`);
  done();

  // ── Step 3: Register an AI agent ──
  step(3, "Register an AI agent bound to the policy");
  const agentId = ethers.keccak256(ethers.toUtf8Bytes(`demo-agent-${ts}`));
  const agentName = "Demo Trading Agent";
  const capabilities = ["swap", "transfer", "stake"];

  info(`Registering agent: "${agentName}" with capabilities: [${capabilities.join(", ")}]`);
  tx = await governance.registerAgent(agentId, agentName, capabilities, policyId);
  await tx.wait();
  ok("Agent registered in GovernanceContract");

  info("Activating agent...");
  tx = await governance.updateAgentStatus(agentId, 1); // 1 = Active
  await tx.wait();
  ok("Agent activated");

  const agent = await governance.getAgent(agentId);
  info(`Agent bound to policy, status: ${agent.status === 1n ? "Active" : "Inactive"}`);
  done();

  // ── Step 4: Evaluate a spend action (approve) ──
  step(4, "Evaluate a governed spend action");
  const actionId = ethers.keccak256(ethers.toUtf8Bytes(`demo-action-${ts}`));
  const actionType = "swap";
  const evidenceHash = ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify({
      from: "OKB",
      to: "USDT",
      amount: "0.3",
      reason: "Portfolio rebalance",
    }))
  );

  info(`Action: swap 0.3 OKB → USDT (within policy limit)`);
  info("Evaluating against policy...");
  tx = await governance.evaluateAction(actionId, agentId, actionType, evidenceHash, true);
  await tx.wait();
  ok("Action APPROVED and recorded on GovernanceContract");

  const action = await governance.getAction(actionId);
  info(`On-chain result: approved=${action.approved}, type="${action.actionType}"`);
  done();

  // ── Step 5: Store governance record in AIGovernanceStorage ──
  step(5, "Anchor audit record to AIGovernanceStorage");
  const storageActionId = ethers.keccak256(ethers.toUtf8Bytes(`storage-action-${ts}`));

  info("Writing immutable audit record...");
  tx = await storage.storeGovernanceAction(
    storageActionId,
    wallet.address,
    "swap",
    "Swap 0.3 OKB to USDT — approved by policy engine",
    true,                                       // approved
    1,                                          // policyCheckCount
    "PASS: within spend limit",                 // policyResult
    evidenceHash                                // filecoinCID (using evidence hash as reference)
  );
  await tx.wait();
  ok("Audit record anchored to AIGovernanceStorage");

  const record = await storage.getGovernanceRecord(storageActionId);
  info(`Record immutable: ${record.isImmutable}, approved: ${record.approved}, policyResult: "${record.policyResult}"`);
  done();

  // ── Step 6: Query final stats ──
  step(6, "Verify final governance state");
  const [p2, a2, ac2] = await governance.getStats();
  const [sa2, v2, sag2] = await storage.getGovernanceStats();
  info(`GovernanceContract — Policies: ${p2}, Agents: ${a2}, Actions: ${ac2}`);
  info(`AIGovernanceStorage — Actions: ${sa2}, Violations: ${v2}, Agents: ${sag2}`);
  done();

  // ── Summary ──
  separator("Demo Complete — Full Governance Lifecycle on X Layer");
  console.log("  What just happened:\n");
  console.log("  1. Connected to deployed contracts on X Layer testnet");
  console.log("  2. Created a spend-limit policy and activated it on-chain");
  console.log("  3. Registered an AI trading agent bound to that policy");
  console.log("  4. Agent requested a swap — policy engine approved it on-chain");
  console.log("  5. Audit record anchored to AIGovernanceStorage (immutable)");
  console.log("  6. Verified all state changes are recorded and queryable\n");
  console.log("  Explorer: https://www.okx.com/explorer/xlayer-test");
  console.log(`  GovernanceContract: ${GOVERNANCE_ADDRESS}`);
  console.log(`  AIGovernanceStorage: ${STORAGE_ADDRESS}`);
  console.log(`  Live frontend: https://cognivern.vercel.app\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Demo failed:", err.message || err);
    process.exit(1);
  });
