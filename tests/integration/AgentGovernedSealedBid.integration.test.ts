import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { SealedBidBackend } from '@backend/services/blockchain/sealed-bid/SealedBidBackend.js';
import type {
  BidRecord,
  CreateRoundRequest,
  RevealRequest,
  SealedBidRound,
  SubmitBidRequest,
} from '@backend/services/blockchain/sealed-bid/types.js';

process.env.CRE_RUNS_FILE = `/tmp/cognivern-agent-governance-${process.pid}.jsonl`;
process.env.MONGODB_URI = '';

const { SealedBidController } = await import(
  '../../src/backend/modules/api/controllers/SealedBidController.js'
);
const { SealedBidService } = await import(
  '../../src/backend/services/blockchain/SealedBidService.js'
);
const { creRunStore } = await import('../../src/backend/cre/storage/CreRunStore.js');

class MockResponse {
  statusCode = 200;
  payload: any;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(payload: any) {
    this.payload = payload;
    return this;
  }
}

function request(params: Record<string, string>, body: Record<string, unknown>) {
  return {
    params,
    body,
    query: {},
    headers: {},
    header: () => undefined,
  } as unknown as Request;
}

class InMemoryCantonBackend implements SealedBidBackend {
  readonly name = 'canton' as const;
  private sequence = 0;
  private readonly rounds = new Map<string, SealedBidRound>();
  private readonly amountsByRound = new Map<string, Map<string, number>>();

  async createRound(input: CreateRoundRequest, manager: string): Promise<SealedBidRound> {
    const roundId = `canton-test-${++this.sequence}`;
    const round: SealedBidRound = {
      roundId,
      description: input.description,
      serviceCategory: input.serviceCategory,
      manager,
      deadline: input.deadline,
      maxBids: input.maxBids,
      status: 'open',
      bids: [],
      winner: null,
      winningBid: null,
      winningProposalHash: null,
      createdAt: new Date().toISOString(),
      backend: 'canton',
      settlementAmount: input.settlementAmount ?? null,
      settlementAssetTag: input.settlementAssetTag ?? null,
    };
    this.rounds.set(roundId, round);
    this.amountsByRound.set(roundId, new Map());
    return round;
  }

  async submitBid(roundId: string, input: SubmitBidRequest): Promise<BidRecord> {
    const round = this.requireRound(roundId);
    if (round.status !== 'open') throw new Error('Round is not open for bids');
    const bid: BidRecord = {
      bidder: input.bidder,
      encryptedAmount: `sealed:${input.amountUsd}`,
      proposalHash: `commitment:${input.bidder}`,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      index: round.bids.length,
    };
    round.bids.push(bid);
    this.amountsByRound.get(roundId)!.set(input.bidder, input.amountUsd);
    return bid;
  }

  async closeRound(roundId: string, caller: string): Promise<SealedBidRound> {
    const round = this.requireRound(roundId);
    if (round.manager !== caller) throw new Error('Only the round manager can close the round');
    round.status = 'closed';
    return round;
  }

  async revealWinner(roundId: string, _input: RevealRequest): Promise<SealedBidRound> {
    const round = this.requireRound(roundId);
    if (round.status !== 'closed') throw new Error('Round must be closed before revealing winner');
    const amounts = this.amountsByRound.get(roundId)!;
    const winner = [...round.bids].sort(
      (left, right) => amounts.get(left.bidder)! - amounts.get(right.bidder)!,
    )[0];
    round.status = 'revealed';
    round.winner = winner.bidder;
    round.winningBid = amounts.get(winner.bidder)!;
    round.winningProposalHash = winner.proposalHash;
    return round;
  }

  async getRound(roundId: string): Promise<SealedBidRound | null> {
    return this.rounds.get(roundId) ?? null;
  }

  async listRounds(): Promise<SealedBidRound[]> {
    return [...this.rounds.values()];
  }

  private requireRound(roundId: string): SealedBidRound {
    const round = this.rounds.get(roundId);
    if (!round) throw new Error(`Round ${roundId} not found`);
    return round;
  }
}

