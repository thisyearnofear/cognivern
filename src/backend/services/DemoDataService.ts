import type { Agent, AuditLog, Policy, Run } from "@cognivern/shared";

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function demoAgents(): Agent[] {
  return [
    {
      id: "agent-alpha-001",
      name: "Alpha Trader",
      role: "DeFi Trading",
      status: "active",
      trades: 142,
      budget: "$25,000",
      chain: "Ethereum",
      spendHistory: [
        { amount: 1200, currency: "USDC", timestamp: hoursAgo(2), decision: "approved" },
        { amount: 800, currency: "USDC", timestamp: hoursAgo(5), decision: "approved" },
        { amount: 5000, currency: "USDC", timestamp: hoursAgo(8), decision: "denied" },
      ],
    },
    {
      id: "agent-beta-002",
      name: "Beta Rebalancer",
      role: "Portfolio Management",
      status: "active",
      trades: 89,
      budget: "$15,000",
      chain: "Arbitrum",
      spendHistory: [
        { amount: 3000, currency: "USDC", timestamp: hoursAgo(1), decision: "approved" },
        { amount: 750, currency: "ETH", timestamp: hoursAgo(4), decision: "approved" },
      ],
    },
    {
      id: "agent-gamma-003",
      name: "Gamma Scanner",
      role: "Opportunity Detection",
      status: "paused",
      trades: 34,
      budget: "$5,000",
      chain: "Base",
      spendHistory: [
        { amount: 400, currency: "USDC", timestamp: hoursAgo(12), decision: "approved" },
      ],
    },
    {
      id: "agent-delta-004",
      name: "Delta Yield",
      role: "Yield Farming",
      status: "active",
      trades: 67,
      budget: "$10,000",
      chain: "Ethereum",
      spendHistory: [
        { amount: 2500, currency: "USDC", timestamp: hoursAgo(3), decision: "approved" },
        { amount: 1800, currency: "DAI", timestamp: hoursAgo(7), decision: "approved" },
      ],
    },
  ];
}

function demoAuditLogs(): AuditLog[] {
  return [
    {
      id: "log-001",
      agentId: "agent-alpha-001",
      action: "swap",
      description: "Swap 1200 USDC → ETH on Uniswap V3",
      decision: "approved",
      chain: "Ethereum",
      timestamp: hoursAgo(2),
      latency: "45ms",
      policyChecks: [
        { policyId: "pol-budget-001", result: true, reason: "Within daily limit" },
        { policyId: "pol-vendor-001", result: true, reason: "Uniswap is allowlisted" },
      ],
    },
    {
      id: "log-002",
      agentId: "agent-alpha-001",
      action: "swap",
      description: "Swap 5000 USDC → WBTC (exceeds single-tx limit)",
      decision: "denied",
      chain: "Ethereum",
      timestamp: hoursAgo(8),
      latency: "32ms",
      policyChecks: [
        { policyId: "pol-budget-001", result: false, reason: "Exceeds $3000 single transaction limit" },
      ],
    },
    {
      id: "log-003",
      agentId: "agent-beta-002",
      action: "transfer",
      description: "Rebalance 3000 USDC to Aave lending pool",
      decision: "approved",
      chain: "Arbitrum",
      timestamp: hoursAgo(1),
      latency: "28ms",
      policyChecks: [
        { policyId: "pol-budget-001", result: true, reason: "Within daily limit" },
        { policyId: "pol-chain-001", result: true, reason: "Arbitrum is allowed" },
      ],
    },
    {
      id: "log-004",
      agentId: "agent-delta-004",
      action: "deposit",
      description: "Deposit 2500 USDC to Compound V3",
      decision: "approved",
      chain: "Ethereum",
      timestamp: hoursAgo(3),
      latency: "51ms",
      policyChecks: [
        { policyId: "pol-budget-001", result: true, reason: "Within daily limit" },
        { policyId: "pol-vendor-001", result: true, reason: "Compound is allowlisted" },
      ],
    },
    {
      id: "log-005",
      agentId: "agent-gamma-003",
      action: "swap",
      description: "Swap 400 USDC → ARB (held for human review)",
      decision: "held",
      chain: "Base",
      timestamp: hoursAgo(12),
      latency: "39ms",
      policyChecks: [
        { policyId: "pol-budget-001", result: true, reason: "Within limit" },
        { policyId: "pol-approval-001", result: false, reason: "New token requires human approval" },
      ],
    },
  ];
}

