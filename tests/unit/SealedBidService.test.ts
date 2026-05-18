import test from "node:test";
import assert from "node:assert";
import { SealedBidService } from "../../src/services/SealedBidService.js";
import type { CreateRoundRequest, SubmitBidRequest, RevealRequest } from "../../src/services/SealedBidService.js";

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

const defaultBid = (overrides: Partial<SubmitBidRequest> = {}): SubmitBidRequest => ({
  bidder: "0xVendorA",
  amountUsd: 15000,
  proposalDetails: "Full-stack development, 3-month engagement",
  ...overrides,
});

const defaultReveal = (overrides: Partial<RevealRequest> = {}): RevealRequest => ({
  selectionMethod: "lowest-bid",
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────────────

test("SealedBidService", async (t) => {
  // ── createRound ──────────────────────────────────────────────────────────

  await t.test("createRound creates a round and assigns a roundId", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    assert.ok(round.roundId, "roundId should be set");
    assert.ok(round.roundId.startsWith("0x"), "roundId should be hex-prefixed");
    assert.strictEqual(round.description, "IT Services Q3");
    assert.strictEqual(round.serviceCategory, "software-development");
    assert.strictEqual(round.manager, "manager-1");
    assert.strictEqual(round.status, "open");
    assert.strictEqual(round.maxBids, 5);
    assert.strictEqual(round.bids.length, 0);
    assert.ok(round.createdAt, "createdAt should be set");
  });

  await t.test("createRound generates unique roundIds", () => {
    const service = new SealedBidService();
    const round1 = service.createRound(defaultRound, "manager-1");
    const round2 = service.createRound(defaultRound, "manager-1");

    assert.notStrictEqual(round1.roundId, round2.roundId);
  });

  // ── submitBid ────────────────────────────────────────────────────────────

  await t.test("submitBid adds a bid to an open round", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");
    const bid = service.submitBid(round.roundId, defaultBid());

    assert.ok(bid.encryptedAmount.startsWith("0x08"), "encryptedAmount should use ctHash prefix");
    assert.ok(bid.proposalHash.startsWith("0x"), "proposalHash should be hex-prefixed");
    assert.strictEqual(bid.status, "pending");
    assert.strictEqual(bid.index, 0);
    assert.strictEqual(bid.bidder, "0xVendorA");
    assert.ok(bid.submittedAt, "submittedAt should be set");
  });

  await t.test("submitBid throws for non-existent round", () => {
    const service = new SealedBidService();
    assert.throws(
      () => service.submitBid("0xdeadbeef", defaultBid()),
      /Round 0xdeadbeef not found/,
    );
  });

  await t.test("submitBid throws if round is not open", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");
    service.closeRound(round.roundId, "manager-1");

    assert.throws(
      () => service.submitBid(round.roundId, defaultBid()),
      /Round is not open for bids/,
    );
  });

  await t.test("submitBid throws if past deadline", () => {
    const service = new SealedBidService();
    const round = service.createRound(
      { ...defaultRound, deadline: pastDate() },
      "manager-1",
    );

    assert.throws(
      () => service.submitBid(round.roundId, defaultBid()),
      /Past round deadline/,
    );
  });

  await t.test("submitBid throws if max bids reached", () => {
    const service = new SealedBidService();
    const round = service.createRound(
      { ...defaultRound, maxBids: 2 },
      "manager-1",
    );

    service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorA" }));
    service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorB" }));

    assert.throws(
      () => service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorC" })),
      /Max bids reached/,
    );
  });

  await t.test("submitBid throws if bidder already submitted", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorA" }));

    assert.throws(
      () => service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorA" })),
      /Bidder already submitted a bid/,
    );
  });

  await t.test("submitBid without proposalDetails still generates a proposalHash", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    const bid = service.submitBid(round.roundId, defaultBid({ proposalDetails: undefined }));

    assert.ok(bid.proposalHash.startsWith("0x"), "auto-generated proposalHash should be hex");
  });

  await t.test("submitBid with proposalDetails has deterministic proposalHash", () => {
    const service = new SealedBidService();
    const round1 = service.createRound(defaultRound, "manager-1");
    const round2 = service.createRound(defaultRound, "manager-1");

    const bid1 = service.submitBid(round1.roundId, defaultBid({ proposalDetails: "Same proposal" }));
    const bid2 = service.submitBid(round2.roundId, defaultBid({ proposalDetails: "Same proposal" }));

    assert.strictEqual(bid1.proposalHash, bid2.proposalHash);
  });

  await t.test("submitBid increments bid index correctly", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    const bid1 = service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorA" }));
    const bid2 = service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorB" }));
    const bid3 = service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorC" }));

    assert.strictEqual(bid1.index, 0);
    assert.strictEqual(bid2.index, 1);
    assert.strictEqual(bid3.index, 2);
  });

  // ── closeRound ───────────────────────────────────────────────────────────

  await t.test("closeRound closes an open round", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    const closed = service.closeRound(round.roundId, "manager-1");

    assert.strictEqual(closed.status, "closed");
  });

  await t.test("closeRound throws for non-existent round", () => {
    const service = new SealedBidService();
    assert.throws(
      () => service.closeRound("0xdead", "manager-1"),
      /Round 0xdead not found/,
    );
  });

  await t.test("closeRound throws if caller is not manager", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    assert.throws(
      () => service.closeRound(round.roundId, "impostor"),
      /Only the round manager can close the round/,
    );
  });

  await t.test("closeRound throws if round is already closed", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    service.closeRound(round.roundId, "manager-1");

    assert.throws(
      () => service.closeRound(round.roundId, "manager-1"),
      /Round is already closed/,
    );
  });

  // ── revealWinner (lowest-bid) ────────────────────────────────────────────

  await t.test("revealWinner lowest-bid selects the lowest bidder", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorA", amountUsd: 30000 }));
    service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorB", amountUsd: 12000 }));
    service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorC", amountUsd: 25000 }));

    service.closeRound(round.roundId, "manager-1");
    const result = service.revealWinner(round.roundId, { selectionMethod: "lowest-bid" });

    assert.strictEqual(result.winner, "0xVendorB");
    assert.strictEqual(result.winningBid, 12000);
    assert.strictEqual(result.status, "revealed");
  });

  await t.test("revealWinner lowest-bid updates bid statuses", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorA", amountUsd: 30000 }));
    service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorB", amountUsd: 12000 }));

    service.closeRound(round.roundId, "manager-1");
    const result = service.revealWinner(round.roundId, { selectionMethod: "lowest-bid" });

    assert.strictEqual(result.bids[0].status, "rejected");
    assert.strictEqual(result.bids[1].status, "selected");
  });

  // ── revealWinner (highest-bid) ───────────────────────────────────────────

  await t.test("revealWinner highest-bid selects the highest bidder", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorA", amountUsd: 10000 }));
    service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorB", amountUsd: 50000 }));
    service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorC", amountUsd: 25000 }));

    service.closeRound(round.roundId, "manager-1");
    const result = service.revealWinner(round.roundId, { selectionMethod: "highest-bid" });

    assert.strictEqual(result.winner, "0xVendorB");
    assert.strictEqual(result.winningBid, 50000);
  });

  // ── revealWinner (specific) ──────────────────────────────────────────────

  await t.test("revealWinner specific selects the specified bidder", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorA", amountUsd: 10000 }));
    service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorB", amountUsd: 50000 }));

    service.closeRound(round.roundId, "manager-1");
    const result = service.revealWinner(round.roundId, {
      selectionMethod: "specific",
      specificBidder: "0xVendorA",
    });

    assert.strictEqual(result.winner, "0xVendorA");
    assert.strictEqual(result.winningBid, 10000);
  });

  await t.test("revealWinner specific throws if bidder not found", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorA", amountUsd: 10000 }));
    service.closeRound(round.roundId, "manager-1");

    assert.throws(
      () =>
        service.revealWinner(round.roundId, {
          selectionMethod: "specific",
          specificBidder: "0xMissing",
        }),
      /Bidder 0xMissing not found/,
    );
  });

  await t.test("revealWinner specific throws if specificBidder not provided", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    service.submitBid(round.roundId, defaultBid({ bidder: "0xVendorA", amountUsd: 10000 }));
    service.closeRound(round.roundId, "manager-1");

    assert.throws(
      () =>
        service.revealWinner(round.roundId, {
          selectionMethod: "specific",
          specificBidder: undefined,
        }),
      /specificBidder required/,
    );
  });

  // ── revealWinner (error paths) ───────────────────────────────────────────

  await t.test("revealWinner throws for non-existent round", () => {
    const service = new SealedBidService();
    assert.throws(
      () => service.revealWinner("0xdead", defaultReveal()),
      /Round 0xdead not found/,
    );
  });

  await t.test("revealWinner throws if round is not closed", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");

    service.submitBid(round.roundId, defaultBid());

    assert.throws(
      () => service.revealWinner(round.roundId, defaultReveal()),
      /Round must be closed before revealing winner/,
    );
  });

  await t.test("revealWinner throws if no bids in round", () => {
    const service = new SealedBidService();
    const round = service.createRound(defaultRound, "manager-1");
    service.closeRound(round.roundId, "manager-1");

    assert.throws(
      () => service.revealWinner(round.roundId, defaultReveal()),
      /No bids submitted in this round/,
    );
  });

  // ── getRound ─────────────────────────────────────────────────────────────

  await t.test("getRound returns null for non-existent round", () => {
    const service = new SealedBidService();
    const round = service.getRound("0xnonexistent");

    assert.strictEqual(round, null);
  });

  await t.test("getRound returns round with encrypted amounts by default", () => {
    const service = new SealedBidService();
    const created = service.createRound(defaultRound, "manager-1");
    service.submitBid(created.roundId, defaultBid({ bidder: "0xVendorA", amountUsd: 15000 }));

    const fetched = service.getRound(created.roundId);
    assert.ok(fetched);
    assert.ok(fetched.bids[0].encryptedAmount.startsWith("0x08"), "amount should be encrypted/ctHash");
  });

  await t.test("getRound with includeDecrypted=true shows decrypted amounts", () => {
    const service = new SealedBidService();
    const created = service.createRound(defaultRound, "manager-1");
    service.submitBid(created.roundId, defaultBid({ bidder: "0xVendorA", amountUsd: 15000 }));

    const fetched = service.getRound(created.roundId, true);
    assert.ok(fetched);
    assert.strictEqual(fetched.bids[0].encryptedAmount, "15000");
  });

  // ── listRounds ───────────────────────────────────────────────────────────

  await t.test("listRounds returns empty array initially", () => {
    const service = new SealedBidService();
    const rounds = service.listRounds();

    assert.ok(Array.isArray(rounds));
    assert.strictEqual(rounds.length, 0);
  });

  await t.test("listRounds returns all created rounds", () => {
    const service = new SealedBidService();
    service.createRound(defaultRound, "manager-1");
    service.createRound({ ...defaultRound, description: "Marketing Q3" }, "manager-1");
    service.createRound({ ...defaultRound, description: "Infra Q3" }, "manager-1");

    const rounds = service.listRounds();
    assert.strictEqual(rounds.length, 3);
  });

  // ── Full integration-style flow ──────────────────────────────────────────

  await t.test("full flow: create → bid × 3 → close → reveal → list", () => {
    const service = new SealedBidService();

    // Create round
    const round = service.createRound(
      { description: "Security Audit Q3", serviceCategory: "security", deadline: futureDate(), maxBids: 10 },
      "treasury-manager",
    );

    // Submit bids
    service.submitBid(round.roundId, defaultBid({ bidder: "0xAuditFirmA", amountUsd: 45000, proposalDetails: "Full audit, 2 weeks" }));
    service.submitBid(round.roundId, defaultBid({ bidder: "0xAuditFirmB", amountUsd: 28000, proposalDetails: "Automated + manual review" }));
    service.submitBid(round.roundId, defaultBid({ bidder: "0xAuditFirmC", amountUsd: 52000, proposalDetails: "Premium package" }));
    service.submitBid(round.roundId, defaultBid({ bidder: "0xAuditFirmD", amountUsd: 31000, proposalDetails: "Standard engagement" }));

    // Verify bid count
    assert.strictEqual(service.getRound(round.roundId)!.bids.length, 4);

    // Close
    service.closeRound(round.roundId, "treasury-manager");
    assert.strictEqual(service.getRound(round.roundId)!.status, "closed");

    // Reveal lowest bidder
    const result = service.revealWinner(round.roundId, { selectionMethod: "lowest-bid" });
    assert.strictEqual(result.winner, "0xAuditFirmB");
    assert.strictEqual(result.winningBid, 28000);

    // List rounds
    const rounds = service.listRounds();
    assert.strictEqual(rounds.length, 1);
    assert.strictEqual(rounds[0].winner, "0xAuditFirmB");
  });

  // ── simulateEncrypt / simulateDecrypt consistency ────────────────────────

  await t.test("simulateEncrypt and simulateDecrypt are inverses", () => {
    // Access private methods via bracket notation for testing
    const service = new SealedBidService() as any;

    const values = [0, 1, 255, 1000, 999999, 1234567890];
    for (const value of values) {
      const ct = service.simulateEncrypt(value);
      const decrypted = service.simulateDecrypt(ct);
      assert.strictEqual(decrypted, value, `round-trip for ${value}`);
    }
  });
});
