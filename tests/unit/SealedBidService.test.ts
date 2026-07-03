import { describe, it, expect } from 'vitest';
import { SealedBidService } from "@backend/services/blockchain/SealedBidService.js";

function futureDate(hoursFromNow = 24): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function pastDate(): string {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString();
}

const defaultRound = {
  description: 'IT Services Q3',
  serviceCategory: 'software-development',
  deadline: futureDate(),
  maxBids: 5,
};

const defaultBid = (overrides: Record<string, unknown> = {}) => ({
  bidder: '0xVendorA',
  amountUsd: 15000,
  proposalDetails: 'Full-stack development, 3-month engagement',
  ...overrides,
});

const defaultReveal = (overrides: Record<string, unknown> = {}) => ({
  selectionMethod: 'lowest-bid' as const,
  ...overrides,
});

const mockEncryptFn = async (value: bigint) => ({
  ctHash: `0x08${value.toString(16)}`,
  utype: 2,
});

function createService() {
  return new SealedBidService(mockEncryptFn);
}

describe('SealedBidService', () => {
  it('createRound creates a round and assigns a roundId', async () => {
    const service = new SealedBidService();
    const round = await service.createRound(defaultRound, 'manager-1');
    expect(round.roundId).toBeTruthy();
    expect(round.roundId.startsWith('0x')).toBeTruthy();
    expect(round.description).toBe('IT Services Q3');
    expect(round.serviceCategory).toBe('software-development');
    expect(round.manager).toBe('manager-1');
    expect(round.status).toBe('open');
    expect(round.maxBids).toBe(5);
    expect(round.bids.length).toBe(0);
    expect(round.createdAt).toBeTruthy();
    expect(round.backend).toBe('fhe');
  });

  it('createRound generates unique roundIds', async () => {
    const service = new SealedBidService();
    const round1 = await service.createRound(defaultRound, 'manager-1');
    const round2 = await service.createRound(defaultRound, 'manager-1');
    expect(round1.roundId).not.toBe(round2.roundId);
  });

  it('submitBid adds a bid to an open round', async () => {
    const service = createService();
    const round = await service.createRound(defaultRound, 'manager-1');
    const bid = await service.submitBid(round.roundId, defaultBid());

    expect(bid.encryptedAmount).toContain('ctHash');
    expect(bid.proposalHash.startsWith('0x')).toBeTruthy();
    expect(bid.status).toBe('pending');
    expect(bid.index).toBe(0);
    expect(bid.bidder).toBe('0xVendorA');
    expect(bid.submittedAt).toBeTruthy();
  });

  it('submitBid throws for non-existent round', async () => {
    const service = new SealedBidService();
    await expect(service.submitBid('0xdeadbeef', defaultBid())).rejects.toThrow(
      /Round 0xdeadbeef not found/,
    );
  });

  it('submitBid throws if round is not open', async () => {
    const service = createService();
    const round = await service.createRound(defaultRound, 'manager-1');
    await service.closeRound(round.roundId, 'manager-1');

    await expect(service.submitBid(round.roundId, defaultBid())).rejects.toThrow(
      /Round is not open for bids/,
    );
  });

  it('submitBid throws if past deadline', async () => {
    const service = createService();
    const round = await service.createRound({ ...defaultRound, deadline: pastDate() }, 'manager-1');

    await expect(service.submitBid(round.roundId, defaultBid())).rejects.toThrow(
      /Past round deadline/,
    );
  });

  it('submitBid throws if max bids reached', async () => {
    const service = createService();
    const round = await service.createRound({ ...defaultRound, maxBids: 2 }, 'manager-1');

    await service.submitBid(round.roundId, defaultBid({ bidder: '0xVendorA' }));
    await service.submitBid(round.roundId, defaultBid({ bidder: '0xVendorB' }));

    await expect(
      service.submitBid(round.roundId, defaultBid({ bidder: '0xVendorC' })),
    ).rejects.toThrow(/Max bids reached/);
  });

  it('submitBid throws if bidder already submitted', async () => {
    const service = createService();
    const round = await service.createRound(defaultRound, 'manager-1');

    await service.submitBid(round.roundId, defaultBid({ bidder: '0xVendorA' }));

    await expect(
      service.submitBid(round.roundId, defaultBid({ bidder: '0xVendorA' })),
    ).rejects.toThrow(/Bidder already submitted a bid/);
  });

  it('submitBid without proposalDetails still generates a proposalHash', async () => {
    const service = createService();
    const round = await service.createRound(defaultRound, 'manager-1');

    const bid = await service.submitBid(round.roundId, defaultBid({ proposalDetails: undefined }));

    expect(bid.proposalHash.startsWith('0x')).toBeTruthy();
  });

  it('submitBid with proposalDetails has deterministic proposalHash', async () => {
    const service = createService();
    const round1 = await service.createRound(defaultRound, 'manager-1');
    const round2 = await service.createRound(defaultRound, 'manager-1');

    const bid1 = await service.submitBid(
      round1.roundId,
      defaultBid({ proposalDetails: 'Same proposal' }),
    );
    const bid2 = await service.submitBid(
      round2.roundId,
      defaultBid({ proposalDetails: 'Same proposal' }),
    );

    expect(bid1.proposalHash).toBe(bid2.proposalHash);
  });

  it('submitBid increments bid index correctly', async () => {
    const service = createService();
    const round = await service.createRound(defaultRound, 'manager-1');

    const bid1 = await service.submitBid(round.roundId, defaultBid({ bidder: '0xVendorA' }));
    const bid2 = await service.submitBid(round.roundId, defaultBid({ bidder: '0xVendorB' }));
    const bid3 = await service.submitBid(round.roundId, defaultBid({ bidder: '0xVendorC' }));

    expect(bid1.index).toBe(0);
    expect(bid2.index).toBe(1);
    expect(bid3.index).toBe(2);
  });

  it('closeRound closes an open round', async () => {
    const service = new SealedBidService();
    const round = await service.createRound(defaultRound, 'manager-1');
    const closed = await service.closeRound(round.roundId, 'manager-1');
    expect(closed.status).toBe('closed');
  });

  it('closeRound throws for non-existent round', async () => {
    const service = new SealedBidService();
    await expect(service.closeRound('0xdead', 'manager-1')).rejects.toThrow(
      /Round 0xdead not found/,
    );
  });

  it('closeRound throws if caller is not manager', async () => {
    const service = new SealedBidService();
    const round = await service.createRound(defaultRound, 'manager-1');
    await expect(service.closeRound(round.roundId, 'impostor')).rejects.toThrow(
      /Only the round manager can close the round/,
    );
  });

  it('closeRound throws if round is already closed', async () => {
    const service = new SealedBidService();
    const round = await service.createRound(defaultRound, 'manager-1');
    await service.closeRound(round.roundId, 'manager-1');
    await expect(service.closeRound(round.roundId, 'manager-1')).rejects.toThrow(
      /Round is already closed/,
    );
  });

  it("revealWinner throws with 'not wired' (CoFHE not implemented)", async () => {
    const service = createService();
    const round = await service.createRound(defaultRound, 'manager-1');
    await service.submitBid(round.roundId, defaultBid({ bidder: '0xVendorA', amountUsd: 30000 }));
    await service.submitBid(round.roundId, defaultBid({ bidder: '0xVendorB', amountUsd: 12000 }));
    await service.closeRound(round.roundId, 'manager-1');

    await expect(
      service.revealWinner(round.roundId, { selectionMethod: 'lowest-bid' }),
    ).rejects.toThrow(/not wired/);
  });

  it('revealWinner throws for non-existent round', async () => {
    const service = new SealedBidService();
    await expect(service.revealWinner('0xdead', defaultReveal())).rejects.toThrow(
      /Round 0xdead not found/,
    );
  });

  it('revealWinner throws if round is not closed', async () => {
    const service = createService();
    const round = await service.createRound(defaultRound, 'manager-1');
    await service.submitBid(round.roundId, defaultBid());

    await expect(service.revealWinner(round.roundId, defaultReveal())).rejects.toThrow(
      /Round must be closed before revealing winner/,
    );
  });

  it('revealWinner throws if no bids in round', async () => {
    const service = new SealedBidService();
    const round = await service.createRound(defaultRound, 'manager-1');
    await service.closeRound(round.roundId, 'manager-1');

    await expect(service.revealWinner(round.roundId, defaultReveal())).rejects.toThrow(
      /No bids submitted in this round/,
    );
  });

  it('getRound returns null for non-existent round', async () => {
    const service = new SealedBidService();
    const round = await service.getRound('0xnonexistent');
    expect(round).toBeNull();
  });

  it('getRound returns round with encrypted amounts', async () => {
    const service = createService();
    const created = await service.createRound(defaultRound, 'manager-1');
    await service.submitBid(created.roundId, defaultBid({ bidder: '0xVendorA', amountUsd: 15000 }));

    const fetched = await service.getRound(created.roundId);
    expect(fetched).toBeTruthy();
    expect(fetched!.bids[0].encryptedAmount).toContain('ctHash');
  });

  it('listRounds returns empty array initially', async () => {
    const service = new SealedBidService();
    const rounds = await service.listRounds();
    expect(Array.isArray(rounds)).toBeTruthy();
    expect(rounds.length).toBe(0);
  });

  it('listRounds returns all created rounds', async () => {
    const service = new SealedBidService();
    await service.createRound(defaultRound, 'manager-1');
    await service.createRound({ ...defaultRound, description: 'Marketing Q3' }, 'manager-1');
    await service.createRound({ ...defaultRound, description: 'Infra Q3' }, 'manager-1');
    const rounds = await service.listRounds();
    expect(rounds.length).toBe(3);
  });

  it('full flow: create → bid → close → list', async () => {
    const service = createService();
    const round = await service.createRound(
      {
        description: 'Security Audit Q3',
        serviceCategory: 'security',
        deadline: futureDate(),
        maxBids: 10,
      },
      'treasury-manager',
    );

    await service.submitBid(
      round.roundId,
      defaultBid({ bidder: '0xAuditFirmA', amountUsd: 45000 }),
    );
    await service.submitBid(
      round.roundId,
      defaultBid({ bidder: '0xAuditFirmB', amountUsd: 28000 }),
    );

    expect((await service.getRound(round.roundId))!.bids.length).toBe(2);

    await service.closeRound(round.roundId, 'treasury-manager');
    expect((await service.getRound(round.roundId))!.status).toBe('closed');

    const rounds = await service.listRounds();
    expect(rounds.length).toBe(1);
  });

  it('createRound throws for a backend that is not configured', async () => {
    const service = new SealedBidService();
    await expect(
      service.createRound({ ...defaultRound, backend: 'canton' }, 'manager-1'),
    ).rejects.toThrow(/backend "canton" is not configured/);
  });
});
