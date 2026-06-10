// Demo data for unauthenticated exploration mode
// Aligned with backend DemoDataService.ts — single source of truth schema
import type {
  Agent,
  AuditLog,
  Policy,
  Run,
  Workspace,
} from "@cognivern/shared";

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

export const DEMO_WORKSPACE: Workspace = {
  id: "demo-ws-001",
  name: "Demo Treasury",
  ownerId: "demo-user",
  tier: "demo",
  createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date().toISOString(),
};

export const DEMO_AGENTS = [
  {
    id: "agent-alpha-001",
    name: "Alpha Trader",
    role: "DeFi Trading",
    status: "active" as const,
    trades: 142,
    budget: "$25,000",
    chain: "Ethereum",
    spendHistory: [
      {
        amount: 1200,
        currency: "USDC",
        timestamp: hoursAgo(2),
        decision: "approved",
      },
      {
        amount: 800,
        currency: "USDC",
        timestamp: hoursAgo(5),
        decision: "approved",
      },
      {
        amount: 5000,
        currency: "USDC",
        timestamp: hoursAgo(8),
        decision: "denied",
      },
    ],
  },
  {
    id: "agent-beta-002",
    name: "Beta Rebalancer",
    role: "Portfolio Management",
    status: "active" as const,
    trades: 89,
    budget: "$15,000",
    chain: "Arbitrum",
    spendHistory: [
      {
        amount: 3000,
        currency: "USDC",
        timestamp: hoursAgo(1),
        decision: "approved",
      },
      {
        amount: 750,
        currency: "ETH",
        timestamp: hoursAgo(4),
        decision: "approved",
      },
    ],
  },
  {
    id: "agent-gamma-003",
    name: "Gamma Scanner",
    role: "Opportunity Detection",
    status: "paused" as const,
    trades: 34,
    budget: "$5,000",
    chain: "Base",
    spendHistory: [
      {
        amount: 400,
        currency: "USDC",
        timestamp: hoursAgo(12),
        decision: "approved",
      },
    ],
  },
  {
    id: "agent-delta-004",
    name: "Delta Yield",
    role: "Yield Farming",
    status: "active" as const,
    trades: 67,
    budget: "$10,000",
    chain: "Ethereum",
    spendHistory: [
      {
        amount: 2500,
        currency: "USDC",
        timestamp: hoursAgo(3),
        decision: "approved",
      },
      {
        amount: 1800,
        currency: "DAI",
        timestamp: hoursAgo(7),
        decision: "approved",
      },
    ],
  },
] as Agent[];

