// Rich demo data seed for no-wallet exploration mode
import type { Agent, AuditLog, Policy, Run, Workspace } from '@cognivern/shared';

export const DEMO_WORKSPACE: Workspace = {
  id: 'demo-ws-001',
  name: 'Demo Treasury',
  ownerId: 'demo-user',
  tier: 'demo',
  createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date().toISOString(),
};

export const DEMO_AGENTS = [
  {
    id: 'agent-yield-01',
    name: 'YieldHunter-01',
    role: 'DeFi Yield Optimiser',
    status: 'active' as const,
    trades: 142,
    budget: '12.4 ETH',
    chain: 'Ethereum',
    spendHistory: [
      { amount: 2.5, currency: 'ETH', timestamp: new Date(Date.now() - 3600 * 1000).toISOString(), decision: 'approved' },
      { amount: 1.8, currency: 'ETH', timestamp: new Date(Date.now() - 7200 * 1000).toISOString(), decision: 'approved' },
      { amount: 5.0, currency: 'ETH', timestamp: new Date(Date.now() - 14400 * 1000).toISOString(), decision: 'denied' },
    ],
  },
  {
    id: 'agent-arb-02',
    name: 'Arbitrage-07',
    role: 'Cross-Chain Arbitrage',
    status: 'active' as const,
    trades: 89,
    budget: '45.2k USDC',
    chain: 'Arbitrum',
    spendHistory: [
      { amount: 3200, currency: 'USDC', timestamp: new Date(Date.now() - 1800 * 1000).toISOString(), decision: 'approved' },
      { amount: 8000, currency: 'USDC', timestamp: new Date(Date.now() - 5400 * 1000).toISOString(), decision: 'approved' },
    ],
  },
  {
    id: 'agent-mev-03',
    name: 'MEV-Guardian',
    role: 'MEV Protection & Relay',
    status: 'paused' as const,
    trades: 34,
    budget: '3.1 ETH',
    chain: 'Base',
    spendHistory: [
      { amount: 0.5, currency: 'ETH', timestamp: new Date(Date.now() - 10800 * 1000).toISOString(), decision: 'approved' },
    ],
  },
  {
    id: 'agent-fhe-04',
    name: 'ConfidentialSwap-A1',
    role: 'FHE-Protected DEX',
    status: 'active' as const,
    trades: 12,
    budget: 'Encrypted',
    chain: 'Fhenix',
    spendHistory: [],
  },
] as Agent[];

export const DEMO_POLICIES = [
  {
    id: 'policy-budget-01',
    name: 'Daily Spend Limit',
    type: 'budget',
    description: 'No single agent may spend more than 10 ETH equivalent in a 24-hour window.',
    status: 'active',
    agents: 3,
    violations: 1,
    metadata: {},
  },
  {
    id: 'policy-allow-02',
    name: 'Vendor Allowlist',
    type: 'allowlist',
    description: 'Agent spends restricted to pre-approved contract addresses and DEXs.',
    status: 'active',
    agents: 4,
    violations: 0,
    metadata: {},
  },
  {
    id: 'policy-chain-03',
    name: 'Chain Restriction',
    type: 'chain',
    description: 'YieldHunter restricted to Ethereum and Base only.',
    status: 'active',
    agents: 1,
    violations: 0,
    metadata: {},
  },
  {
    id: 'policy-fhe-04',
    name: 'Confidential Budget (FHE)',
    type: 'confidential-budget',
    description: 'Encrypted budget enforced on-chain via Fhenix FHE. Agent cannot see caps.',
    status: 'active',
    agents: 1,
    violations: 0,
    metadata: { confidential: true, chain: 'fhenix-base-sepolia', fheProvider: 'cofhe-sdk' },
  },
] as Policy[];

