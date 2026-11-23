/**
 * Public proof envelope — cognivern.proof.v1.
 *
 * A summary over a rail's own public record: what was asked, what it cost,
 * what was decided, and the receipts a third party can check. The envelope
 * never contains anything the source record does not, and never replaces
 * the record. See docs/internals/proof-and-eval-contracts.md.
 */
export const PROOF_SCHEMA = "cognivern.proof.v1" as const;

export type ProofKind =
  | "credit-commitment"
  | "sealed-bid-round"
  | "diligence-report"
  | "sealed-bid-replay";

export interface ProofReceipt {
  label: string;
  value: string;
  href?: string;
}

export interface PublicProof {
  schema: typeof PROOF_SCHEMA;
  kind: ProofKind;
  id: string;
  title: string;
  /** What was asked, in one sentence. */
  asked: string;
  mandate: { id: string | null; label: string | null };
  /** USD only when the source record carries a USD figure; never estimated. */
  spent: { usd: number | null; note: string | null };
  decided: { outcome: string; detail: string | null };
  receipts: ProofReceipt[];
  /** What this proof does not show. */
  limits: string[];
  generatedAt: string | null;
}
