/**
 * commitment.ts — pure Merkle-tree primitives for credit-ledger commitments.
 *
 * The trust model: Cognivern periodically computes a commitment over every
 * participant's balance state, builds a binary Merkle tree over the leaf
 * hashes, and anchors the root + leaf hashes to 0G Storage and Filecoin. Once
 * anchored, no balance can be changed without breaking the root — and anyone
 * holding a participant's receipt (leaf + index + path) can verify it against
 * the root, which is independently retrievable from the anchor.
 *
 * Deliberate privacy choice: the anchored payload contains only leaf HASHES,
 * never participant handles or balances. The leaf content stays in our DB and
 * is served per-participant on demand (their own receipt). This is the
 * transparency-log shape: the tree commits to the existence of each state
 * without publishing it.
 *
 * Everything here is a pure function over strings — no DB, no I/O — so it is
 * trivially testable and safe to run on any deployment.
 */

import crypto from "node:crypto";

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Stable serialization with sorted keys, so the same object always hashes the
 * same regardless of insertion order — a requirement for anything that will be
 * re-derived and compared against an external anchor.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

/**
 * The per-participant state committed at a point in time. Every field is taken
 * from credit_participants plus its ledger-derived counters; `updatedAt` makes
 * each state unique to its snapshot.
 */
export interface CommitmentState {
  participantId: string;
  handle: string;
  allocatedNano: number;
  consumedNano: number;
  heldNano: number;
  overdrawnNano: number;
  requestCount: number;
  baseAllocationNano: number;
  disclosureTier: string;
  status: string;
  updatedAt: string;
}

export function stateLeafHash(state: CommitmentState): string {
  return sha256Hex(canonicalJson(state));
}

export interface MerkleTree {
  root: string;
  leaves: string[];
  /** levels[0] is the leaf layer; levels[levels.length-1] is the root layer. */
  levels: string[][];
}

export interface MerkleProof {
  leaf: string;
  index: number;
  /** Sibling hashes from leaf to root (bottom-up). */
  path: string[];
}

/**
 * Build a binary Merkle tree over the given leaves. Odd levels duplicate the
 * last node (the well-known Bitcoin-style padding), so any leaf count works.
 * Returns the root and the full level set so proofs can be extracted.
 */
export function buildMerkleTree(leaves: string[]): MerkleTree {
  const levels: string[][] = [leaves];
  let level = leaves;
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      next.push(sha256Hex(left + right));
    }
    levels.push(next);
    level = next;
  }
  return { root: level[0] ?? sha256Hex(""), leaves, levels };
}

export function merkleProof(tree: MerkleTree, index: number): MerkleProof {
  const leaf = tree.leaves[index];
  if (leaf === undefined) throw new Error(`No leaf at index ${index}`);
  const path: string[] = [];
  let levelIndex = index;
  for (let depth = 0; depth < tree.levels.length - 1; depth += 1) {
    const level = tree.levels[depth];
    const sibling =
      levelIndex % 2 === 0
        ? levelIndex + 1 < level.length
          ? level[levelIndex + 1]
          : level[levelIndex]
        : level[levelIndex - 1];
    path.push(sibling);
    levelIndex = Math.floor(levelIndex / 2);
  }
  return { leaf, index, path };
}

/**
 * Recompute the root from leaf + index + path and compare. This is the check
 * any third party can run against an anchored root — no server, no DB.
 */
export function verifyMerkleProof(
  root: string,
  leaf: string,
  index: number,
  path: string[],
): boolean {
  let hash = leaf;
  let idx = index;
  for (const sibling of path) {
    hash = idx % 2 === 0 ? sha256Hex(hash + sibling) : sha256Hex(sibling + hash);
    idx = Math.floor(idx / 2);
  }
  return hash === root;
}
