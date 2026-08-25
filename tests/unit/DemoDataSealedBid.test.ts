import { describe, it, expect } from "vitest";
import { DemoDataService } from "@backend/services/DemoDataService.js";

/**
 * The demoInterceptor's serveDemoData serves these rounds for sandbox /
 * demo-tier workspaces at GET /vendor/sealed-bid/rounds. The frontend list
 * page reads them as SealedBidRoundSummary — so the shape here is a contract,
 * not an implementation detail. Any change to the summary keys breaks the
 * sealed-bid list for sandbox/authed users silently, so lock it down.
 */
describe("DemoDataService sealed-bid rounds", () => {
  it("returns seeded demo rounds with the summary shape the page consumes", () => {
    const rounds = DemoDataService.getSealedBidRounds();
    expect(rounds.length).toBeGreaterThan(0);

    for (const r of rounds) {
      expect(typeof r.roundId).toBe("string");
      expect(typeof r.description).toBe("string");
      expect(typeof r.serviceCategory).toBe("string");
      expect(["open", "closed", "revealed"]).toContain(r.status);
      expect(typeof r.bidCount).toBe("number");
      expect(typeof r.maxBids).toBe("number");
      expect(typeof r.deadline).toBe("string");
      expect(typeof r.createdAt).toBe("string");
      // winner/winningBid are null for open/closed rounds, numbers when revealed
      expect(r.winner === null || typeof r.winner === "string").toBe(true);
      expect(r.winningBid === null || typeof r.winningBid === "number").toBe(
        true,
      );
    }
  });

  it("covers all three statuses so the list page demos the full flow", () => {
    const rounds = DemoDataService.getSealedBidRounds();
    const statuses = new Set(rounds.map((r) => r.status));
    expect(statuses.has("open")).toBe(true);
    expect(statuses.has("closed")).toBe(true);
    expect(statuses.has("revealed")).toBe(true);
  });

  it("marks revealed rounds with atomic-settlement metadata", () => {
    const rounds = DemoDataService.getSealedBidRounds();
    const revealed = rounds.filter((r) => r.status === "revealed");
    expect(revealed.length).toBeGreaterThan(0);
    for (const r of revealed) {
      expect(r.winner).toBeTruthy();
      expect(r.winningBid).toBeGreaterThan(0);
    }
  });
});