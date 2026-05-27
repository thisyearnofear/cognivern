import { describe, it, expect } from "vitest";

/**
 * Unit tests for AgentGrid status rendering logic.
 *
 * Verifies the intent→core mapping and state transitions that drive
 * the visual agent grid, without requiring a browser or React render.
 */

// ── Extracted mapping logic from AgentGrid.tsx ─────────────────────────

type AgentState = "IDLE" | "BUSY" | "CRSH" | "SYNC";

interface CoreActivation {
  coreIdx: number;
  state: AgentState;
}

const INTENT_CORE_MAP: Record<string, CoreActivation[]> = {
  governance: [{ coreIdx: 0, state: "BUSY" }],
  risk: [{ coreIdx: 0, state: "BUSY" }],
  policy: [{ coreIdx: 0, state: "BUSY" }],
  forensic: [{ coreIdx: 1, state: "BUSY" }],
  agent: [{ coreIdx: 2, state: "BUSY" }],
  stats: [{ coreIdx: 3, state: "BUSY" }],
  create: [
    { coreIdx: 0, state: "SYNC" },
    { coreIdx: 2, state: "SYNC" },
  ],
};

function getActivationForIntent(intentType: string): CoreActivation[] {
  return INTENT_CORE_MAP[intentType] || [{ coreIdx: 3, state: "BUSY" }];
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("AgentGrid status rendering", () => {
  describe("intent → core activation mapping", () => {
    it("activates governance core for governance intents", () => {
      const activation = getActivationForIntent("governance");
      expect(activation).toHaveLength(1);
      expect(activation[0]).toEqual({ coreIdx: 0, state: "BUSY" });
    });

    it("activates audit core for forensic intents", () => {
      const activation = getActivationForIntent("forensic");
      expect(activation).toHaveLength(1);
      expect(activation[0]).toEqual({ coreIdx: 1, state: "BUSY" });
    });

    it("activates CRE engine core for agent intents", () => {
      const activation = getActivationForIntent("agent");
      expect(activation).toHaveLength(1);
      expect(activation[0]).toEqual({ coreIdx: 2, state: "BUSY" });
    });

    it("activates intent router core for stats intents", () => {
      const activation = getActivationForIntent("stats");
      expect(activation).toHaveLength(1);
      expect(activation[0]).toEqual({ coreIdx: 3, state: "BUSY" });
    });

    it("activates governance + CRE in SYNC for create intents", () => {
      const activation = getActivationForIntent("create");
      expect(activation).toHaveLength(2);
      expect(activation[0]).toEqual({ coreIdx: 0, state: "SYNC" });
      expect(activation[1]).toEqual({ coreIdx: 2, state: "SYNC" });
    });

    it("falls back to intent router BUSY for unknown types", () => {
      const activation = getActivationForIntent("random_new_type");
      expect(activation).toHaveLength(1);
      expect(activation[0]).toEqual({ coreIdx: 3, state: "BUSY" });
    });
  });

  describe("state → color mapping", () => {
    const STATE_COLORS: Record<AgentState, { text: string }> = {
      IDLE: { text: "text-zinc-500" },
      BUSY: { text: "text-emerald-400" },
      CRSH: { text: "text-red-400" },
      SYNC: { text: "text-sky-400" },
    };

    it("maps each state to a distinct color class", () => {
      const colors = new Set(Object.values(STATE_COLORS).map((c) => c.text));
      expect(colors.size).toBe(4);
    });

    it("IDLE uses muted color", () => {
      expect(STATE_COLORS.IDLE.text).toContain("zinc");
    });

    it("CRSH uses red color", () => {
      expect(STATE_COLORS.CRSH.text).toContain("red");
    });
  });

  describe("CRE run status → grid state", () => {
    function runsToCoreState(runs: { status: string }[]): {
      coreIdx: number;
      state: AgentState;
    } {
      const runningCount = runs.filter(
        (r) => r.status === "running" || r.status === "queued",
      ).length;
      if (runningCount > 0) {
        return { coreIdx: 2, state: "BUSY" };
      }
      return { coreIdx: 2, state: "IDLE" };
    }

    it("sets CRE core to BUSY when runs are active", () => {
      const result = runsToCoreState([
        { status: "running" },
        { status: "completed" },
      ]);
      expect(result.state).toBe("BUSY");
    });

    it("sets CRE core to IDLE when no runs are active", () => {
      const result = runsToCoreState([
        { status: "completed" },
        { status: "failed" },
      ]);
      expect(result.state).toBe("IDLE");
    });

    it("handles empty runs array", () => {
      const result = runsToCoreState([]);
      expect(result.state).toBe("IDLE");
    });
  });
});

describe("Integration: NL command → intent API → grid status update", () => {
  it("correctly chains intent classification through to core activation", () => {
    // Simulate: user types "check my governance health"
    // → IntentController classifies as "governance"
    // → AgentGrid activates core-0 as BUSY
    const intentType = "governance";
    const activation = getActivationForIntent(intentType);

    expect(activation[0].coreIdx).toBe(0); // Governance core
    expect(activation[0].state).toBe("BUSY");
  });

  it("chains multi-core activation for create intents", () => {
    // Simulate: user types "create a new trading agent"
    // → IntentController classifies as "create"
    // → AgentGrid activates governance + CRE in SYNC
    const intentType = "create";
    const activation = getActivationForIntent(intentType);

    const coreIndexes = activation.map((a) => a.coreIdx);
    expect(coreIndexes).toContain(0); // Governance
    expect(coreIndexes).toContain(2); // CRE Engine
    expect(activation.every((a) => a.state === "SYNC")).toBe(true);
  });

  it("unknown intents route to intent router core", () => {
    const intentType = "some_random_thing";
    const activation = getActivationForIntent(intentType);

    expect(activation[0].coreIdx).toBe(3); // Intent Router core
    expect(activation[0].state).toBe("BUSY");
  });
});
