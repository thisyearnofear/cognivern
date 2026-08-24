/**
 * The dashboard's single adaptive source of truth.
 *
 * The UI adapts to workspace *state*, never to inferred preference (see
 * docs/ADAPTIVE_UX.md). This module is the Analyze step of that loop: it
 * reduces a set of observable workspace facts into one of three states, and
 * every surface that adapts (SetupChecklist, AttentionSummary,
 * WorkspaceNextAction) must consume the result rather than re-derive its own
 * ladder. Keeping the derivation here is what guarantees those surfaces can
 * never contradict each other.
 */

export type WorkspaceState = 'setup' | 'attention' | 'operating';

/** Observable facts the state machine reads. No inference, no preference. */
export interface WorkspaceStateFacts {
  /** Whether a production session exists (setup only applies when signed in). */
  isAuthenticated: boolean;
  /** True while any input is still loading — state is unknown until settled. */
  loading: boolean;
  hasActivePolicy: boolean;
  hasActiveAgent: boolean;
  hasApiKey: boolean;
  hasGovernedRequest: boolean;
  heldCount: number;
  blockedCount: number;
}

/**
 * Reduce observable facts to the one workspace state.
 *
 * - `setup`     — a milestone is missing; the guided checklist owns the screen.
 * - `attention` — held or stopped decisions exist; they need an operator.
 * - `operating` — governance is steady; the forward-looking review is next.
 */
export function deriveWorkspaceState(facts: WorkspaceStateFacts): WorkspaceState {
  // Setup is the primary journey only until the workspace has proved the loop
  // end-to-end (policy + identity + key + first decision). Gated on a settled,
  // authenticated session so it never flashes for visitors or mid-load.
  const showSetup =
    facts.isAuthenticated &&
    !facts.loading &&
    (!facts.hasActivePolicy ||
      !facts.hasActiveAgent ||
      !facts.hasApiKey ||
      !facts.hasGovernedRequest);
  if (showSetup) return 'setup';
  if (facts.heldCount + facts.blockedCount > 0) return 'attention';
  return 'operating';
}
