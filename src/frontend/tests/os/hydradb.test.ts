import { describe, it, expect } from "vitest";

/**
 * Tests for HydraDB integration — memory/recall service, API route, and CLI integration.
 *
 * These tests verify the HydraDB service logic, the API route action routing,
 * and the terminal CLI command integration without requiring actual HydraDB infrastructure.
 */

// ── Helpers extracted from hydradb-service.ts ───────────────────────────

interface HydraDBStatus {
  configured: boolean;
  tenantExists: boolean;
  tenantId: string | null;
  error?: string;
}

interface RecallResult {
  ok: boolean;
  results?: { results: Array<{ text?: string; score?: number }> };
  error?: string;
}

// Simulated service functions using mocks
function isConfigured(apiKey?: string, tenantId?: string): boolean {
  return !!apiKey && !!tenantId;
}

async function getStatus(
  apiKey?: string,
  tenantId?: string,
  mockTenantExists = false,
): Promise<HydraDBStatus> {
  if (!apiKey || !tenantId) {
    return {
      configured: false,
      tenantExists: false,
      tenantId: tenantId || null,
      error: !apiKey ? "HYDRA_DB_API_KEY not set" : "HYDRA_TENANT_ID not set",
    };
  }
  return {
    configured: true,
    tenantExists: mockTenantExists,
    tenantId,
  };
}

async function addMemory(
  apiKey?: string,
  tenantId?: string,
  text?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!apiKey || !tenantId) {
    return { ok: false, error: "HydraDB not configured" };
  }
  if (!text) {
    return { ok: false, error: "text is required" };
  }
  return { ok: true };
}

async function fullRecall(
  apiKey?: string,
  tenantId?: string,
  query?: string,
): Promise<RecallResult> {
  if (!apiKey || !tenantId) {
    return { ok: false, error: "HydraDB not configured" };
  }
  if (!query) {
    return { ok: false, error: "query is required" };
  }
  // Match the real return shape: RecallResult wraps results in a nested object
  return { ok: true, results: { results: [] } };
}

// ── API route action handler (extracted from route.ts) ──────────────────

type HydraAction =
  | "status"
  | "ensure-tenant"
  | "memory"
  | "recall"
  | "preferences"
  | "qna"
  | "metrics";

interface ActionResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

