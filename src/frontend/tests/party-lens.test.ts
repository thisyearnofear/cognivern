import { describe, expect, it } from "vitest";
import {
  buildPartyLensBids,
  resolvePartyEnvelopeState,
} from "@/components/sealed-bid/party-view";
import type { PartyVisibleBid, SealedBid } from "@/lib/api-client";

function roundBid(bidder: string, index: number): SealedBid {
  return {
    bidder,
    encryptedAmount: "0xsealed",
    proposalHash: `0xhash${index}`,
    status: "pending",
    submittedAt: "2026-01-01T00:00:00Z",
    index,
  };
}

function visibleBid(bidder: string, index: number, amountUsd: number): PartyVisibleBid {
  return { bidder, amountUsd, proposalHash: `0xhash${index}`, index };
}

describe("buildPartyLensBids", () => {
  it("enriches disclosed bids with amounts and leaves others price-less", () => {
    const lens = buildPartyLensBids(
      [roundBid("Alice::x", 0), roundBid("Bob::x", 1)],
      [visibleBid("Alice::x", 0, 12400)],
    );
    expect(lens).toHaveLength(2);
    const alice = lens.find((b) => b.index === 0);
    const bob = lens.find((b) => b.index === 1);
    expect(alice?.amountUsd).toBe(12400);
    // A redacted envelope must carry no price at all.
    expect(bob?.amountUsd).toBeNull();
  });

  it("unions in visible bids missing from round metadata", () => {
    const lens = buildPartyLensBids([], [visibleBid("Alice::x", 3, 9800)]);
    expect(lens).toHaveLength(1);
    expect(lens[0].amountUsd).toBe(9800);
    expect(lens[0].index).toBe(3);
  });
});

describe("resolvePartyEnvelopeState", () => {
  it("opens only bids present in the participant response", () => {
    const visible = [visibleBid("Alice::x", 0, 12400)];
    expect(resolvePartyEnvelopeState("open", 0, visible)).toBe("open");
    expect(resolvePartyEnvelopeState("open", 1, visible)).toBe("redacted");
  });

  it("archives everything once revealed, regardless of prior visibility", () => {
    const visible = [visibleBid("Alice::x", 0, 12400)];
    expect(resolvePartyEnvelopeState("revealed", 0, visible)).toBe("archived");
    expect(resolvePartyEnvelopeState("revealed", 1, visible)).toBe("archived");
  });

  it("redacts unknown indexes (NaN) rather than opening them", () => {
    expect(resolvePartyEnvelopeState("open", Number.NaN, [])).toBe("redacted");
  });
});