describe('agent-governed sealed-bid acceptance flow', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T12:00:00.000Z'));
    await creRunStore.reset();
  });

  afterEach(() => vi.useRealTimers());

  it('blocks an early close, then records the complete governed procurement lifecycle', async () => {
    const service = new SealedBidService();
    service.registerBackend(new InMemoryCantonBackend());
    const controller = new SealedBidController(service);
    const deadline = '2026-07-20T12:01:00.000Z';

    const create = new MockResponse();
    await controller.createRound(
      request(
        {},
        {
          description: 'Security audit RFP',
          serviceCategory: 'security-audit',
          deadline,
          maxBids: 3,
          backend: 'canton',
          manager: 'auctioner-cognivern',
          settlementAmount: 74_500,
          settlementAssetTag: 'USDC',
          agentId: 'procurement-agent-1',
        },
      ),
      create as unknown as Response,
    );

    expect(create.statusCode).toBe(201);
    expect(create.payload.data.createdByAgent).toBe('procurement-agent-1');
    const roundId = create.payload.data.roundId as string;

    for (const [bidder, amountUsd] of [
      ['alice-cognivern', 81_000],
      ['bob-cognivern', 74_500],
      ['charlie-cognivern', 79_000],
    ]) {
      const bid = new MockResponse();
      await controller.submitBid(
        request({ roundId }, { bidder, amountUsd, proposalDetails: `${bidder} proposal` }),
        bid as unknown as Response,
      );
      expect(bid.statusCode).toBe(201);
    }

    const blockedClose = new MockResponse();
    await controller.closeRound(
      request({ roundId }, { manager: 'auctioner-cognivern' }),
      blockedClose as unknown as Response,
    );
    expect(blockedClose.statusCode).toBe(403);
    expect(blockedClose.payload.policyChecks).toContainEqual(
      expect.objectContaining({ name: 'deadline_elapsed', passed: false }),
    );

    vi.setSystemTime(new Date('2026-07-20T12:01:01.000Z'));
    const close = new MockResponse();
    await controller.closeRound(
      request({ roundId }, { manager: 'auctioner-cognivern' }),
      close as unknown as Response,
    );
    expect(close.statusCode).toBe(200);
    expect(close.payload.data.policyChecks).toEqual(
      expect.arrayContaining([expect.objectContaining({ passed: true })]),
    );

    const reveal = new MockResponse();
    await controller.revealWinner(
      request({ roundId }, { selectionMethod: 'lowest-bid' }),
      reveal as unknown as Response,
    );
    expect(reveal.statusCode).toBe(200);
    expect(reveal.payload.data.winner).toBe('bob-cognivern');

    const timeline = new MockResponse();
    await controller.getGovernanceTimeline(
      request({ roundId }, {}),
      timeline as unknown as Response,
    );
    expect(timeline.statusCode).toBe(200);
    expect(
      timeline.payload.data.events.map((event: { eventType: string }) => event.eventType),
    ).toEqual([
      'round_created',
      'bid_submitted',
      'bid_submitted',
      'bid_submitted',
      'policy_checked',
      'policy_checked',
      'round_closed',
      'winner_revealed',
    ]);
    expect(
      timeline.payload.data.events.every((event: { eventHash: string }) =>
        /^[a-f0-9]{64}$/.test(event.eventHash),
      ),
    ).toBe(true);
    expect(
      timeline.payload.data.events
        .filter((event: { eventType: string }) => event.eventType === 'bid_submitted')
        .every((event: { payload: Record<string, unknown> }) => !('amountUsd' in event.payload)),
    ).toBe(true);
  });

  it('records bid_submitted events after a simulated service restart', async () => {
    // The backend is the persistent ledger in this test; the service is what
    // gets restarted. Share the backend across both service instances.
    const backend = new InMemoryCantonBackend();

    // Create a governed round with the original service/controller.
    const originalService = new SealedBidService();
    originalService.registerBackend(backend);
    const originalController = new SealedBidController(originalService);
    const deadline = '2026-07-20T12:01:00.000Z';

    const create = new MockResponse();
    await originalController.createRound(
      request(
        {},
        {
          description: 'Security audit RFP',
          serviceCategory: 'security-audit',
          deadline,
          maxBids: 3,
          backend: 'canton',
          manager: 'auctioner-cognivern',
          settlementAmount: 74_500,
          settlementAssetTag: 'USDC',
          agentId: 'procurement-agent-1',
        },
      ),
      create as unknown as Response,
    );

    expect(create.statusCode).toBe(201);
    const roundId = create.payload.data.roundId as string;

    // Simulate a server restart: a brand-new service instance bootstraps from
    // the persisted CRE runs, then registers the same backend and controller anew.
    const freshService = new SealedBidService();
    await freshService.bootstrapGovernance();
    freshService.registerBackend(backend);
    const freshController = new SealedBidController(freshService);

    const bid = new MockResponse();
    await freshController.submitBid(
      request({ roundId }, { bidder: 'alice-cognivern', amountUsd: 81_000, proposalDetails: 'alice proposal' }),
      bid as unknown as Response,
    );
    expect(bid.statusCode).toBe(201);

    const timeline = new MockResponse();
    await freshController.getGovernanceTimeline(
      request({ roundId }, {}),
      timeline as unknown as Response,
    );
    expect(timeline.statusCode).toBe(200);
    expect(timeline.payload.data.events.map((event: { eventType: string }) => event.eventType)).toEqual([
      'round_created',
      'bid_submitted',
    ]);
  });
});
