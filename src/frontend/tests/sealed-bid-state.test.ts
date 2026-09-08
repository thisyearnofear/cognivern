import { describe, it, expect } from "vitest";
import type { SealedBidRound } from "@/lib/api-client";
import { deriveSealedBidState } from "@/lib/sealed-bid-state";

/**
 * A sealed-bid round's bounded adaptive state (docs/ADAPTIVE_UX.md). These
 * tests pin the derivation so surfaces that adapt to a round read a single
 * source of truth instead of re-branching on the raw status + winner fields.
 */

const baseRound: SealedBidRound = {
  roundId: "r-1",
  description: "Procurement of compute",
  serviceCategory: "compute",
  manager: "manager-1",
  deadline: "2026-09-09T00:00:00Z",
  maxBids: 10,
  status: "open",
  bids: [],
  winner: null,
  winningBid: null,
  winningProposalHash: null,
  createdAt: "2026-09-08T00:00:00Z",
};

describe("deriveSealedBidState", () => {
  it("is open while the round accepts bids", () => {
    expect(deriveSealedBidState({ ...baseRound, status: "open" })).toBe("open");
  });

  it("is closed when the deadline passed and no winner is known yet", () => {
    expect(
      deriveSealedBidState({ ...baseRound, status: "closed", winner: null }),
    ).toBe("closed");
  });

  it("is revealing when closed but a winner has already been computed", () => {
    expect(
      deriveSealedBidState({
        ...baseRound,
        status: "closed",
        winner: "bidder-0",
        winningBid: 100,
      }),
    ).toBe("revealing");
  });

  it("is settled when the round has been revealed", () => {
    expect(
      deriveSealedBidState({
        ...baseRound,
        status: "revealed",
        winner: "bidder-0",
        winningBid: 100,
      }),
    ).toBe("settled");
  });

  it("defaults to open for null/undefined input", () => {
    expect(deriveSealedBidState(null)).toBe("open");
    expect(deriveSealedBidState(undefined)).toBe("open");
  });

  it("defaults to open for an unknown status", () => {
    expect(
      deriveSealedBidState({
        ...baseRound,
        status: "phantom",
      } as unknown as SealedBidRound),
    ).toBe("open");
  });

  it("boundary: a revealed round with a null winner is still settled (status wins)", () => {
    expect(
      deriveSealedBidState({ ...baseRound, status: "revealed", winner: null }),
    ).toBe("settled");
  });
});
