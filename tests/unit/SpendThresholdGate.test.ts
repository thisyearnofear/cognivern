import { describe, it, expect } from 'vitest';
import { OwsWalletPolicyEvaluator } from '@backend/services/blockchain/OwsWalletPolicy.js';
import type {
  ConfidentialPolicyEvaluator,
} from '@backend/services/blockchain/confidentialEvaluator.js';
import type { ConfidentialSpendDecision } from '@backend/services/blockchain/FhenixPolicyService.js';
import type { Policy } from '@backend/types/Policy.js';
import type { AgentAction } from '@backend/types/Agent.js';
import type {
  SpendIntent,
  SpendExecutionContext,
} from '@backend/services/blockchain/OwsWalletService.js';
import { meetsApprovalThreshold } from '@backend/services/blockchain/spendThreshold.js';
import type { PolicyEnforcementService } from '@backend/services/governance/PolicyEnforcementService.js';

/**
 * Threshold gate + the confidential (FHE) spend path.
 *
 * The policy-level `approvalThreshold` gate lives in `OwsWalletService.execute`
 * after the policy decision, keyed on `decision.status === 'approved'`. A
 * confidential policy evaluates via FHE; when the evaluator returns `approve`,
 * `evaluatePolicyChecks` maps that to `decision.status: 'approved'` — so it
 * reaches the SAME gate. These tests pin that link directly against the policy
 * evaluator (no need to drive the full spend/broadcast path): a confidential-
 * approved spend that meets the policy threshold is gated to a hold, exactly
 * like a plain spend. A confidential `hold`/`deny` short-circuits before the
 * gate (no double-hold). `intent.amount` is plaintext wei even in confidential
 * mode (`BigInt(intent.amount)` is read by the confidential branch too).
 */

function fakeConfidentialService(outcome: ConfidentialSpendDecision['outcome']): ConfidentialPolicyEvaluator {
  return {
    async evaluateEncrypted(): Promise<ConfidentialSpendDecision> {
      return {
        decisionId: '0x' + 'd'.repeat(64),
        outcome,
        attestation: '0x' + 'a'.repeat(64),
        agentId: 'agent-1',
        policyId: 'confidential-policy',
        timestamp: new Date().toISOString(),
      };
    },
  };
}

const confidentialPolicy: Policy = {
  id: 'confidential-policy',
  name: 'Confidential Spend Policy',
  description: 'FHE-evaluated spend policy with a gateway approval threshold',
  version: '1.0.0',
  rules: [],
  metadata: { confidential: true },
  createdAt: 't',
  updatedAt: 't',
  status: 'active',
  approvalThreshold: '1000000000000000000', // 1 ETH in wei
};

const highAmountIntent: SpendIntent = {
  id: 'intent-conf-1',
  agentId: 'agent-1',
  recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  amount: '2000000000000000000', // 2 ETH — above the 1 ETH threshold
  asset: 'OKB',
  reason: 'confidential spend above threshold',
  timestamp: 't',
  metadata: { encryptedAmount: '0xencrypted', policyId: 'confidential-policy' },
};

const ctx: SpendExecutionContext = {
  confidential: true,
  encryptedAmount: '0xencrypted',
  vendorHash: '0x' + 'v'.repeat(64),
};

// A policyEnforcement stub — the confidential branch of evaluatePolicyChecks
// does not call it (only the plain branch does), so it must merely satisfy the type.
const policyEnforcement = {} as unknown as PolicyEnforcementService;

describe('Threshold gate — confidential (FHE) spend path', () => {
  const evaluator = new OwsWalletPolicyEvaluator();

  it('maps an FHE approve to decision.status "approved" (reaches the threshold gate)', async () => {
    const action = evaluator.toAgentAction(highAmountIntent) as AgentAction;
    const { decision } = await evaluator.evaluatePolicyChecks(
      highAmountIntent,
      action,
      confidentialPolicy,
      ctx,
      policyEnforcement,
      fakeConfidentialService('approve'),
    );
    expect(decision?.status).toBe('approved');
    // The gate in execute() fires on approved + meetsApprovalThreshold — pin
    // that the amount actually meets the confidential policy's threshold, so a
    // confidential-approved spend that meets the threshold is held for operator
    // signing (same path as a plain spend).
    expect(meetsApprovalThreshold(highAmountIntent.amount, confidentialPolicy.approvalThreshold)).toBe(true);
  });

  it('holds a confidential spend the FHE itself holds before the gateway gate (no double-hold)', async () => {
    const action = evaluator.toAgentAction(highAmountIntent) as AgentAction;
    const { decision } = await evaluator.evaluatePolicyChecks(
      highAmountIntent,
      action,
      confidentialPolicy,
      ctx,
      policyEnforcement,
      fakeConfidentialService('hold'),
    );
    expect(decision?.status).toBe('held');
  });

  it('denies a confidential spend the FHE denies (gate skipped)', async () => {
    const action = evaluator.toAgentAction(highAmountIntent) as AgentAction;
    const { decision } = await evaluator.evaluatePolicyChecks(
      highAmountIntent,
      action,
      confidentialPolicy,
      ctx,
      policyEnforcement,
      fakeConfidentialService('deny'),
    );
    expect(decision?.status).toBe('denied');
  });

  it('does not gate a below-threshold confidential-approved spend', async () => {
    const belowIntent: SpendIntent = { ...highAmountIntent, amount: '500000000000000000' }; // 0.5 ETH
    const action = evaluator.toAgentAction(belowIntent) as AgentAction;
    const { decision } = await evaluator.evaluatePolicyChecks(
      belowIntent,
      action,
      confidentialPolicy,
      ctx,
      policyEnforcement,
      fakeConfidentialService('approve'),
    );
    expect(decision?.status).toBe('approved');
    // Below threshold -> the gateway would NOT hold; it proceeds to handleApprove.
    expect(meetsApprovalThreshold(belowIntent.amount, confidentialPolicy.approvalThreshold)).toBe(false);
  });
});

