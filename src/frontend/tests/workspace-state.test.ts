import { describe, it, expect } from "vitest";
import {
  deriveWorkspaceState,
  type WorkspaceStateFacts,
} from "@/lib/workspace-state";

/**
 * The dashboard's single adaptive source of truth (docs/ADAPTIVE_UX.md).
 * These tests pin the state machine so every surface that consumes it
 * (SetupChecklist, AttentionSummary, WorkspaceNextAction) stays consistent.
 */

const settled: WorkspaceStateFacts = {
  isAuthenticated: true,
  loading: false,
  hasActivePolicy: true,
  hasActiveAgent: true,
  hasApiKey: true,
  hasGovernedRequest: true,
  heldCount: 0,
  blockedCount: 0,
};

describe("deriveWorkspaceState", () => {
  it("is operating when every milestone is met and nothing needs attention", () => {
    expect(deriveWorkspaceState(settled)).toBe("operating");
  });

  it("is setup when any milestone is missing", () => {
    expect(deriveWorkspaceState({ ...settled, hasActivePolicy: false })).toBe("setup");
    expect(deriveWorkspaceState({ ...settled, hasActiveAgent: false })).toBe("setup");
    expect(deriveWorkspaceState({ ...settled, hasApiKey: false })).toBe("setup");
    expect(deriveWorkspaceState({ ...settled, hasGovernedRequest: false })).toBe("setup");
  });

  it("is attention when held or stopped decisions exist", () => {
    expect(deriveWorkspaceState({ ...settled, heldCount: 2 })).toBe("attention");
    expect(deriveWorkspaceState({ ...settled, blockedCount: 1 })).toBe("attention");
    expect(deriveWorkspaceState({ ...settled, heldCount: 1, blockedCount: 3 })).toBe("attention");
  });

  it("prefers setup over attention while milestones are still missing", () => {
    // A workspace that has not finished setup but already has held decisions
    // should still be guided through setup first.
    expect(
      deriveWorkspaceState({ ...settled, hasApiKey: false, heldCount: 2 }),
    ).toBe("setup");
  });

  it("never reports setup while inputs are still loading", () => {
    // Mid-load the state is unknown; default to operating so the checklist
    // does not flash for a returning, fully-set-up workspace.
    expect(deriveWorkspaceState({ ...settled, loading: true, hasActivePolicy: false })).toBe(
      "operating",
    );
  });

  it("never reports setup for an unauthenticated session", () => {
    expect(deriveWorkspaceState({ ...settled, isAuthenticated: false, hasActivePolicy: false })).toBe(
      "operating",
    );
  });
});
