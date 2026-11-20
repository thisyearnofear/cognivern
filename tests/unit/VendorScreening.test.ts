import { describe, expect, it } from 'vitest';
import {
  VendorScreeningService,
  buildScreeningBrief,
  evaluateScreeningGate,
  evaluateVendorVerdict,
  latestScreenVerdicts,
} from '../../src/backend/services/blockchain/sealed-bid/VendorScreening.js';
import type { AnjomanTaskResult } from '../../src/backend/services/anjoman/types.js';
import type {
  SealedBidRound,
  BidRecord,
} from '../../src/backend/services/blockchain/sealed-bid/types.js';
import type { TelegraphGovernedCallResult } from '../../src/backend/services/telegraph/TelegraphGovernanceHelper.js';
import type { CreRun } from '../../src/backend/cre/types.js';

function taskResult(overrides: Partial<AnjomanTaskResult>): AnjomanTaskResult {
  return {
    success: true,
    status: 'completed',
    latencyMs: 42,
    ...overrides,
  };
}

describe('evaluateVendorVerdict', () => {
  it('reads the instructed VERDICT line first', () => {
    expect(
      evaluateVendorVerdict(taskResult({ answer: 'All clear.\nVERDICT: CLEAR' })).verdict,
    ).toBe('clear');
    expect(evaluateVendorVerdict(taskResult({ answer: 'verdict: hit' })).verdict).toBe('hit');
    expect(evaluateVendorVerdict(taskResult({ answer: 'VERDICT :  UNKNOWN' })).verdict).toBe(
      'unknown',
    );
  });

  it('lets the VERDICT marker outrank free text', () => {
    const { verdict } = evaluateVendorVerdict(
      taskResult({
        answer: 'Vendor is not sanctioned anywhere.\nVERDICT: UNKNOWN',
      }),
    );
    expect(verdict).toBe('unknown');
  });

  it('falls back to structured answers via the compliance scanner', () => {
    expect(
      evaluateVendorVerdict(taskResult({ answer: '', data: { sanctions: { listed: true } } }))
        .verdict,
    ).toBe('hit');
    expect(
      evaluateVendorVerdict(taskResult({ answer: '', data: { result: { no_match: true } } }))
        .verdict,
    ).toBe('clear');
    expect(
      evaluateVendorVerdict(taskResult({ answer: '', data: { riskScore: 0.9 } })).verdict,
    ).toBe('hit');
  });

  it('scans answer text with negation guards when no marker exists', () => {
    expect(
      evaluateVendorVerdict(
        taskResult({ answer: 'Vendor is not sanctioned and has a clean record.' }),
      ).verdict,
    ).toBe('clear');
    expect(
      evaluateVendorVerdict(taskResult({ answer: 'Vendor appears on the OFAC SDN list.' })).verdict,
    ).toBe('hit');
    // "not sanctioned" must not false-positive on "sanctioned"…
    expect(
      evaluateVendorVerdict(taskResult({ answer: 'Not sanctioned, but flagged for fraud.' }))
        .verdict,
    ).toBe('hit');
  });

  it('returns unknown when nothing recognizable is present', () => {
    expect(evaluateVendorVerdict(taskResult({ answer: 'A company in Berlin.' })).verdict).toBe(
      'unknown',
    );
    expect(evaluateVendorVerdict(taskResult({})).verdict).toBe('unknown');
  });
});

describe('buildScreeningBrief', () => {
  it('carries bidder, round context, details and the VERDICT contract', () => {
    const brief = buildScreeningBrief(
      { description: 'Custody RFP', serviceCategory: 'custody' },
      'acme-corp',
      'wallet 0xabc',
    );
    expect(brief).toContain('acme-corp');
    expect(brief).toContain('custody');
    expect(brief).toContain('Custody RFP');
    expect(brief).toContain('wallet 0xabc');
    expect(brief).toContain('VERDICT: CLEAR');
  });
});

