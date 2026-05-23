/**
 * Demo: Confidential Spend Evaluation via FHE
 *
 * Shows the full flow:
 *   1. Create a confidential policy (metadata.confidential = true)
 *   2. Agent submits encrypted spend amount
 *   3. Policy engine routes to FhenixPolicyService
 *   4. On-chain FHE evaluation (budget check without revealing limits)
 *   5. Decision returned: approve/hold/deny
 *
 * Run: pnpm demo:fhe
 */

const API_BASE = process.env.API_URL || "http://localhost:3087/api";

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(path: string, body?: any): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json() as Promise<ApiResponse<T>>;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Cognivern FHE Confidential Spend Demo                      ║");
  console.log("║  Budget limits are encrypted — agents can't see their caps  ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // 1. Create a confidential policy
  console.log("[1] Creating confidential policy...");
  const policyRes = await request("/governance/policies", {
    name: "FHE-Governed DeFi Budget",
    description: "Encrypted daily/per-tx limits evaluated on Fhenix via FHE. Agent cannot see budget caps.",
    rules: [
      {
        id: "fhe-budget-check",
        type: "deny",
        condition: "true",
        action: { type: "block", parameters: { reason: "FHE evaluation required" } },
        metadata: {
          confidential: true,
          fheContract: process.env.FHENIX_POLICY_CONTRACT || "pending-deployment",
          dailyLimitUsd: "encrypted",
          perTxLimitUsd: "encrypted",
        },
      },
    ],
    metadata: {
      confidential: true,
      chain: "fhenix-base-sepolia",
      fheProvider: "cofhe-sdk",
    },
  });

  if (!policyRes.success) {
    console.error("  Failed to create policy:", policyRes.error);
    process.exit(1);
  }

  const policy = policyRes.data as any;
  console.log(`  Policy created: ${policy.id}`);
  console.log(`  Name: ${policy.name}`);
  console.log(`  Confidential: ${policy.metadata?.confidential}`);
  console.log();

  // 2. Simulate agent spend (below threshold — should approve)
  console.log("[2] Agent requests spend: $25 USDC (below typical limits)...");
  const spendRes = await request("/spend/preview", {
    agentId: "agent-defi-bot-001",
    recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f4AAAA",
    amount: "25000000",
    asset: "USDC",
    reason: "Yield farm deposit on Aave",
    metadata: {
      policyId: policy.id,
      encryptedAmount: "0x_demo_encrypted_25_usdc",
      confidentialPolicy: true,
    },
  });

  console.log(`  Decision: ${(spendRes.data as any)?.status || "unknown"}`);
  console.log(`  Reason: ${(spendRes.data as any)?.reason || "N/A"}`);
  console.log();

  // 3. Simulate agent spend (high amount — should hold or deny)
  console.log("[3] Agent requests spend: $10,000 USDC (exceeds typical caps)...");
  const bigSpendRes = await request("/spend/preview", {
    agentId: "agent-defi-bot-001",
    recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f4AAAA",
    amount: "10000000000",
    asset: "USDC",
    reason: "Large swap on Uniswap",
    metadata: {
      policyId: policy.id,
      encryptedAmount: "0x_demo_encrypted_10000_usdc",
      confidentialPolicy: true,
    },
  });

  console.log(`  Decision: ${(bigSpendRes.data as any)?.status || "unknown"}`);
  console.log(`  Reason: ${(bigSpendRes.data as any)?.reason || "N/A"}`);
  console.log();

  // 4. Show the privacy guarantee
  console.log("[4] Privacy guarantee:");
  console.log("  - The agent NEVER sees the actual budget limits");
  console.log("  - The $500 daily cap and $100 per-tx cap are encrypted on-chain");
  console.log("  - FHE comparisons happen in ciphertext — no decryption needed for evaluation");
  console.log("  - Only the operator can decrypt limits (via CoFHE permit)");
  console.log("  - Attestation proves the evaluation happened correctly");
  console.log();

  // 5. Governance evaluate endpoint (direct FHE path)
  console.log("[5] Direct governance evaluation with FHE metadata...");
  const govRes = await request("/governance/evaluate", {
    agentId: "agent-defi-bot-001",
    policyId: policy.id,
    action: {
      type: "spend",
      description: "Transfer 50 USDC to Aave",
      amount: 50,
      currency: "USDC",
      metadata: {
        amountWei: "50000000",
        confidential: true,
        vendorHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
      },
    },
  });

  console.log(`  Approved: ${(govRes.data as any)?.approved}`);
  console.log(`  Source: ${(govRes as any)?.source}`);
  if ((govRes.data as any)?.policyChecks) {
    for (const check of (govRes.data as any).policyChecks) {
      const badge = check.result ? "PASS" : "FAIL";
      console.log(`  [${badge}] ${check.policyId}: ${check.reason}`);
      if (check.metadata?.confidential) {
        console.log(`         decisionId: ${check.metadata.decisionId}`);
        console.log(`         attestation: ${check.metadata.attestation}`);
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("Demo complete. The FHE integration ensures:");
  console.log("  1. Budget limits remain secret from agents");
  console.log("  2. Spend decisions are provably correct (on-chain attestation)");
  console.log("  3. Auditors can selectively decrypt with CoFHE permits");
  console.log("  4. Cross-chain enforcement via Hyperlane bridge");
  console.log("═══════════════════════════════════════════════════════════════");
}

main().catch(console.error);