export const DEMO_POLICIES = [
  {
    id: "pol-budget-001",
    name: "Daily Spend Limit",
    type: "budget",
    description: "Enforces per-agent daily spend caps and single-transaction limits",
    status: "active",
    agents: 4,
    violations: 3,
    metadata: {},
    rules: [
      {
        id: "r1",
        condition: "amount > 3000",
        action: "deny",
        params: { currency: "USDC" },
      },
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
    metadata: {},
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
    metadata: {},
    rules: [
      {
        id: "r4",
        condition: "chain NOT IN [ethereum, arbitrum, base]",
        action: "deny",
      },
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
    metadata: {},
    rules: [
      { id: "r5", condition: "token.isNew || amount > 5000", action: "flag" },
    ],
  },
] as Policy[];

export const DEMO_AUDIT_LOGS = [
  {
    id: "log-001",
    agentId: "agent-alpha-001",
    agent: "Alpha Trader",
    action: "swap",
    actionType: "swap",
    description: "Swap 1200 USDC → ETH on Uniswap V3",
    desc: "Swap 1200 USDC → ETH on Uniswap V3",
    decision: "approved",
    outcome: "approved",
    complianceStatus: "compliant",
    chain: "Ethereum",
    timestamp: hoursAgo(2),
    time: "2h ago",
    latency: "45ms",
    policyChecks: [
      {
        policyId: "pol-budget-001",
        result: true,
        reason: "Within daily limit",
      },
      {
        policyId: "pol-vendor-001",
        result: true,
        reason: "Uniswap is allowlisted",
      },
    ],
  },
  {
    id: "log-002",
    agentId: "agent-alpha-001",
    agent: "Alpha Trader",
    action: "swap",
    actionType: "swap",
    description: "Swap 5000 USDC → WBTC (exceeds single-tx limit)",
    desc: "Swap 5000 USDC → WBTC (exceeds single-tx limit)",
    decision: "denied",
    outcome: "denied",
    complianceStatus: "non-compliant",
    chain: "Ethereum",
    timestamp: hoursAgo(8),
    time: "8h ago",
    latency: "32ms",
    policyChecks: [
      {
        policyId: "pol-budget-001",
        result: false,
        reason: "Exceeds $3000 single transaction limit",
      },
    ],
  },
  {
    id: "log-003",
    agentId: "agent-beta-002",
    agent: "Beta Rebalancer",
    action: "transfer",
    actionType: "transfer",
    description: "Rebalance 3000 USDC to Aave lending pool",
    desc: "Rebalance 3000 USDC to Aave lending pool",
    decision: "approved",
    outcome: "approved",
    complianceStatus: "compliant",
    chain: "Arbitrum",
    timestamp: hoursAgo(1),
    time: "1h ago",
    latency: "28ms",
    policyChecks: [
      {
        policyId: "pol-budget-001",
        result: true,
        reason: "Within daily limit",
      },
      {
        policyId: "pol-chain-001",
        result: true,
        reason: "Arbitrum is allowed",
      },
    ],
  },
  {
    id: "log-004",
    agentId: "agent-delta-004",
    agent: "Delta Yield",
    action: "deposit",
    actionType: "deposit",
    description: "Deposit 2500 USDC to Compound V3",
    desc: "Deposit 2500 USDC to Compound V3",
    decision: "approved",
    outcome: "approved",
    complianceStatus: "compliant",
    chain: "Ethereum",
    timestamp: hoursAgo(3),
    time: "3h ago",
    latency: "51ms",
    policyChecks: [
      {
        policyId: "pol-budget-001",
        result: true,
        reason: "Within daily limit",
      },
      {
        policyId: "pol-vendor-001",
        result: true,
        reason: "Compound is allowlisted",
      },
    ],
  },
  {
    id: "log-005",
    agentId: "agent-gamma-003",
    agent: "Gamma Scanner",
    action: "swap",
    actionType: "swap",
    description: "Swap 400 USDC → ARB (held for human review)",
    desc: "Swap 400 USDC → ARB (held for human review)",
    decision: "held",
    outcome: "held",
    complianceStatus: "held",
    chain: "Base",
    timestamp: hoursAgo(12),
    time: "12h ago",
    latency: "39ms",
    policyChecks: [
      {
        policyId: "pol-budget-001",
        result: true,
        reason: "Within limit",
      },
      {
        policyId: "pol-approval-001",
        result: false,
        reason: "New token requires human approval",
      },
    ],
  },
] as AuditLog[];

export const DEMO_RUNS = [
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
] as Run[];

const AGENT_NAMES = ["Alpha Trader", "Beta Rebalancer", "Gamma Scanner", "Delta Yield"];
const AGENT_IDS = ["agent-alpha-001", "agent-beta-002", "agent-gamma-003", "agent-delta-004"];
const ACTIONS = ["swap", "transfer", "deposit", "withdraw", "stake"];
const CHAINS = ["Ethereum", "Arbitrum", "Base"];
const DECISIONS = ["approved", "approved", "approved", "denied", "held"] as const;

export function generateDemoAuditLog(): AuditLog {
  const agentIdx = Math.floor(Math.random() * AGENT_NAMES.length);
  const actionIdx = Math.floor(Math.random() * ACTIONS.length);
  const chainIdx = Math.floor(Math.random() * CHAINS.length);
  const decision = DECISIONS[Math.floor(Math.random() * DECISIONS.length)];
  const id = `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const agentName = AGENT_NAMES[agentIdx];
  const agentId = AGENT_IDS[agentIdx];
  const action = ACTIONS[actionIdx];
  const chain = CHAINS[chainIdx];
  const amount = Math.floor(100 + Math.random() * 4000);
  const description = `${action} ${amount} USDC on ${chain}`;
  const now = new Date();

  return {
    id,
    agentId,
    agent: agentName,
    action,
    actionType: action,
    description,
    desc: description,
    decision,
    outcome: decision === "approved" ? "approved" : decision === "denied" ? "denied" : "held",
    complianceStatus: decision === "approved" ? "compliant" : decision === "denied" ? "non-compliant" : "held",
    chain,
    timestamp: now.toISOString(),
    time: "Just now",
    latency: `${Math.floor(30 + Math.random() * 150)}ms`,
    policyChecks: [
      {
        policyId: "pol-budget-001",
        result: decision === "approved",
        reason:
          decision === "approved"
            ? "Within daily limit"
            : decision === "denied"
              ? "Exceeds budget threshold"
              : "Held for review",
      },
    ],
  } as AuditLog;
}