describe('latestScreenVerdicts', () => {
  it('reduces vendor_screened events to the latest verdict per bidder', () => {
    const events = [
      {
        eventType: 'round_created',
        payload: { roundId: 'r1' },
      },
      {
        eventType: 'vendor_screened',
        payload: { bidder: 'alice', verdict: 'unknown' },
      },
      {
        eventType: 'vendor_screened',
        payload: { bidder: 'alice', verdict: 'clear' },
      },
      {
        eventType: 'vendor_screened',
        payload: { bidder: 'bob', verdict: 'hit' },
      },
      // malformed entries are ignored
      { eventType: 'vendor_screened', payload: { bidder: 'eve', verdict: 'maybe' } },
    ];
    expect(latestScreenVerdicts(events)).toEqual({ alice: 'clear', bob: 'hit' });
  });
});

describe('evaluateScreeningGate', () => {
  const bidders = ['alice', 'bob'];

  it('specific: allows only a clear verdict on the target', () => {
    expect(
      evaluateScreeningGate({
        selectionMethod: 'specific',
        specificBidder: 'alice',
        bidders,
        verdicts: { alice: 'clear' },
      }).allowed,
    ).toBe(true);
    expect(
      evaluateScreeningGate({
        selectionMethod: 'specific',
        specificBidder: 'alice',
        bidders,
        verdicts: { alice: 'hit' },
      }).allowed,
    ).toBe(false);
    expect(
      evaluateScreeningGate({
        selectionMethod: 'specific',
        specificBidder: 'alice',
        bidders,
        verdicts: {},
      }).allowed,
    ).toBe(false);
    expect(
      evaluateScreeningGate({
        selectionMethod: 'specific',
        bidders,
        verdicts: { alice: 'clear' },
      }).allowed,
    ).toBe(false);
  });

  it('lowest-bid: allows only when every bidder screened clear', () => {
    expect(
      evaluateScreeningGate({
        selectionMethod: 'lowest-bid',
        bidders,
        verdicts: { alice: 'clear', bob: 'clear' },
      }).allowed,
    ).toBe(true);
    // a hit in the pool could win — the winner is computed on-ledger
    expect(
      evaluateScreeningGate({
        selectionMethod: 'lowest-bid',
        bidders,
        verdicts: { alice: 'clear', bob: 'hit' },
      }).allowed,
    ).toBe(false);
    expect(
      evaluateScreeningGate({
        selectionMethod: 'lowest-bid',
        bidders,
        verdicts: { alice: 'clear' },
      }).allowed,
    ).toBe(false);
    expect(
      evaluateScreeningGate({
        selectionMethod: 'lowest-bid',
        bidders,
        verdicts: { alice: 'clear', bob: 'unknown' },
      }).allowed,
    ).toBe(false);
  });
});

