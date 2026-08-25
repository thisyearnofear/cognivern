// Demo data for unauthenticated exploration mode
// Aligned with backend DemoDataService.ts — single source of truth schema
import type {
  Agent,
  AuditLog,
  Policy,
  Run,
  Workspace,
} from "@cognivern/shared";
import type {
  SealedBidRound,
  SealedBidRoundSummary,
  PartyVisibleBid,
} from "@/lib/api-client";

// ── Sealed-bid demo rounds ────────────────────────────────────────────
// The sealed-bid surface needs live-looking sample state so the page is not
// an empty list for guests / demo-tier workspaces (the API list is empty on
// a fresh ledger). Same shape as SealedBidRoundSummary; detail-view fields
// (bids, winner, settlement) are mirrored for the representative round so the
// round detail page renders fully.

// Each round carries the detail-view fields (bids, settlement) where they
// belong so both list projections and the round-detail page render fully.
export const DEMO_SEALED_BID_ROUNDS: SealedBidRound[] = [
  {
    roundId: "demo-sb-001",
    description: "Q3 security audit RFP — vendor selection",
    serviceCategory: "security-audit",
    status: "open",
    manager: "Auctioneer",
    deadline: new Date(Date.now() + 2 * 3600_000).toISOString(),
    maxBids: 5,
    bids: [
      {
        bidder: "Alice::demo",
        encryptedAmount: "enc:0",
        proposalHash: "0xaaa…",
        status: "pending",
        submittedAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
        index: 0,
      },
      {
        bidder: "Bob::demo",
        encryptedAmount: "enc:0",
        proposalHash: "0xbbb…",
        status: "pending",
        submittedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
        index: 1,
      },
    ],
    winner: null,
    winningBid: null,
    winningProposalHash: null,
    createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
    backend: "canton",
    createdByAgent: "agent-alpha-001",
  },
  {
    roundId: "demo-sb-002",
    description: "Smart contract audit — ERC-4626 vault",
    serviceCategory: "smart-contract",
    status: "closed",
    manager: "Auctioneer",
    deadline: new Date(Date.now() - 2 * 3600_000).toISOString(),
    maxBids: 5,
    bids: [
      {
        bidder: "Alice::demo",
        encryptedAmount: "enc:0",
        proposalHash: "0xaaa…",
        status: "pending",
        submittedAt: new Date(Date.now() - 24 * 3600_000).toISOString(),
        index: 0,
      },
    ],
    winner: null,
    winningBid: null,
    winningProposalHash: null,
    createdAt: new Date(Date.now() - 26 * 3600_000).toISOString(),
    backend: "canton",
  },
  {
    roundId: "demo-sb-003",
    description: "Yield strategy research — RWA pools",
    serviceCategory: "research",
    status: "revealed",
    manager: "Auctioneer",
    deadline: new Date(Date.now() - 50 * 3600_000).toISOString(),
    maxBids: 5,
    bids: [],
    winner: "Alice::demo",
    winningBid: 12400,
    winningProposalHash: "0xabc…",
    createdAt: new Date(Date.now() - 74 * 3600_000).toISOString(),
    backend: "canton",
    settledAssetCid: "demo-settled-001",
    settlementAmount: 12400,
    settlementAssetTag: "USDC",
  },
  {
    roundId: "demo-sb-004",
    description: "KYC/AML compliance workflow build",
    serviceCategory: "compliance",
    status: "open",
    manager: "Auctioneer",
    deadline: new Date(Date.now() + 12 * 3600_000).toISOString(),
    maxBids: 4,
    bids: [],
    winner: null,
    winningBid: null,
    winningProposalHash: null,
    createdAt: new Date(Date.now() - 1 * 3600_000).toISOString(),
    createdByAgent: "agent-beta-002",
  },
  {
    roundId: "demo-sb-005",
    description: "AI agent data-labeling vendor RFP",
    serviceCategory: "data-services",
    status: "revealed",
    manager: "Auctioneer",
    deadline: new Date(Date.now() - 30 * 3600_000).toISOString(),
    maxBids: 5,
    bids: [],
    winner: "Charlie::demo",
    winningBid: 9800,
    winningProposalHash: "0xdef…",
    createdAt: new Date(Date.now() - 54 * 3600_000).toISOString(),
    backend: "canton",
    settledAssetCid: "demo-settled-002",
    settlementAmount: 9800,
    settlementAssetTag: "USDC",
  },
  {
    roundId: "demo-sb-006",
    description: "On-chain analytics provider evaluation",
    serviceCategory: "analytics",
    status: "open",
    manager: "Auctioneer",
    deadline: new Date(Date.now() + 24 * 3600_000).toISOString(),
    maxBids: 5,
    bids: [],
    winner: null,
    winningBid: null,
    winningProposalHash: null,
    createdAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    backend: "canton",
  },
];

