import { describe, expect, it } from "vitest";
import evidence from "../public/evidence/canton-visibility-44996498857.json";
import {
  nextReplayStep,
  replayView,
  SANDBOX_REPLAY_ID,
  type VisibilityEvidenceRow,
} from "@/lib/visibility-replay";
import { proofFromVisibilityReplay } from "@/lib/proof";

const rows = evidence as VisibilityEvidenceRow[];

describe("replayView", () => {
  it("each vendor sees only its own quote before close", () => {
    for (const [role, own] of [
      ["Vendor A", 30],
      ["Vendor B", 20],
      ["Vendor C", 40],
    ] as const) {
      const view = replayView(rows, role, "before");
      expect(view.visibleQuotes).toEqual([String(own)]);
      expect(view.summary).toBe(
        `${role}, before close: 1 of 3 quotes visible.`,
      );
      expect(
        view.quoteCards.find((c) => c.role === role)?.visible,
      ).toBe(true);
      expect(view.quoteCards.filter((c) => c.visible)).toHaveLength(1);
    }
  });

  it("manager sees all three quotes before close", () => {
    const view = replayView(rows, "Manager", "before");
    expect(view.visibleQuotes).toEqual(["20", "30", "40"]);
    expect(view.summary).toBe(
      "Manager, before close: 3 of 3 quotes visible.",
    );
    expect(view.quoteCards.every((c) => c.visible)).toBe(true);
  });

  it("after close every role sees no active bids and the result", () => {
    for (const role of ["Vendor A", "Manager"] as const) {
      const view = replayView(rows, role, "after");
      expect(view.visibleQuotes).toEqual([]);
      expect(view.summary).toBe(
        `${role}, after close: no active bids. Result: Vendor B at ${view.winningAmount}.`,
      );
      expect(view.winningAmount).toBe(20);
    }
  });
});

describe("nextReplayStep", () => {
  it("walks the full cycle", () => {
    expect(nextReplayStep("Vendor A", "before")).toEqual({
      label: "View as manager",
      role: "Manager",
      phase: "before",
    });
    expect(nextReplayStep("Vendor C", "after")).toEqual({
      label: "View as manager",
      role: "Manager",
      phase: "after",
    });
    expect(nextReplayStep("Manager", "before")).toEqual({
      label: "Show after close",
      role: "Manager",
      phase: "after",
    });
    expect(nextReplayStep("Manager", "after")).toEqual({
      label: "Reset demo",
      role: "Vendor A",
      phase: "before",
    });
  });
});

describe("proofFromVisibilityReplay", () => {
  it("never sets a USD figure and carries the sandbox receipt", () => {
    const proof = proofFromVisibilityReplay(rows);
    expect(proof.schema).toBe("cognivern.proof.v1");
    expect(proof.kind).toBe("sealed-bid-replay");
    expect(proof.id).toBe(SANDBOX_REPLAY_ID);
    expect(proof.spent.usd).toBeNull();
    expect(proof.spent.note).toContain("synthetic");
    expect(proof.decided.outcome).toBe("Vendor B won");
    expect(proof.decided.detail).toBe("Result: 20");
    expect(proof.receipts[0].href).toBe(
      "/evidence/canton-visibility-44996498857.json",
    );
    expect(proof.generatedAt).toBeNull();
  });
});
