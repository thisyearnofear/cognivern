/**
 * Canton sealed-bid integration test.
 *
 * Runs against a live Daml sandbox on http://localhost:7575 with the
 * hello-world .dar loaded (see daml/daml/Main.daml + `daml start`).
 *
 * The test is auto-skipped when the sandbox isn't reachable, so this file
 * is safe to include in the default test run — it will only exercise the
 * Canton backend when a developer has the sandbox up.
 */
import { describe, it, expect } from "vitest";
import { SealedBidService } from "@backend/services/blockchain/SealedBidService.js";
import { CantonLedgerClient } from "@backend/canton/CantonLedgerClient.js";
import { CantonPartyRegistry } from "@backend/canton/CantonPartyRegistry.js";
import { CantonSealedBidBackend } from "@backend/services/blockchain/sealed-bid/CantonSealedBidBackend.js";

const JSON_API = "http://localhost:7575";
const PKG = process.env.CANTON_TEST_PKG_ID ?? "b0b4084a792687fe394df79f5e1c1ea31d316f78a68e605b93c481c2879c5128";

// Shape of the Bid contract as returned by the Daml JSON Ledger API through
// CantonLedgerClient.query<T>(...). Mirrors the BidPayload declared in
// CantonSealedBidBackend — kept local so the test does not reach into backend
// internals, and so a downstream change to BidPayload's shape will fail this
// file at typecheck rather than at runtime.
interface BidPayload {
  manager: string;
  bidder: string;
  roundId: string;
  amountUsd: string;
  proposalHash: string;
  submittedAt: string;
}

// Shape of the AuctionResult contract — CantonSealedBidBackend's internal
// type is private, so the local mirror here gives the post-reveal ledger
// assertion the chance to fail at typecheck if the Daml model changes.
interface AuctionResultPayload {
  manager: string;
  eligibleBidders: string[];
  roundId: string;
  winner: string;
  winningAmount: string;
  winningProposal: string;
  description: string;
  serviceCategory: string;
  revealedAt: string;
}

const TEMPLATES = {
  auction: `${PKG}:Main:SealedBidAuction`,
  bid: `${PKG}:Main:Bid`,
  result: `${PKG}:Main:AuctionResult`,
};

// Probe at module load so describe.skipIf sees the real value at collection time.
const sandboxUp = await (async () => {
  try {
    const r = await fetch(`${JSON_API}/livez`);
    return r.ok;
  } catch {
    return false;
  }
})();

