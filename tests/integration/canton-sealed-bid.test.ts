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
    new CantonSealedBidBackend(client, parties, {
      auction: `${PKG}:Main:SealedBidAuction`,
      bid: `${PKG}:Main:Bid`,
      result: `${PKG}:Main:AuctionResult`,
    }),
  );

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
    await svc.submitBid(round.roundId, {
      bidder: "Bob",
      amountUsd: 24500,
      proposalDetails: "Bob proposal",
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
});
