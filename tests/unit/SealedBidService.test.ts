import { describe, it, expect } from "vitest";
import { SealedBidService } from "../../src/backend/services/SealedBidService.js";
import type {
  CreateRoundRequest,
  SubmitBidRequest,
  RevealRequest,
} from "../../src/backend/services/SealedBidService.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function futureDate(hoursFromNow = 24): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function pastDate(): string {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString();
}

const defaultRound: CreateRoundRequest = {
  description: "IT Services Q3",
  serviceCategory: "software-development",
  deadline: futureDate(),
  maxBids: 5,
};

const defaultBid = (
  overrides: Partial<SubmitBidRequest> = {},
): SubmitBidRequest => ({
  bidder: "0xVendorA",
  amountUsd: 15000,
  proposalDetails: "Full-stack development, 3-month engagement",
  ...overrides,
});

const defaultReveal = (
  overrides: Partial<RevealRequest> = {},
): RevealRequest => ({
  selectionMethod: "lowest-bid",
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("SealedBidService", () => {
  // ── createRound ──────────────────────────────────────────────────────────

  it("createRound creates a round and assigns a roundId", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    expect(round.roundId).toBeTruthy();
    expect(round.roundId.startsWith("0x")).toBeTruthy();
    expect(round.description).toBe("IT Services Q3");
    expect(round.serviceCategory).toBe("software-development");
    expect(round.manager).toBe("manager-1");
    expect(round.status).toBe("open");
    expect(round.maxBids).toBe(5);
    expect(round.bids.length).toBe(0);
    expect(round.createdAt).toBeTruthy();
  });

  it("createRound generates unique roundIds", () => {
    const service = new SealedBidService();
    const round1 = service.createRound(defaultRound, "manager-1");
    const round2 = service.createRound(defaultRound, "manager-1");

    expect(round1.roundId).not.toBe(round2.roundId);
  });

  // ── submitBid ────────────────────────────────────────────────────────────

  it("submitBid adds a bid to an open round", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");
    const bid = service.submitBid(round.roundId, defaultBid());

    expect(
      bid.encryptedAmount.startsWith("0x08"),
    ).toBeTruthy();
    expect(
      bid.proposalHash.startsWith("0x"),
    ).toBeTruthy();
    expect(bid.status).toBe("pending");
    expect(bid.index).toBe(0);
    expect(bid.bidder).toBe("0xVendorA");
    expect(bid.submittedAt).toBeTruthy();
  });

  it("submitBid throws for non-existent round", () => {
    const service = new SealedBidService();
    expect(() => service.submitBid("0xdeadbeef", defaultBid())).toThrow(
      /Round 0xdeadbeef not found/,
    );
  });

  it("submitBid throws if round is not open", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");
    service.closeRound(round.roundId, "manager-1");

    expect(() => service.submitBid(round.roundId, defaultBid())).toThrow(
      /Round is not open for bids/,
    );
  });

  it("submitBid throws if past deadline", () => {
    const service = new SealedBidService();
    const round = service.createRound(
      { ...defaultRound, deadline: pastDate() },
      "manager-1",
    );

    expect(() => service.submitBid(round.roundId, defaultBid())).toThrow(
      /Past round deadline/,
    );
  });

  it("submitBid throws if max bids reached", () => {
    const service = new SealedBidService();
    const round = service.createRound(
      { ...defaultRound, maxBids: 2 },
      "manager-1",
    );

    service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorA" }));
    service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorB" }));

    expect(() =>
      service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorC" })),
    ).toThrow(/Max bids reached/);
  });

  it("submitBid throws if bidder already submitted", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorA" }));

    expect(() =>
      service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorA" })),
    ).toThrow(/Bidder already submitted a bid/);
  });

  it("submitBid without proposalDetails still generates a proposalHash", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    const bid = service.submitBid(
      round.roundId,
      defaultBid({ proposalDetails: undefined }),
    );

    expect(
      bid.proposalHash.startsWith("0x"),
    ).toBeTruthy();
  });

  it("submitBid with proposalDetails has deterministic proposalHash", () => {
    const service = new SealedBidService();
    const round1 = service.createRound(defaultRound, "manager-1");
    const round2 = service.createRound(defaultRound, "manager-1");

    const bid1 = service.submitBid(
      round1.roundId,
      defaultBid({ proposalDetails: "Same proposal" }),
    );
    const bid2 = service.submitBid(
      round2.roundId,
      defaultBid({ proposalDetails: "Same proposal" }),
    );

    expect(bid1.proposalHash).toBe(bid2.proposalHash);
  });

  it("submitBid increments bid index correctly", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    const bid1 = service.submitBid(
      round.roundId,
      defaultBid({ bidder: "0xVendorA" }),
    );
    const bid2 = service.submitBid(
      round.roundId,
      defaultBid({ bidder: "0xVendorB" }),
    );
    const bid3 = service.submitBid(
      round.roundId,
      defaultBid({ bidder: "0xVendorC" }),
    );

    expect(bid1.index).toBe(0);
    expect(bid2.index).toBe(1);
    expect(bid3.index).toBe(2);
  });

  // ── closeRound ───────────────────────────────────────────────────────────

  it("closeRound closes an open round", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    const closed = service.closeRound(round.roundId, "manager-1");

    expect(closed.status).toBe("closed");
  });

  it("closeRound throws for non-existent round", () => {
    const service = new SealedBidService();
    expect(() => service.closeRound("0xdead", "manager-1")).toThrow(
      /Round 0xdead not found/,
    );
  });

  it("closeRound throws if caller is not manager", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    expect(() => service.closeRound(round.roundId, "impostor")).toThrow(
      /Only the round manager can close the round/,
    );
  });

  it("closeRound throws if round is already closed", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    service.closeRound(round.roundId, "manager-1");

    expect(() => service.closeRound(round.roundId, "manager-1")).toThrow(
      /Round is already closed/,
    );
  });

  // ── revealWinner (lowest-bid) ────────────────────────────────────────────

  it("revealWinner lowest-bid selects the lowest bidder", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    service.submitBid(
      round.roundId,
      defaultBid({ bidder: "0xVendorA", amountUsd: 30000 }),
    );
    service.submitBid(
      round.roundId,
      defaultBid({ bidder: "0xVendorB", amountUsd: 12000 }),
    );
    service.submitBid(
      round.roundId,
      defaultBid({ bidder: "0xVendorC", amountUsd: 25000 }),
    );

    service.closeRound(round.roundId, "manager-1");
    const result = service.revealWinner(round.roundId, {
      selectionMethod: "lowest-bid",
    });

    expect(result.winner).toBe("0xVendorB");
    expect(result.winningBid).toBe(12000);
    expect(result.status).toBe("revealed");
  });

  it("revealWinner lowest-bid updates bid statuses", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    service.submitBid(
      round.roundId,
      defaultBid({ bidder: "0xVendorA", amountUsd: 30000 }),
    );
    service.submitBid(
      round.roundId,
      defaultBid({ bidder: "0xVendorB", amountUsd: 12000 }),
    );

    service.closeRound(round.roundId, "manager-1");
    const result = service.revealWinner(round.roundId, {
      selectionMethod: "lowest-bid",
    });

    expect(result.bids[0].status).toBe("rejected");
    expect(result.bids[1].status).toBe("selected");
  });

  // ── revealWinner (highest-bid) ───────────────────────────────────────────

  it("revealWinner highest-bid selects the highest bidder", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    service.submitBid(
      round.roundId,
      defaultBid({ bidder: "0xVendorA", amountUsd: 10000 }),
    );
    service.submitBid(
      round.roundId,
      defaultBid({ bidder: "0xVendorB", amountUsd: 50000 }),
    );
    service.submitBid(
      round.roundId,
      defaultBid({ bidder: "0xVendorC", amountUsd: 25000 }),
    );

    service.closeRound(round.roundId, "manager-1");
    const result = service.revealWinner(round.roundId, {
      selectionMethod: "highest-bid",
    });

    expect(result.winner).toBe("0xVendorB");
    expect(result.winningBid).toBe(50000);
  });

  // ── revealWinner (specific) ──────────────────────────────────────────────

  it("revealWinner specific selects the specified bidder", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    service.submitBid(
      round.roundId,
      defaultBid({ bidder: "0xVendorA", amountUsd: 10000 }),
    );
    service.submitBid(
      round.roundId,
      defaultBid({ bidder: "0xVendorB", amountUsd: 50000 }),
    );

    service.closeRound(round.roundId, "manager-1");
    const result = service.revealWinner(round.roundId, {
      selectionMethod: "specific",
      specificBidder: "0xVendorA",
    });

    expect(result.winner).toBe("0xVendorA");
    expect(result.winningBid).toBe(10000);
  });

  it("revealWinner specific throws if bidder not found", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    service.submitBid(
      round.roundId,
      defaultBid({ bidder: "0xVendorA", amountUsd: 10000 }),
    );
    service.closeRound(round.roundId, "manager-1");

    expect(() =>
      service.revealWinner(round.roundId, {
        selectionMethod: "specific",
        specificBidder: "0xMissing",
      }),
    ).toThrow(/Bidder 0xMissing not found/);
  });

  it("revealWinner specific throws if specificBidder not provided", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    service.submitBid(
      round.roundId,
      defaultBid({ bidder: "0xVendorA", amountUsd: 10000 }),
    );
    service.closeRound(round.roundId, "manager-1");

    expect(() =>
      service.revealWinner(round.roundId, {
        selectionMethod: "specific",
        specificBidder: undefined,
      }),
    ).toThrow(/specificBidder required/);
  });

  // ── revealWinner (error paths) ───────────────────────────────────────────

  it("revealWinner throws for non-existent round", () => {
    const service = new SealedBidService();
    expect(() => service.revealWinner("0xdead", defaultReveal())).toThrow(
      /Round 0xdead not found/,
    );
  });

  it("revealWinner throws if round is not closed", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    service.submitBid(round.roundId, defaultBid());

    expect(() => service.revealWinner(round.roundId, defaultReveal())).toThrow(
      /Round must be closed before revealing winner/,
    );
  });

  it("revealWinner throws if no bids in round", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");
    service.closeRound(round.roundId, "manager-1");

    expect(() => service.revealWinner(round.roundId, defaultReveal())).toThrow(
      /No bids submitted in this round/,
    );
  });

  // ── getRound ─────────────────────────────────────────────────────────────

  it("getRound returns null for non-existent round", () => {
    const service = new SealedBidService();
    const round = service.getRound("0xnonexistent");

    expect(round).toBeNull();
  });

  it("getRound returns round with encrypted amounts by default", () => {
    const service = new SealedBidService();
    const created = service.createRound(defaultRound, "manager-1");
    service.submitBid(
      created.roundId,
      defaultBid({ bidder: "0xVendorA", amountUsd: 15000 }),
    );

    const fetched = service.getRound(created.roundId);
    expect(fetched).toBeTruthy();
    expect(
      fetched!.bids[0].encryptedAmount.startsWith("0x08"),
    ).toBeTruthy();
  });

  it("getRound with includeDecrypted=true shows decrypted amounts", () => {
    const service = new SealedBidService();
    const created = service.createRound(defaultRound, "manager-1");
    service.submitBid(
      created.roundId,
      defaultBid({ bidder: "0xVendorA", amountUsd: 15000 }),
    );

    const fetched = service.getRound(created.roundId, true);
    expect(fetched).toBeTruthy();
    expect(fetched!.bids[0].encryptedAmount).toBe("15000");
  });

  // ── listRounds ───────────────────────────────────────────────────────────

  it("listRounds returns empty array initially", () => {
    const service = new SealedBidService();
    const rounds = service.listRounds();

    expect(Array.isArray(rounds)).toBeTruthy();
    expect(rounds.length).toBe(0);
  });

  it("listRounds returns all created rounds", () => {
    const service = new SealedBidService();
    service.createRound(defaultRound, "manager-1");
    service.createRound(
      { ...defaultRound, description: "Marketing Q3" },
      "manager-1",
    );
    service.createRound(
      { ...defaultRound, description: "Infra Q3" },
      "manager-1",
    );

    const rounds = service.listRounds();
    expect(rounds.length).toBe(3);
  });

  // ── Full integration-style flow ──────────────────────────────────────────

  it("full flow: create → bid × 3 → close → reveal → list", () => {
    const service = new SealedBidService();

    // Create round
    const round = service.createRound(
      {
        description: "Security Audit Q3",
        serviceCategory: "security",
        deadline: futureDate(),
        maxBids: 10,
      },
      "treasury-manager",
    );

    // Submit bids
    service.submitBid(
      round.roundId,
      defaultBid({
        bidder: "0xAuditFirmA",
        amountUsd: 45000,
        proposalDetails: "Full audit, 2 weeks",
      }),
    );
    service.submitBid(
      round.roundId,
      defaultBid({
        bidder: "0xAuditFirmB",
        amountUsd: 28000,
        proposalDetails: "Automated + manual review",
      }),
    );
    service.submitBid(
      round.roundId,
      defaultBid({
        bidder: "0xAuditFirmC",
        amountUsd: 52000,
        proposalDetails: "Premium package",
      }),
    );
    service.submitBid(
      round.roundId,
      defaultBid({
        bidder: "0xAuditFirmD",
        amountUsd: 31000,
        proposalDetails: "Standard engagement",
      }),
    );

    // Verify bid count
    expect(service.getRound(round.roundId)!.bids.length).toBe(4);

    // Close
    service.closeRound(round.roundId, "treasury-manager");
    expect(service.getRound(round.roundId)!.status).toBe("closed");

    // Reveal lowest bidder
    const result = service.revealWinner(round.roundId, {
      selectionMethod: "lowest-bid",
    });
    expect(result.winner).toBe("0xAuditFirmB");
    expect(result.winningBid).toBe(28000);

    // List rounds
    const rounds = service.listRounds();
    expect(rounds.length).toBe(1);
    expect(rounds[0].winner).toBe("0xAuditFirmB");
  });

  // ── simulateEncrypt / simulateDecrypt consistency ────────────────────────

  it("simulateEncrypt and simulateDecrypt are inverses", () => {
    // Access private methods via bracket notation for testing
    const service = new SealedBidService() as any;

    const values = [0, 1, 255, 1000, 999999, 1234567890];
    for (const value of values) {
      const ct = service.simulateEncrypt(value);
      const decrypted = service.simulateDecrypt(ct);
      expect(decrypted).toBe(value);
    }
  });
});
