import { describe, expect, it } from "vitest";
import { evaluateComplianceVerdict } from "../../src/backend/services/telegraph/TelegraphCompliance.js";
import type { TelegraphMinerResponse } from "../../src/backend/services/telegraph/types.js";

function resp(data: unknown): TelegraphMinerResponse<unknown> {
  return {
    success: true,
    data,
    metadata: {
      minerId: "m1",
      minerName: "Screen Miner",
      intent: "SANCTIONS_SCREENING_MATCH",
      confidence: 0.9,
      latencyMs: 10,
      costUsd: "0.001",
      timestamp: "2026-11-14T00:00:00.000Z",
    },
  } as TelegraphMinerResponse<unknown>;
}

describe("evaluateComplianceVerdict", () => {
  it("returns hit on a positive match field", () => {
    expect(evaluateComplianceVerdict(resp({ match: true })).verdict).toBe("hit");
    expect(evaluateComplianceVerdict(resp({ listed: true })).verdict).toBe("hit");
    expect(evaluateComplianceVerdict(resp({ result: "sanctioned" })).verdict).toBe("hit");
  });

  it("returns clear on explicit negatives", () => {
    expect(evaluateComplianceVerdict(resp({ match: false })).verdict).toBe("clear");
    expect(evaluateComplianceVerdict(resp({ no_match: true })).verdict).toBe("clear");
    expect(evaluateComplianceVerdict(resp({ status: "clear" })).verdict).toBe("clear");
  });

  it("finds verdicts nested inside result objects", () => {
    const r = evaluateComplianceVerdict(
      resp({ result: { entity: { sanctions: { listed: true } } } }),
    );
    expect(r.verdict).toBe("hit");
  });

  it("interprets risk scores on 0-1 and 0-100 scales", () => {
    expect(evaluateComplianceVerdict(resp({ risk_score: 0.8 })).verdict).toBe("hit");
    expect(evaluateComplianceVerdict(resp({ risk_score: 12 })).verdict).toBe("clear");
    expect(evaluateComplianceVerdict(resp({ risk: 0.1 })).verdict).toBe("clear");
  });

  it("returns unknown for empty or unrecognizable responses", () => {
    expect(evaluateComplianceVerdict(resp(null)).verdict).toBe("unknown");
    expect(evaluateComplianceVerdict(resp({ foo: "bar" })).verdict).toBe("unknown");
    expect(evaluateComplianceVerdict(undefined).verdict).toBe("unknown");
  });
});