function demoPolicies(): Policy[] {
  return [
    {
      id: "pol-budget-001",
      name: "Daily Spend Limit",
      type: "budget",
      description: "Enforces per-agent daily spend caps and single-transaction limits",
      status: "active",
      agents: 4,
      violations: 3,
      rules: [
        { id: "r1", condition: "amount > 3000", action: "deny", params: { currency: "USDC" } },
        { id: "r2", condition: "dailyTotal > 10000", action: "deny" },
      ],
    },
    {
      id: "pol-vendor-001",
      name: "Vendor Allowlist",
      type: "allowlist",
      description: "Only permits interactions with vetted DeFi protocols",
      status: "active",
      agents: 4,
      violations: 0,
      rules: [
        { id: "r3", condition: "target NOT IN allowlist", action: "deny" },
      ],
    },
    {
      id: "pol-chain-001",
      name: "Chain Restrictions",
      type: "chain",
      description: "Limits agent operations to approved chains",
      status: "active",
      agents: 3,
      violations: 1,
      rules: [
        { id: "r4", condition: "chain NOT IN [ethereum, arbitrum, base]", action: "deny" },
      ],
    },
    {
      id: "pol-approval-001",
      name: "Human Approval Threshold",
      type: "approval",
      description: "Requires human sign-off for novel tokens or high-risk operations",
      status: "active",
      agents: 2,
      violations: 0,
      rules: [
        { id: "r5", condition: "token.isNew || amount > 5000", action: "flag" },
      ],
    },
  ];
}

function demoRuns(): Run[] {
  return [
    {
      id: "run-001",
      workflow: "Alpha Trader — Market Scan + Execute",
      status: "completed",
      mode: "autonomous",
      steps: 5,
      duration: "12s",
      artifacts: 2,
      timestamp: hoursAgo(2),
    },
    {
      id: "run-002",
      workflow: "Beta Rebalancer — Portfolio Rebalance",
      status: "completed",
      mode: "autonomous",
      steps: 8,
      duration: "34s",
      artifacts: 3,
      timestamp: hoursAgo(1),
    },
    {
      id: "run-003",
      workflow: "Alpha Trader — Large Swap Attempt",
      status: "failed",
      mode: "autonomous",
      steps: 3,
      duration: "4s",
      artifacts: 1,
      timestamp: hoursAgo(8),
    },
    {
      id: "run-004",
      workflow: "Gamma Scanner — Opportunity Scan",
      status: "paused_for_approval",
      mode: "supervised",
      steps: 4,
      duration: "8s",
      artifacts: 1,
      timestamp: hoursAgo(12),
    },
    {
      id: "run-005",
      workflow: "Delta Yield — Compound Deposit",
      status: "completed",
      mode: "autonomous",
      steps: 6,
      duration: "18s",
      artifacts: 2,
      timestamp: hoursAgo(3),
    },
    {
      id: "run-006",
      workflow: "Beta Rebalancer — Daily Summary",
      status: "running",
      mode: "autonomous",
      steps: 2,
      duration: "6s",
      artifacts: 0,
      timestamp: hoursAgo(0),
    },
  ];
}

export const DemoDataService = {
  getAgents: demoAgents,
  getAgent(id: string): Agent | undefined {
    return demoAgents().find((a) => a.id === id);
  },
  getAuditLogs: demoAuditLogs,
  getPolicies: demoPolicies,
  getRuns: demoRuns,
  getRun(id: string): Run | undefined {
    return demoRuns().find((r) => r.id === id);
  },
};