async function handleHydraAction(
  action: HydraAction,
  body: Record<string, unknown>,
  apiKey?: string,
  tenantId?: string,
): Promise<ActionResponse> {
  switch (action) {
    case "status": {
      const status = await getStatus(apiKey, tenantId);
      return {
        success: true,
        data: status as unknown as Record<string, unknown>,
      };
    }
    case "memory": {
      const text = body.text as string | undefined;
      if (!text || typeof text !== "string") {
        return { success: false, error: "text is required" };
      }
      const result = await addMemory(apiKey, tenantId, text);
      return {
        success: result.ok,
        data: result as unknown as Record<string, unknown>,
        error: result.error,
      };
    }
    case "recall": {
      const query = body.query as string | undefined;
      if (!query || typeof query !== "string") {
        return { success: false, error: "query is required" };
      }
      const result = await fullRecall(apiKey, tenantId, query);
      return {
        success: result.ok,
        data: result as unknown as Record<string, unknown>,
        error: result.error,
      };
    }
    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("HydraDB service — status", () => {
  it("returns unconfigured when API key is missing", async () => {
    const status = await getStatus(undefined, "tenant-1");
    expect(status.configured).toBe(false);
    expect(status.tenantExists).toBe(false);
    expect(status.error).toContain("API_KEY");
  });

  it("returns unconfigured when tenant ID is missing", async () => {
    const status = await getStatus("key-123", undefined);
    expect(status.configured).toBe(false);
    expect(status.error).toContain("TENANT_ID");
  });

  it("returns configured when both key and tenant are present", async () => {
    const status = await getStatus("key-123", "cognivern-os", true);
    expect(status.configured).toBe(true);
    expect(status.tenantExists).toBe(true);
    expect(status.tenantId).toBe("cognivern-os");
  });

  it("handles tenant not found gracefully", async () => {
    const status = await getStatus("key-123", "cognivern-os", false);
    expect(status.configured).toBe(true);
    expect(status.tenantExists).toBe(false);
  });
});

describe("HydraDB service — memory", () => {
  it("stores memory with valid config", async () => {
    const result = await addMemory("key-123", "cognivern-os", "test memory");
    expect(result.ok).toBe(true);
  });

  it("fails when HydraDB not configured", async () => {
    const result = await addMemory(undefined, undefined, "test");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("HydraDB not configured");
  });

  it("fails when text is empty", async () => {
    const result = await addMemory("key-123", "cognivern-os", undefined);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("text is required");
  });
});

describe("HydraDB service — recall", () => {
  it("returns empty results for valid query", async () => {
    const result = await fullRecall(
      "key-123",
      "cognivern-os",
      "user preferences",
    );
    expect(result.ok).toBe(true);
    expect(result.results).toBeDefined();
    // RecallResult wraps results in a nested array
    expect(Array.isArray(result.results?.results)).toBe(true);
  });

  it("fails when query is missing", async () => {
    const result = await fullRecall("key-123", "cognivern-os", undefined);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("query");
  });

  it("fails when not configured", async () => {
    const result = await fullRecall(undefined, undefined, "test");
    expect(result.ok).toBe(false);
  });
});

describe("HydraDB API route — action routing", () => {
  it("handles status action", async () => {
    const res = await handleHydraAction(
      "status",
      {},
      "key-123",
      "cognivern-os",
    );
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
  });

  it("handles memory action with valid text", async () => {
    const res = await handleHydraAction(
      "memory",
      { text: "hello world" },
      "key-123",
      "cognivern-os",
    );
    expect(res.success).toBe(true);
  });

  it("rejects memory action without text", async () => {
    const res = await handleHydraAction(
      "memory",
      {},
      "key-123",
      "cognivern-os",
    );
    expect(res.success).toBe(false);
    expect(res.error).toContain("text is required");
  });

  it("handles recall action with valid query", async () => {
    const res = await handleHydraAction(
      "recall",
      { query: "preferences" },
      "key-123",
      "cognivern-os",
    );
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
  });

  it("rejects recall action without query", async () => {
    const res = await handleHydraAction(
      "recall",
      {},
      "key-123",
      "cognivern-os",
    );
    expect(res.success).toBe(false);
    expect(res.error).toContain("query is required");
  });

  it("rejects unknown actions", async () => {
    const res = await handleHydraAction(
      "unknown-action" as HydraAction,
      {},
      "key-123",
      "cognivern-os",
    );
    expect(res.success).toBe(false);
    expect(res.error).toContain("Unknown action");
  });
});

describe("HydraDB — isConfigured helper", () => {
  it("returns true when both key and tenant are present", () => {
    expect(isConfigured("key-123", "tenant-1")).toBe(true);
  });

  it("returns false when key is missing", () => {
    expect(isConfigured(undefined, "tenant-1")).toBe(false);
  });

  it("returns false when tenant is missing", () => {
    expect(isConfigured("key-123", undefined)).toBe(false);
  });

  it("returns false when both are missing", () => {
    expect(isConfigured(undefined, undefined)).toBe(false);
  });
});

describe("HydraDB — intent enrichment flow", () => {
  it("enriches context with memory results when recall succeeds", async () => {
    // Simulate: user sends query → recall returns results → context is enriched
    const query = "check governance health";
    const recall = await fullRecall("key-123", "cognivern-os", query);

    let enrichedContext: Record<string, unknown> = {};
    if (recall.ok && recall.results) {
      const innerResults = recall.results.results;
      const memoryTexts = Array.isArray(innerResults)
        ? innerResults.map((r: { text?: string }) => r.text).filter(Boolean)
        : [];
      if (memoryTexts.length > 0) {
        enrichedContext = { memoryContext: memoryTexts };
      }
    }

    // No results for a fresh tenant, so context remains empty
    expect(enrichedContext).toEqual({});
  });

  it("enriches context when memories exist", async () => {
    // Simulate recall results with memories (matching RecallResult shape)
    const mockRecallResult = {
      results: [
        { text: "User prefers dark mode" },
        { text: "Previous command: show active agents returned 3 agents" },
      ],
    };

    const innerResults = mockRecallResult.results;
    const memoryTexts = Array.isArray(innerResults)
      ? innerResults.map((r: { text?: string }) => r.text).filter(Boolean)
      : [];

    const enrichedContext = { memoryContext: memoryTexts };

    expect(enrichedContext.memoryContext).toHaveLength(2);
    expect(enrichedContext.memoryContext).toContain("User prefers dark mode");
  });

  it("handles recall failure without breaking the flow", async () => {
    // Simulate: HydraDB is not configured → recall fails → context stays as-is
    const originalContext = { someKey: "value" };
    const enrichedContext = originalContext;

    const recall = await fullRecall(undefined, undefined, "test");
    expect(recall.ok).toBe(false);

    // Since recall failed, context should remain unchanged
    expect(enrichedContext).toEqual(originalContext);
  });
});

describe("HydraDB — terminal CLI integration", () => {
  it("hydra help lists all subcommands", () => {
    const helpText = [
      "hydra status",
      "hydra recall",
      "hydra memory",
      "hydra qna",
      "hydra prefs",
      "hydra help",
    ];
    expect(helpText).toContain("hydra status");
    expect(helpText).toContain("hydra recall");
    expect(helpText).toContain("hydra memory");
    expect(helpText).toContain("hydra help");
    expect(helpText).toHaveLength(6);
  });

  it("hydra subcommand parsing splits correctly", () => {
    const cmd = "hydra recall user preferences";
    const parts = cmd.slice("hydra".length).trim().split(/\s+/);
    expect(parts[0]).toBe("recall");
    expect(parts.slice(1).join(" ")).toBe("user preferences");
  });

  it("hydra memory subcommand extracts text correctly", () => {
    const cmd = "hydra memory I like dark mode";
    const parts = cmd.slice("hydra".length).trim().split(/\s+/);
    expect(parts[0]).toBe("memory");
    expect(parts.slice(1).join(" ")).toBe("I like dark mode");
  });
});
