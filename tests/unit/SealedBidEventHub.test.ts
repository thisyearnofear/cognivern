import type { Response } from "express";
import { describe, expect, it } from "vitest";
import { sealedBidEvents } from "@backend/services/blockchain/sealed-bid/SealedBidEventHub.js";
import { SealedBidService } from "@backend/services/blockchain/SealedBidService.js";

class FakeResponse {
  frames: string[] = [];
  write(data: string) {
    this.frames.push(data);
    return true;
  }
}

function lastEvent(res: FakeResponse) {
  const dataLine = res.frames
    .flatMap((frame) => frame.split("\n"))
    .find((line) => line.startsWith("data: "));
  expect(dataLine).toBeTruthy();
  return JSON.parse(dataLine!.slice("data: ".length)) as Record<string, unknown>;
}

const ROUND_REQUEST = {
  description: "Evented round",
  serviceCategory: "testing",
  deadline: new Date(Date.now() + 3600_000).toISOString(),
  maxBids: 5,
};

describe("SealedBidEventHub", () => {
  it("delivers to unfiltered and matching subscribers, not others", () => {
    const all = new FakeResponse();
    const matching = new FakeResponse();
    const other = new FakeResponse();
    const un1 = sealedBidEvents.subscribe(all as unknown as Response, null);
    const un2 = sealedBidEvents.subscribe(
      matching as unknown as Response,
      "round-a",
    );
    const un3 = sealedBidEvents.subscribe(
      other as unknown as Response,
      "round-b",
    );
    expect(un1 && un2 && un3).toBeTruthy();
    try {
      sealedBidEvents.publish({
        roundId: "round-a",
        change: "closed",
        status: "closed",
        at: new Date().toISOString(),
      });
      expect(all.frames).toHaveLength(1);
      expect(matching.frames).toHaveLength(1);
      expect(other.frames).toHaveLength(0);
      expect(all.frames[0]).toMatch(/^event: sealedbid:round\ndata: .*\n\n$/);
    } finally {
      un1!();
      un2!();
      un3!();
    }
  });

  it("emits exactly the {roundId, change, status, at} key set", () => {
    const res = new FakeResponse();
    const unsub = sealedBidEvents.subscribe(res as unknown as Response, null);
    try {
      sealedBidEvents.publish({
        roundId: "round-x",
        change: "bid_submitted",
        status: "open",
        at: "2026-01-01T00:00:00.000Z",
      });
      expect(Object.keys(lastEvent(res)).sort()).toEqual([
        "at",
        "change",
        "roundId",
        "status",
      ]);
    } finally {
      unsub!();
    }
  });

  it("caps a single client at 5 concurrent subscriptions", () => {
    const unsubs: (() => void)[] = [];
    try {
      for (let i = 0; i < 5; i++) {
        const unsub = sealedBidEvents.subscribe(
          new FakeResponse() as unknown as Response,
          null,
          "client-a",
        );
        expect(unsub).toBeTruthy();
        unsubs.push(unsub!);
      }
      // Sixth subscription from the same client is refused…
      expect(
        sealedBidEvents.subscribe(
          new FakeResponse() as unknown as Response,
          null,
          "client-a",
        ),
      ).toBeNull();
      // …but a different client still gets in.
      const other = sealedBidEvents.subscribe(
        new FakeResponse() as unknown as Response,
        null,
        "client-b",
      );
      expect(other).toBeTruthy();
      unsubs.push(other!);
      // Releasing one of client-a's slots lets it subscribe again.
      unsubs.shift()!();
      const reopened = sealedBidEvents.subscribe(
        new FakeResponse() as unknown as Response,
        null,
        "client-a",
      );
      expect(reopened).toBeTruthy();
      unsubs.push(reopened!);
    } finally {
      for (const unsub of unsubs) unsub();
    }
  });

  it("drops a subscriber whose write throws", () => {
    const dead = {
      write: () => {
        throw new Error("socket closed");
      },
    };
    const alive = new FakeResponse();
    const un1 = sealedBidEvents.subscribe(dead as unknown as Response, null);
    const un2 = sealedBidEvents.subscribe(alive as unknown as Response, null);
    const before = sealedBidEvents.connectionCount;
    try {
      sealedBidEvents.publish({
        roundId: "r",
        change: "created",
        status: "open",
        at: new Date().toISOString(),
      });
      expect(alive.frames).toHaveLength(1);
      expect(sealedBidEvents.connectionCount).toBe(before - 1);
    } finally {
      un1!();
      un2!();
    }
  });
});

describe("SealedBidService event publishing (FHE backend)", () => {
  it("publishes on createRound, withdrawBid and cancelRound", async () => {
    const res = new FakeResponse();
    const service = new SealedBidService(async (value) => ({
      ctHash: `ct-${value.toString(16)}`,
      utype: 5,
    }));
    const unsub = sealedBidEvents.subscribe(res as unknown as Response, null);
    try {
      const round = await service.createRound(ROUND_REQUEST, "demo-manager");
      await service.submitBid(round.roundId, {
        bidder: "Alice",
        amountUsd: 1000,
      });
      await service.withdrawBid(round.roundId, "Alice");
      await service.cancelRound(round.roundId, "demo-manager");

      const changes = res.frames.map(
        (frame) =>
          JSON.parse(
            frame
              .split("\n")
              .find((l) => l.startsWith("data: "))!
              .slice(6),
          ).change as string,
      );
      expect(changes).toEqual([
        "created",
        "bid_submitted",
        "bid_withdrawn",
        "cancelled",
      ]);
      for (const frame of res.frames) {
        const evt = JSON.parse(
          frame
            .split("\n")
            .find((l) => l.startsWith("data: "))!
            .slice(6),
        );
        expect(evt.roundId).toBe(round.roundId);
      }
    } finally {
      unsub!();
    }
  });
});
