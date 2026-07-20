import { describe, expect, it } from 'vitest';
import {
  createSealedBidGovernance,
  hashSealedBidEvent,
} from '@backend/cre/workflows/sealedBidGovernance.js';
import { CreRun } from '@backend/cre/types.js';

class MemoryRunStore {
  private readonly runs = new Map<string, CreRun>();

  async add(run: CreRun) {
    this.runs.set(run.runId, run);
  }

  async get(runId: string) {
    return this.runs.get(runId);
  }

  async replace(run: CreRun) {
    this.runs.set(run.runId, run);
  }

  async list() {
    return [...this.runs.values()];
  }
}

describe('sealed-bid governance workflow', () => {
  it('persists a hash-linked private procurement timeline', async () => {
    const governance = createSealedBidGovernance(new MemoryRunStore());
    const { runId } = await governance.startAgentRoundCreation({
      agentId: 'procurement-agent-1',
      roundId: 'round-1',
      roundParams: {
        description: 'Security audit RFP',
        serviceCategory: 'security-audit',
        maxBids: 5,
        deadline: '2020-01-01T00:00:00.000Z',
        settlementAmount: 74_500,
        settlementAssetTag: 'USDC',
      },
    });

    const bid = await governance.recordSealedBidEvent({
      runId,
      eventType: 'bid_submitted',
      payload: {
        roundId: 'round-1',
        bidder: 'alice-cognivern',
        proposalHash: '0xcommitment',
        index: 0,
      },
    });
    const policy = await governance.evaluateClosePolicy({
      runId,
      roundId: 'round-1',
      bidCount: 3,
      deadline: '2020-01-01T00:00:00.000Z',
    });
    const timeline = await governance.getGovernanceTimeline(runId);

    expect(policy.allowed).toBe(true);
    expect(timeline.agentId).toBe('procurement-agent-1');
    expect(timeline.events.map((event) => event.eventType)).toEqual([
      'round_created',
      'bid_submitted',
      'policy_checked',
    ]);
    expect(timeline.events[1].eventHash).toBe(
      hashSealedBidEvent({
        runId,
        eventType: 'bid_submitted',
        timestamp: bid.timestamp,
        payload: timeline.events[1].payload,
      }),
    );
    expect(timeline.events[1].payload).not.toHaveProperty('amountUsd');
  });

  it('fails closed when a close policy check does not pass', async () => {
    const governance = createSealedBidGovernance(new MemoryRunStore());
    const { runId } = await governance.startAgentRoundCreation({
      agentId: 'procurement-agent-1',
      roundId: 'round-2',
      roundParams: {
        description: 'Cloud hosting RFP',
        serviceCategory: 'hosting',
        maxBids: 5,
        deadline: '2999-01-01T00:00:00.000Z',
        settlementAmount: 150_000,
      },
    });

    const result = await governance.evaluateClosePolicy({
      runId,
      roundId: 'round-2',
      bidCount: 2,
      deadline: '2999-01-01T00:00:00.000Z',
    });

    expect(result.allowed).toBe(false);
    expect(result.checks).toEqual([
      expect.objectContaining({ name: 'min_bids', passed: false }),
      expect.objectContaining({ name: 'deadline_elapsed', passed: false }),
      expect.objectContaining({ name: 'budget_within_limit', passed: false }),
    ]);
  });
});
