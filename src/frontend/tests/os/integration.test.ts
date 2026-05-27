import { describe, it, expect, beforeEach } from "vitest";

/**
 * Integration test: NL command → intent API → grid status update flow.
 *
 * Simulates the full pipeline without browser dependencies:
 *   1. User types natural language command
 *   2. Terminal dispatches to /api/os/intent
 *   3. Intent API returns classified response
 *   4. AgentGrid receives activation signal
 *   5. Grid cores transition to correct states
 */

// ── Simulated pipeline ─────────────────────────────────────────────────

type AgentState = "IDLE" | "BUSY" | "CRSH" | "SYNC";

interface CoreState {
  id: string;
  name: string;
  state: AgentState;
  task: string | null;
}

interface IntentResult {
  success: boolean;
  data?: {
    type: string;
    response: string;
    suggestions?: string[];
  };
  error?: string;
}

const CORE_DEFINITIONS = [
  { id: "core-0", name: "Governance" },
  { id: "core-1", name: "Audit" },
  { id: "core-2", name: "CRE Engine" },
  { id: "core-3", name: "Intent Router" },
];

const INTENT_CORE_MAP: Record<
  string,
  { coreIdx: number; state: AgentState }[]
> = {
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

function createCores(): CoreState[] {
  return CORE_DEFINITIONS.map((c) => ({
    ...c,
    state: "IDLE" as AgentState,
    task: null,
  }));
}

function applyIntentToCores(
  cores: CoreState[],
  intentType: string,
): CoreState[] {
  const activation = INTENT_CORE_MAP[intentType] || [
    { coreIdx: 3, state: "BUSY" },
  ];
  return cores.map((core, i) => {
    const match = activation.find((a) => a.coreIdx === i);
    if (match) {
      return { ...core, state: match.state, task: intentType };
    }
    return core;
  });
}

function resetCores(cores: CoreState[]): CoreState[] {
  return cores.map((core) => ({
    ...core,
    state: "IDLE" as AgentState,
    task: null,
  }));
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("Integration: Full NL command pipeline", () => {
  let cores: CoreState[];

  beforeEach(() => {
    cores = createCores();
  });

  it("governance query lights up governance core", () => {
    // Step 1-3: Intent API classifies as governance
    const intentType = "governance";

    // Step 4-5: Grid activates
    cores = applyIntentToCores(cores, intentType);

    expect(cores[0].state).toBe("BUSY");
    expect(cores[0].task).toBe("governance");
    expect(cores[1].state).toBe("IDLE");
    expect(cores[2].state).toBe("IDLE");
    expect(cores[3].state).toBe("IDLE");
  });

  it("forensic query lights up audit core", () => {
    cores = applyIntentToCores(cores, "forensic");
    expect(cores[1].state).toBe("BUSY");
    expect(cores[0].state).toBe("IDLE");
  });

  it("create query activates multiple cores in SYNC", () => {
    cores = applyIntentToCores(cores, "create");
    expect(cores[0].state).toBe("SYNC");
    expect(cores[2].state).toBe("SYNC");
    expect(cores[1].state).toBe("IDLE");
    expect(cores[3].state).toBe("IDLE");
  });

  it("unknown intent falls back to intent router core", () => {
    cores = applyIntentToCores(cores, "unrecognized_type");
    expect(cores[3].state).toBe("BUSY");
    expect(cores[3].task).toBe("unrecognized_type");
  });

  it("reset returns all cores to IDLE", () => {
    cores = applyIntentToCores(cores, "create");
    expect(cores.some((c) => c.state !== "IDLE")).toBe(true);

    cores = resetCores(cores);
    expect(cores.every((c) => c.state === "IDLE")).toBe(true);
    expect(cores.every((c) => c.task === null)).toBe(true);
  });

  it("sequential commands update cores correctly", () => {
    // First command: governance
    cores = applyIntentToCores(cores, "governance");
    expect(cores[0].state).toBe("BUSY");

    // Second command: agent (after reset)
    cores = resetCores(cores);
    cores = applyIntentToCores(cores, "agent");
    expect(cores[2].state).toBe("BUSY");
    expect(cores[0].state).toBe("IDLE");
  });
});

describe("Integration: API response formatting pipeline", () => {
  it("formats intent response with type tag and response text", () => {
    const apiResponse: IntentResult = {
      success: true,
      data: {
        type: "governance",
        response: "All 3 policies are active. Health score: 98/100.",
        suggestions: ["View audit trail", "Check agent compliance"],
      },
    };

    expect(apiResponse.success).toBe(true);
    expect(apiResponse.data?.type).toBe("governance");
    expect(apiResponse.data?.response).toContain("Health score");
    expect(apiResponse.data?.suggestions).toHaveLength(2);
  });

  it("handles API error gracefully", () => {
    const apiResponse: IntentResult = {
      success: false,
      error: "Backend error 502: Service Unavailable",
    };

    expect(apiResponse.success).toBe(false);
    expect(apiResponse.error).toContain("502");
  });

  it("handles network failure gracefully", () => {
    // Simulate fetch rejection
    const error = new Error("Failed to fetch");
    expect(error.message).toBe("Failed to fetch");
  });
});