export const DEMO_AUDIT_LOGS = [
  {
    id: 'log-001',
    agentId: 'agent-yield-01',
    agent: 'YieldHunter-01',
    action: 'swap',
    actionType: 'swap',
    description: 'Swapped 2.5 ETH for 4,812 USDC on Uniswap V3',
    desc: 'Swapped 2.5 ETH for 4,812 USDC on Uniswap V3',
    decision: 'allowed',
    outcome: 'allowed',
    complianceStatus: 'compliant',
    chain: 'Ethereum',
    timestamp: new Date(Date.now() - 3600 * 1000).toISOString(),
    time: '1h ago',
    latency: '124ms',
    policyChecks: [
      { policyId: 'policy-budget-01', result: true, reason: 'Within daily limit' },
      { policyId: 'policy-allow-02', result: true, reason: 'Uniswap V3 is allowlisted' },
    ],
  },
  {
    id: 'log-002',
    agentId: 'agent-arb-02',
    agent: 'Arbitrage-07',
    action: 'bridge',
    actionType: 'bridge',
    description: 'Bridged 3,200 USDC from Arbitrum to Base via Across',
    desc: 'Bridged 3,200 USDC from Arbitrum to Base via Across',
    decision: 'allowed',
    outcome: 'allowed',
    complianceStatus: 'compliant',
    chain: 'Arbitrum',
    timestamp: new Date(Date.now() - 1800 * 1000).toISOString(),
    time: '30m ago',
    latency: '89ms',
    policyChecks: [
      { policyId: 'policy-budget-01', result: true, reason: 'Within daily limit' },
    ],
  },
  {
    id: 'log-003',
    agentId: 'agent-yield-01',
    agent: 'YieldHunter-01',
    action: 'stake',
    actionType: 'stake',
    description: 'Attempted to stake 5.0 ETH into unverified contract 0xbad...cafe',
    desc: 'Attempted to stake 5.0 ETH into unverified contract 0xbad...cafe',
    decision: 'denied',
    outcome: 'denied',
    complianceStatus: 'non-compliant',
    chain: 'Ethereum',
    timestamp: new Date(Date.now() - 14400 * 1000).toISOString(),
    time: '4h ago',
    latency: '45ms',
    policyChecks: [
      { policyId: 'policy-allow-02', result: false, reason: 'Contract 0xbad...cafe not in allowlist' },
    ],
  },
  {
    id: 'log-004',
    agentId: 'agent-mev-03',
    agent: 'MEV-Guardian',
    action: 'relay',
    actionType: 'relay',
    description: 'Relayed batch of 12 transactions via Flashbots Protect',
    desc: 'Relayed batch of 12 transactions via Flashbots Protect',
    decision: 'allowed',
    outcome: 'allowed',
    complianceStatus: 'compliant',
    chain: 'Base',
    timestamp: new Date(Date.now() - 10800 * 1000).toISOString(),
    time: '3h ago',
    latency: '203ms',
    policyChecks: [
      { policyId: 'policy-budget-01', result: true, reason: 'Within daily limit' },
      { policyId: 'policy-allow-02', result: true, reason: 'Flashbots is allowlisted' },
    ],
  },
  {
    id: 'log-005',
    agentId: 'agent-fhe-04',
    agent: 'ConfidentialSwap-A1',
    action: 'confidential-swap',
    actionType: 'confidential-swap',
    description: 'FHE swap evaluated in ciphertext — limit check passed',
    desc: 'FHE swap evaluated in ciphertext — limit check passed',
    decision: 'allowed',
    outcome: 'allowed',
    complianceStatus: 'compliant',
    chain: 'Fhenix',
    timestamp: new Date(Date.now() - 7200 * 1000).toISOString(),
    time: '2h ago',
    latency: '1.2s',
    policyChecks: [
      { policyId: 'policy-fhe-04', result: true, reason: 'FHE evaluation: within encrypted budget' },
    ],
  },
  {
    id: 'log-006',
    agentId: 'agent-arb-02',
    agent: 'Arbitrage-07',
    action: 'swap',
    actionType: 'swap',
    description: 'Swapped 8,000 USDC for 7,940 USDT on Curve',
    desc: 'Swapped 8,000 USDC for 7,940 USDT on Curve',
    decision: 'allowed',
    outcome: 'allowed',
    complianceStatus: 'compliant',
    chain: 'Arbitrum',
    timestamp: new Date(Date.now() - 5400 * 1000).toISOString(),
    time: '1.5h ago',
    latency: '67ms',
    policyChecks: [
      { policyId: 'policy-budget-01', result: true, reason: 'Within daily limit' },
      { policyId: 'policy-allow-02', result: true, reason: 'Curve is allowlisted' },
    ],
  },
] as AuditLog[];

export const DEMO_RUNS = [
  {
    id: 'run-001',
    workflow: 'Yield Rebalance',
    status: 'completed',
    mode: 'auto',
    steps: 4,
    duration: '2.3s',
    artifacts: 3,
    timestamp: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
  {
    id: 'run-002',
    workflow: 'Arbitrage Scan',
    status: 'running',
    mode: 'auto',
    steps: 12,
    duration: '8.1s',
    artifacts: 7,
    timestamp: new Date(Date.now() - 1800 * 1000).toISOString(),
  },
  {
    id: 'run-003',
    workflow: 'MEV Protection Batch',
    status: 'completed',
    mode: 'manual',
    steps: 2,
    duration: '1.1s',
    artifacts: 1,
    timestamp: new Date(Date.now() - 10800 * 1000).toISOString(),
  },
  {
    id: 'run-004',
    workflow: 'FHE Swap Evaluation',
    status: 'completed',
    mode: 'auto',
    steps: 6,
    duration: '3.4s',
    artifacts: 4,
    timestamp: new Date(Date.now() - 7200 * 1000).toISOString(),
  },
] as Run[];

const AGENT_NAMES = ['YieldHunter-01', 'Arbitrage-07', 'MEV-Guardian', 'ConfidentialSwap-A1'];
const ACTIONS = ['swap', 'bridge', 'stake', 'relay', 'withdraw', 'deposit'];
const CHAINS = ['Ethereum', 'Arbitrum', 'Base', 'Fhenix'];
const DECISIONS = ['approved', 'approved', 'approved', 'denied'] as const;

export function generateDemoAuditLog(): AuditLog {
  const agentIdx = Math.floor(Math.random() * AGENT_NAMES.length);
  const actionIdx = Math.floor(Math.random() * ACTIONS.length);
  const chainIdx = Math.floor(Math.random() * CHAINS.length);
  const decision = DECISIONS[Math.floor(Math.random() * DECISIONS.length)];
  const id = `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const agentName = AGENT_NAMES[agentIdx];
  const action = ACTIONS[actionIdx];
  const chain = CHAINS[chainIdx];
  const description = `${action} ${Math.random() > 0.5 ? 'executed' : 'attempted'} on ${chain}`;
  const now = new Date();

  return {
    id,
    agentId: DEMO_AGENTS[agentIdx].id,
    agent: agentName,
    action,
    actionType: action,
    description,
    desc: description,
    decision,
    outcome: decision === 'approved' ? 'allowed' : 'denied',
    complianceStatus: decision === 'approved' ? 'compliant' : 'non-compliant',
    chain,
    timestamp: now.toISOString(),
    time: 'Just now',
    latency: `${Math.floor(40 + Math.random() * 200)}ms`,
    policyChecks: [
      {
        policyId: 'policy-budget-01',
        result: decision === 'approved',
        reason: decision === 'approved' ? 'Within daily limit' : 'Exceeds daily budget threshold',
      },
    ],
  } as AuditLog;
}
