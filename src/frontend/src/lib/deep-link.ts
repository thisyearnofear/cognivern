/**
 * Deep-linking between the dashboard and the audit timeline.
 *
 * The audit page renders decisions inline (no per-decision route), so a
 * deep link carries the decision id as `?id=<decisionId>`. The timeline
 * node wrapper is given a stable DOM id derived from the decision id, and
 * `scrollDecisionIntoView` moves the viewport to it once the data has
 * rendered. Returns false when the node is not in the DOM yet so the caller
 * can retry after the timeline loads.
 */

/** DOM id of the audit timeline node wrapping a decision. */
export function decisionNodeId(decisionId: string): string {
  return `decision-${decisionId}`;
}

/** Scroll the audit timeline to a decision. True if the node was present. */
export function scrollDecisionIntoView(decisionId: string): boolean {
  const node = document.getElementById(decisionNodeId(decisionId));
  if (!node) return false;
  node.scrollIntoView?.({ behavior: "smooth", block: "center" });
  return true;
}