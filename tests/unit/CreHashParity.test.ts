import { describe, expect, it } from "vitest";
import {
  hashSealedBidEvent as backendHash,
  canonicalJson as backendCanonicalJson,
} from "@backend/cre/workflows/sealedBidGovernance.js";
// Relative path on purpose: cre-hash.ts is a pure module with no `@/` imports
// so the browser implementation can be parity-tested against the backend's.
import {
  hashSealedBidEvent as frontendHash,
  canonicalJson as frontendCanonicalJson,
} from "@/lib/cre-hash";

const FIXTURES: {
  name: string;
  runId: string;
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
}[] = [
  {
    name: "nested objects and mixed-case keys",
    runId: "run_01",
    eventType: "round_created",
    timestamp: "2026-02-01T10:00:00.000Z",
    payload: {
      roundId: "0xabc",
      bidCount: 3,
      bidder: "Alice",
      Zeta: { alpha: 1, beta: { gamma: [1, 2, 3] } },
    },
  },
  {
    name: "arrays of policy-check objects keep order",
    runId: "run_02",
    eventType: "policy_checked",
    timestamp: "2026-02-01T10:05:00.000Z",
    payload: {
      checks: [
        { name: "min_bids", passed: true, detail: "3 bids received (min: 2)" },
        { name: "deadline_elapsed", passed: false, detail: "deadline in 2h" },
        { name: "budget_within_limit", passed: true, detail: "$10k ≤ $50k" },
      ],
      outcome: "blocked",
    },
  },
  {
    name: "undefined values are dropped",
    runId: "run_03",
    eventType: "bid_submitted",
    timestamp: "2026-02-01T10:10:00.000Z",
    payload: {
      roundId: "0xdef",
      winner: undefined,
      note: undefined,
      nested: { alsoUndefined: undefined, kept: "yes" },
    },
  },
  {
    name: "unicode strings hash identically",
    runId: "run_04",
    eventType: "winner_revealed",
    timestamp: "2026-02-01T11:00:00.000Z",
    payload: {
      description: "Ünïcodé pröposal — 日本語 ✓",
      emoji: "🔒",
      combining: "é vs é",
    },
  },
  {
    name: "key order does not matter (canonical sort)",
    runId: "run_05",
    eventType: "round_closed",
    timestamp: "2026-02-01T11:30:00.000Z",
    payload: { zzz: 1, aaa: 2, mmm: { y: 1, a: 2 } },
  },
];

describe("cre-hash parity (frontend vs backend)", () => {
  for (const fixture of FIXTURES) {
    it(`matches backend hash — ${fixture.name}`, async () => {
      const expected = backendHash(fixture);
      const actual = await frontendHash(fixture);
      expect(actual).toBe(expected);
      expect(actual).toMatch(/^[0-9a-f]{64}$/);
    });
  }

  it("canonicalJson serializations are identical", () => {
    for (const fixture of FIXTURES) {
      expect(frontendCanonicalJson(fixture.payload)).toBe(
        backendCanonicalJson(fixture.payload),
      );
    }
  });
});