describe('VendorScreeningService.screenBidders', () => {
  function bid(bidder: string, index: number): BidRecord {
    return {
      bidder,
      encryptedAmount: '0',
      proposalHash: `h${index}`,
      status: 'pending',
      submittedAt: '2026-11-20T00:00:00.000Z',
      index,
    };
  }

  function round(overrides: Partial<SealedBidRound> = {}): SealedBidRound {
    return {
      roundId: 'round-1',
      description: 'Custody vendor RFP',
      serviceCategory: 'custody',
      manager: 'Auctioneer',
      deadline: '2026-11-25T00:00:00.000Z',
      maxBids: 5,
      status: 'closed',
      bids: [bid('alice', 0), bid('bob', 1)],
      winner: null,
      winningBid: null,
      winningProposalHash: null,
      createdAt: '2026-11-20T00:00:00.000Z',
      governanceRunId: 'gov-run-1',
      ...overrides,
    };
  }

  function governed(answer: string, costUsd = '0.05') {
    return {
      success: true,
      status: 'held' as const,
      response: {
        success: true,
        data: taskResult({ answer, costUsd, jobId: 'job-1' }),
        metadata: {
          minerId: 'anjoman',
          minerName: 'Anjoman delegated task',
          confidence: null,
          latencyMs: 1,
          costUsd,
          timestamp: '2026-11-20T00:00:00.000Z',
        },
      },
    } as TelegraphGovernedCallResult<AnjomanTaskResult>;
  }

  function makeService(overrides: {
    rounds?: SealedBidRound | null;
    runTask?: (req: {
      task: { message?: string };
    }) => Promise<TelegraphGovernedCallResult<AnjomanTaskResult>>;
    recordEvent?: (params: {
      eventType: string;
      payload: Record<string, unknown>;
    }) => Promise<unknown>;
    maxBidders?: number;
  }) {
    const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
    const service = new VendorScreeningService({
      sealedBidService: {
        getRound: async () => ('rounds' in overrides ? (overrides.rounds ?? null) : round()),
      },
      runTask: (overrides.runTask ?? (async () => governed('VERDICT: CLEAR'))) as never,
      recordRun: async () => ({ runId: 'screen-run-1' }) as CreRun,
      recordEvent: (async (params: { eventType: string; payload: Record<string, unknown> }) => {
        events.push(params);
        return { eventHash: 'h', timestamp: 't' };
      }) as never,
      maxBidders: overrides.maxBidders,
    });
    return { service, events };
  }

  it('screens every bidder and appends one vendor_screened event each', async () => {
    const { service, events } = makeService({});
    const result = await service.screenBidders({
      roundId: 'round-1',
      agentId: 'agent-1',
      workspaceId: 'ws-1',
    });
    expect(result.screenings).toHaveLength(2);
    expect(result.screenings.map((s) => s.bidder)).toEqual(['alice', 'bob']);
    expect(result.screenings.every((s) => s.verdict === 'clear')).toBe(true);
    expect(result.screenings.every((s) => s.runId === 'screen-run-1')).toBe(true);
    expect(result.totalCostUsd).toBe('0.1000');
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe('vendor_screened');
    expect(events[0].payload).toMatchObject({
      roundId: 'round-1',
      bidder: 'alice',
      verdict: 'clear',
      screeningRunId: 'screen-run-1',
      jobId: 'job-1',
    });
  });

  it('builds a per-bidder brief containing the vendor identity', async () => {
    const messages: string[] = [];
    const { service } = makeService({
      runTask: async (req) => {
        messages.push(req.task.message ?? '');
        return governed('VERDICT: HIT');
      },
    });
    await service.screenBidders({
      roundId: 'round-1',
      agentId: 'agent-1',
      vendorDetails: { alice: 'acme.eth' },
    });
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain('alice');
    expect(messages[0]).toContain('acme.eth');
    expect(messages[1]).toContain('bob');
  });

  it('isolates a per-bidder task failure instead of losing the batch', async () => {
    let calls = 0;
    const { service, events } = makeService({
      runTask: async () => {
        calls += 1;
        if (calls === 2) throw new Error('anjoman down');
        return governed('VERDICT: CLEAR');
      },
    });
    const result = await service.screenBidders({ roundId: 'round-1', agentId: 'a' });
    expect(result.screenings[0].verdict).toBe('clear');
    expect(result.screenings[1].verdict).toBe('unknown');
    expect(result.screenings[1].detail).toContain('anjoman down');
    // only the successful screen lands on the governance timeline
    expect(events).toHaveLength(1);
  });

  it('reports unknown names and honors the bidder cap', async () => {
    const { service } = makeService({ maxBidders: 1 });
    const result = await service.screenBidders({
      roundId: 'round-1',
      agentId: 'a',
      bidders: ['alice', 'mallory', 'bob'],
    });
    expect(result.unknownBidders).toEqual(['mallory']);
    expect(result.screenedBidders).toBe(1);
    expect(result.skippedBidders).toEqual(['bob']);
  });

  it('skips governance events for non-agent-governed rounds', async () => {
    const { service, events } = makeService({
      rounds: round({ governanceRunId: undefined }),
    });
    await service.screenBidders({ roundId: 'round-1', agentId: 'a' });
    expect(events).toHaveLength(0);
  });

  it('throws when the round does not exist', async () => {
    const { service } = makeService({ rounds: null });
    await expect(service.screenBidders({ roundId: 'nope', agentId: 'a' })).rejects.toThrow(
      'not found',
    );
  });
});
