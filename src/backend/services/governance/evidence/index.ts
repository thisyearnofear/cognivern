import {
  filecoinEvidenceSink,
  FilecoinEvidenceSink,
} from "./FilecoinEvidenceSink.js";
import {
  zeroGStorageEvidenceSink,
  ZeroGStorageEvidenceSink,
} from "./ZeroGStorageEvidenceSink.js";
import type { EvidenceSink } from "./EvidenceSink.js";

export type { EvidenceAnchorEvent, EvidenceAnchorResult, EvidenceSink } from "./EvidenceSink.js";
export { fanOutEvidenceAnchors } from "./EvidenceSink.js";
export { FilecoinEvidenceSink, filecoinEvidenceSink };
export { ZeroGStorageEvidenceSink, zeroGStorageEvidenceSink };

/** Default audit / governance storage sinks (CRE narrative is separate). */
export function defaultAuditEvidenceSinks(): EvidenceSink[] {
  return [zeroGStorageEvidenceSink, filecoinEvidenceSink];
}

/**
 * Map workspace settings evidenceSinks ids → concrete adapters.
 * Unknown / empty → platform defaults (same as unset).
 */
export function selectEvidenceSinks(
  sinkIds: readonly string[] | undefined | null,
  available: EvidenceSink[] = defaultAuditEvidenceSinks(),
): EvidenceSink[] {
  if (!sinkIds || sinkIds.length === 0) return available;

  const aliases: Record<string, string> = {
    zerog: "zerog-storage",
    "zerog-storage": "zerog-storage",
    filecoin: "filecoin",
  };

  const wanted = new Set(
    sinkIds.map((id) => aliases[id] ?? id).filter(Boolean),
  );
  const selected = available.filter((s) => wanted.has(s.name));
  return selected.length > 0 ? selected : available;
}
