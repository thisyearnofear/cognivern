/**
 * CRE (Canonical Run Evidence) subpath — the run lifecycle read model.
 *
 * Prefer `@cognivern/shared/cre` over the barrel when a module only needs run
 * status derivation; this keeps tree-shaking reliable and the frontend bundle
 * from pulling the entire shared surface.
 */
export type {
  RunStatus,
  Run,
  RunEvent,
  ProofAnchorReceipt,
} from "./types/index.js";

export { normalizeRunStatus } from "./types/index.js";
