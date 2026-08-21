/**
 * EvidenceSink — pluggable anchors for governance / audit evidence.
 *
 * CRE remains the canonical narrative. Sinks attach durable refs (CID, root
 * hash, tx) onto run.evidence without blocking the control plane.
 *
 * @see docs/ARCHITECTURE_RAILS.md
 */

export interface EvidenceAnchorEvent {
  runId: string;
  workspaceId?: string;
  /** Logical kind, e.g. "audit_event" | "governance_decision". */
  kind: string;
  payloadHash: string;
  /** Opaque payload forwarded to storage contracts / indexers. */
  payload: Record<string, unknown>;
}

export interface EvidenceAnchorResult {
  sink: string;
  railId?: string;
  chainId?: number;
  /** Primary external reference (cid, root hash, proof id, tx hash). */
  ref: string;
  explorerUrl?: string;
  /** Patch merged into CreRun.evidence after a successful anchor. */
  evidencePatch: Record<string, unknown>;
}

export interface EvidenceSink {
  readonly name: string;
  anchor(event: EvidenceAnchorEvent): Promise<EvidenceAnchorResult | null>;
}

/**
 * Fire-and-forget fan-out. Each sink is independent; failures are logged by
 * the sink (or here) and never reject the aggregate.
 */
export function fanOutEvidenceAnchors(
  sinks: readonly EvidenceSink[],
  event: EvidenceAnchorEvent,
  onResult: (result: EvidenceAnchorResult) => void | Promise<void>,
): void {
  for (const sink of sinks) {
    void sink
      .anchor(event)
      .then(async (result) => {
        if (!result) return;
        await onResult(result);
      })
      .catch(() => {
        /* sink implementations already log; swallow to keep governance hot path clean */
      });
  }
}
