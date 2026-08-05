/**
 * Shared demo policy bands.
 *
 * The landing-page interactive slider, the demo-tier governance evaluator
 * (demoInterceptor), and the Tester Guide all describe the same three-band
 * spend story. They drifted apart historically (the landing slider denied at
 * $100 while the backend held at $100 and denied at $3000). This module is
 * the single source of truth so the marketing pitch and the product demo
 * never contradict each other again.
 *
 * Bands:
 *   < APPROVE_THRESHOLD  → approved (auto)
 *   ≥ APPROVE_THRESHOLD  → held (needs operator review)
 *   > HARD_LIMIT         → denied (hard limit)
 */
export const DEMO_APPROVE_THRESHOLD = 100;
export const DEMO_HARD_LIMIT = 3000;

export type DemoDecision = "approved" | "held" | "denied";

/**
 * Resolve a spend amount to its demo decision. Mirrors the logic in
 * demoInterceptor.serveDemoData so the landing-page slider and the backend
 * agree on every value.
 */
export function resolveDemoDecision(amount: number): DemoDecision {
  if (amount > DEMO_HARD_LIMIT) return "denied";
  if (amount >= DEMO_APPROVE_THRESHOLD) return "held";
  return "approved";
}

/**
 * Human-readable reason for a demo decision, matching the backend's
 * policyCheck / reasoning strings.
 */
export function demoDecisionReason(amount: number): string {
  const decision = resolveDemoDecision(amount);
  switch (decision) {
    case "denied":
      return `Amount $${amount} exceeds $${DEMO_HARD_LIMIT} hard limit`;
    case "held":
      return `Amount $${amount} ≥ $${DEMO_APPROVE_THRESHOLD} requires operator review`;
    case "approved":
      return `Under $${DEMO_APPROVE_THRESHOLD} auto-approval threshold`;
  }
}