// Summary projection of the demo rounds — the list page consumes summaries.
export const DEMO_SEALED_BID_ROUND_SUMMARIES: SealedBidRoundSummary[] =
  DEMO_SEALED_BID_ROUNDS.map((r) => ({
    roundId: r.roundId,
    description: r.description,
    serviceCategory: r.serviceCategory,
    status: r.status,
    bidCount: r.bids.length,
    maxBids: r.maxBids,
    deadline: r.deadline,
    winner: r.winner,
    winningBid: r.winningBid,
    createdAt: r.createdAt,
    backend: r.backend,
    createdByAgent: r.createdByAgent,
    governanceRunId: r.governanceRunId,
  }));

// Party-view truth for demo rounds: for a revealed round each party sees
// exactly what the ledger would disclose (per-party disclosure model).
export const DEMO_SEALED_BID_PARTY_VIEW: Record<
  string,
  { party: string; visibleBids: PartyVisibleBid[] }
> = {
  "demo-sb-003::Auctioneer": {
    party: "Auctioneer",
    visibleBids: [
      {
        bidder: "Alice::demo",
        amountUsd: 12400,
        proposalHash: "0xabc…",
        index: 0,
      },
    ],
  },
  "demo-sb-003::Alice": {
    party: "Alice::demo",
    visibleBids: [
      {
        bidder: "Alice::demo",
        amountUsd: 12400,
        proposalHash: "0xabc…",
        index: 0,
      },
    ],
  },
  "demo-sb-003::Bob": {
    party: "Bob",
    visibleBids: [],
  },
  "demo-sb-003::Charlie": {
    party: "Charlie",
    visibleBids: [],
  },
  "demo-sb-005::Auctioneer": {
    party: "Auctioneer",
    visibleBids: [
      {
        bidder: "Charlie::demo",
        amountUsd: 9800,
        proposalHash: "0xdef…",
        index: 0,
      },
    ],
  },
  "demo-sb-005::Charlie": {
    party: "Charlie::demo",
    visibleBids: [
      {
        bidder: "Charlie::demo",
        amountUsd: 9800,
        proposalHash: "0xdef…",
        index: 0,
      },
    ],
  },
  "demo-sb-005::Alice": {
    party: "Alice",
    visibleBids: [],
  },
  "demo-sb-005::Bob": {
    party: "Bob",
    visibleBids: [],
  },
};

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
    source: "demo" as const,
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
    source: "demo" as const,
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
    source: "demo" as const,
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
    source: "demo" as const,
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
    // Real mainnet probe proofs (docs/XLAYER_PROOF_V2.md, run
    // bcebcdef-43f5-44f9-b03c-ff1a635f7f2c) so demo-mode explorer links
    // resolve to genuine, verifiable transactions.
    evidence: {
      zeroGProofV2: {
        proofId:
          "0x5ce9f1b3530832ecc689a76cfb2c0364960ace856f43e62dbd06fdf1a77bbe14",
        runIdHash:
          "0x52fe6eae6d0f858f3c3a522ff61f8f075f58d0df67345a52c15b683e007e8d59",
        evidenceHash:
          "0x7a8db9687d61bd2bfb601b008702b7d7b37f03255710313351c5e479ee92e1d7",
        policySetHash:
          "0x0edc31540c75ba032c306fe4ab6871cbdb164477a30589a5be71e65640fad06e",
        txHash:
          "0x98510a60f3d8a1efdf30bb482f4b66b0eeb7a253ceec2d19047f18aede2e4ae9",
        blockNumber: 42262905,
        chainId: 16661,
        network: "0g-mainnet",
      },
      xlayerProofV2: {
        proofId:
          "0x6c6240c20ccb8b86ddba4d3f18dbaebad849f043301cb1c561387b18e75f5c6f",
        runIdHash:
          "0x52fe6eae6d0f858f3c3a522ff61f8f075f58d0df67345a52c15b683e007e8d59",
        evidenceHash:
          "0x7a8db9687d61bd2bfb601b008702b7d7b37f03255710313351c5e479ee92e1d7",
        policySetHash:
          "0x0edc31540c75ba032c306fe4ab6871cbdb164477a30589a5be71e65640fad06e",
        txHash:
          "0x32c740619c97bcc68d92deb371026f4c1170958f2e13a6ae11d594ffc47b1a13",
        blockNumber: 68566290,
        chainId: 196,
        network: "xlayer-mainnet",
      },
    },
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