describe.skipIf(!sandboxUp)("Canton sealed-bid backend (live sandbox)", () => {
  const svc = new SealedBidService();
  const client = new CantonLedgerClient({
    jsonApiUrl: JSON_API,
    applicationId: "phase2-integration",
  });
  const parties = new CantonPartyRegistry(client);
  svc.registerBackend(
    new CantonSealedBidBackend(client, parties, TEMPLATES),
  );

  // Single shim over the parties.resolve → query → optional roundId filter
  // pattern. Every Daml JSON Ledger API round-table query in this file
  // flows through findRoundOn, so when CantonLedgerClient.query changes
  // (pagination, retry, a different visibility axis) the change lands
  // here once, not in five places. roundId is optional: providing it
  // narrows to a single round; omitting it returns every contract of the
  // template visible to the party — used by the cross-leakage guard to
  // assert ledger-wide, not per-round, behaviour. Returns both the
  // resolved partyId and the matched contracts so callers don't need to
  // re-resolve the same name on the test side, and so a wrong-T-type arg
  // (one with no `roundId` field) is caught at typecheck rather than at
  // runtime when no contract ever matches the roundId filter.
  type TemplateKey = "auction" | "bid" | "result";
  async function findRoundOn<T extends { roundId: string }>(
    partyName: string,
    templateKey: TemplateKey,
    roundId?: string,
  ): Promise<{
    partyId: string;
    contracts: Array<{ contractId: string; templateId: string; payload: T }>;
  }> {
    const partyId = await parties.resolve(partyName);
    const hits = await client.query<T>(partyId, [TEMPLATES[templateKey]]);
    return {
      partyId,
      contracts:
        roundId === undefined
          ? hits
          : hits.filter((c) => c.payload.roundId === roundId),
    };
  }

  it("full flow: create → 3 bids → close → reveal picks lowest", async () => {
    const round = await svc.createRound(
      {
        description: "Integration RFP",
        serviceCategory: "consulting",
        deadline: new Date(Date.now() + 24 * 3600e3).toISOString(),
        maxBids: 5,
        backend: "canton",
      },
      "Auctioneer",
    );
    expect(round.backend).toBe("canton");
    expect(round.status).toBe("open");

    await svc.submitBid(round.roundId, {
      bidder: "Alice",
      amountUsd: 32000,
      proposalDetails: "Alice proposal",
    });
    // Bob's proposalHash is pinned to the literal "0x2b" so the post-reveal
    // ledger assertion can lock the CloseAndReveal winner→winningProposal
    // mapping against future Daml model changes. Without an override, the
    // backend derives proposalHash from SHA-256(proposalDetails), which is
    // a 66-char string and not assertion-friendly.
    await svc.submitBid(round.roundId, {
      bidder: "Bob",
      amountUsd: 24500,
      proposalDetails: "Bob proposal",
      proposalHash: "0x2b",
    });
    await svc.submitBid(round.roundId, {
      bidder: "Charlie",
      amountUsd: 41000,
      proposalDetails: "Charlie proposal",
    });

    const withBids = await svc.getRound(round.roundId);
    expect(withBids?.bids.length).toBe(3);

    const closed = await svc.closeRound(round.roundId, "Auctioneer");
    expect(closed.status).toBe("closed");

    const revealed = await svc.revealWinner(round.roundId, {
      selectionMethod: "lowest-bid",
    });
    expect(revealed.status).toBe("revealed");
    // Bob's $24,500 is the lowest
    expect(revealed.winner).toContain("Bob");
    expect(revealed.winningBid).toBe(24500);

    const bobParty = await parties.resolve("Bob");

    // Post-reveal atomic settlement — verified against the ledger, not the
    // backend's read-through cache. CloseAndReveal performs two ledger acts
    // in one transaction: archives every Bid contract and creates exactly
    // one AuctionResult. The Canton JSON Ledger API should report zero Bids
    // and one AuctionResult with the matching winner + winningAmount.
    const archive = await findRoundOn<BidPayload>(
      "Auctioneer",
      "bid",
      round.roundId,
    );
    expect(archive.contracts).toHaveLength(0);

    const resultQuery = await findRoundOn<AuctionResultPayload>(
      "Auctioneer",
      "result",
      round.roundId,
    );
    expect(resultQuery.contracts).toHaveLength(1);
    expect(resultQuery.contracts[0].payload.winner).toBe(bobParty);
    expect(parseFloat(resultQuery.contracts[0].payload.winningAmount)).toBe(
      24500,
    );
    // CloseAndReveal must carry Bob's proposalHash straight through to the
    // AuctionResult. If a future Daml refactor drops `winningProposal`
    // (or recomputes it from something other than the winning bid's hash),
    // this assertion fires on the literal we pinned in the submitBid call
    // above — exact value comparison, not just non-empty.
    expect(resultQuery.contracts[0].payload.winningProposal).toBe("0x2b");
  });

  it("FHE backend still throws 'not wired' on reveal", async () => {
    const round = await svc.createRound(
      {
        description: "FHE control",
        serviceCategory: "control",
        deadline: new Date(Date.now() + 24 * 3600e3).toISOString(),
        maxBids: 3,
      },
      "fhe-manager",
    );
    expect(round.backend).toBe("fhe");
    await expect(
      svc.revealWinner(round.roundId, { selectionMethod: "lowest-bid" }),
    ).rejects.toThrow(/not wired|Round must be closed|No bids submitted/);
  });

  // ── Privacy invariants ───────────────────────────────────────────────────
  // The next two tests verify the sub-transaction privacy property encoded
  // in daml/daml/Main.daml's Bid template: signatory bidder, observer manager.
  // They query the Daml JSON Ledger API directly as each party — the count a
  // honest Canton participant actually returns — so any future loosening of
  // the disclosure (a wider observer list on Bid, for example) fails these
  // tests immediately. Helper functions are local to each it() so failure
  // messages stay close to the assertion.

  it("sub-transaction privacy: each bidder sees exactly their own bid in round; auctioneer sees all", async () => {
    const round = await svc.createRound(
      {
        description: "Phase2 privacy — per-round visibility",
        serviceCategory: "privacy",
        deadline: new Date(Date.now() + 24 * 3600e3).toISOString(),
        maxBids: 5,
        backend: "canton",
      },
      "Auctioneer",
    );
    const roundId = round.roundId;

    await svc.submitBid(roundId, {
      bidder: "Alice",
      amountUsd: 32000,
      proposalDetails: "alice",
    });
    await svc.submitBid(roundId, {
      bidder: "Bob",
      amountUsd: 24500,
      proposalDetails: "bob",
    });
    await svc.submitBid(roundId, {
      bidder: "Charlie",
      amountUsd: 41000,
      proposalDetails: "charlie",
    });

    // Identity check for each bidder: each caller's view of THIS round is
    // exactly one contract (theirs). findRoundOn returns the resolved
    // partyId so the comparison happens against the namespaced party
    // identifier Canton actually stored in the contract. expect.soft lets
    // all three bidder failures accumulate and surface together at
    // teardown — useful when diagnosing multi-bidder leaks (e.g. Canton
    // observer-list broadened to eligibleBidders) where the first failing
    // bidder alone wouldn't tell the full story.
    for (const name of ["Alice", "Bob", "Charlie"] as const) {
      const result = await findRoundOn<BidPayload>(name, "bid", roundId);
      expect
        .soft(result.contracts.map((b) => b.payload.bidder))
        .toEqual([result.partyId]);
    }

    // Auctioneer is the observer on every Bid — the manager-only visibility
    // Canton gives the auctioneer for free, asserted here end-to-end. This
    // block is intentionally not folded into the loop above: it asserts a
    // *cardinality* property (three distinct bidders) rather than the
    // per-bidder "saw only one's own" identity property.
    const auctioneer = await findRoundOn<BidPayload>(
      "Auctioneer",
      "bid",
      roundId,
    );
    expect(auctioneer.contracts).toHaveLength(3);
    expect(new Set(auctioneer.contracts.map((b) => b.payload.bidder)).size).toBe(
      3,
    );
  });

  it("sub-transaction privacy: bidder's ledger view never contains another bidder's contract anywhere", async () => {
    const round = await svc.createRound(
      {
        description: "Phase2 privacy — cross-leakage guard",
        serviceCategory: "privacy",
        deadline: new Date(Date.now() + 24 * 3600e3).toISOString(),
        maxBids: 5,
        backend: "canton",
      },
      "Auctioneer",
    );
    await svc.submitBid(round.roundId, {
      bidder: "Alice",
      amountUsd: 32000,
      proposalDetails: "alice",
    });
    await svc.submitBid(round.roundId, {
      bidder: "Bob",
      amountUsd: 24500,
      proposalDetails: "bob",
    });
    await svc.submitBid(round.roundId, {
      bidder: "Charlie",
      amountUsd: 41000,
      proposalDetails: "charlie",
    });

    // Whole-ledger scope: omitting the third arg means no roundId filter,
    // so the JSON API returns *every* Bid contract visible to the caller
    // across the participant. The JSON API filters by observation rights;
    // whatever the caller sees must be contracts for which they are the
    // signatory. If a refactor broadens the Bid observer list — e.g. to
    // "eligibleBidders" for debugging — this assertion fires the moment a
    // competitor's bid slips through for one bidder.
    //
    // expect.soft on the inner assertion lets every leaked contract across
    // every bidder accumulate and surface together at teardown; without it,
    // the first failing bidder aborts the loop and the rest of the leak
    // shape is lost to the report.
    for (const name of ["Alice", "Bob", "Charlie"] as const) {
      const result = await findRoundOn<BidPayload>(name, "bid");
      // Soft cardinality: a length-0 result would let the inner loop
      // below pass vacuously if Bid visibility were broken across the
      // board — for each named bidder, ≥ 1 contract should be visible
      // (pre-this-round bids from Main:setup and the prior per-round
      // visibility test, plus this test's own bid).
      expect.soft(result.contracts.length).toBeGreaterThan(0);
      for (const b of result.contracts) {
        expect
          .soft(
            b.payload.bidder,
            `${name} must only see own bids; observed bidder=${b.payload.bidder}`,
          )
          .toBe(result.partyId);
      }
    }
  });
});
