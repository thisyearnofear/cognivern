/**
 * LedgerCommitment tests.
 *
 * Two layers:
 *  1. The pure Merkle primitives (commitment.ts) — determinism, proofs verify,
 *     tampering fails. No DB, no I/O.
 *  2. The service (LedgerCommitmentService.ts) — a real temp DB with fake
 *     anchor sinks, covering the full flow: commit → anchor → row → receipt →
 *     third-party verification. Also the degraded paths: nothing to commit,
 *     and anchors that fail (row stays 'pending', never a crash).
 */

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `cognivern-commitments-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;

import type { CommitmentAnchorSinks } from "@backend/services/credits/LedgerCommitmentService.js";
import type { CommitmentState } from "@backend/services/credits/commitment.js";

const { getDb, closeDb } = await import("@backend/db/index.js");
const { CreditLedgerService } = await import("@backend/services/credits/CreditLedgerService.js");
const { CreditProgramService } = await import("@backend/services/credits/CreditProgramService.js");
const { LedgerCommitmentService } = await import(
  "@backend/services/credits/LedgerCommitmentService.js",
);
const {
  buildMerkleTree,
  canonicalJson,
  merkleProof,
  sha256Hex,
  stateLeafHash,
  verifyMerkleProof,
} = await import("@backend/services/credits/commitment.js");

const WORKSPACE = "workspace-commitments-test";

let programs: InstanceType<typeof CreditProgramService>;
let commitments: InstanceType<typeof LedgerCommitmentService>;
let capturedPayloads: Record<string, unknown>[];

function fakeSinks(): CommitmentAnchorSinks {
  return {
    zeroG: {
      async anchorAuditRecord(record) {
        capturedPayloads.push(record);
        return { rootHash: `0g-${sha256Hex(JSON.stringify(record)).slice(0, 16)}`, txHash: "0xtx0g" };
      },
    },
    filecoin: {
      async anchorAuditRecord(record) {
        capturedPayloads.push(record);
        return { cid: `fc-${sha256Hex(JSON.stringify(record)).slice(0, 16)}`, txHash: "0xtxfc", actionId: "0xaction" };
      },
    },
  };
}

function state(overrides: Partial<CommitmentState>): CommitmentState {
  return {
    participantId: "p1",
    handle: "alice",
    allocatedNano: 20_000_000_000,
    consumedNano: 5_000_000_000,
    heldNano: 0,
    overdrawnNano: 0,
    requestCount: 3,
    baseAllocationNano: 20_000_000_000,
    disclosureTier: "standard",
    status: "active",
    updatedAt: "2026-08-15T00:00:00.000Z",
    ...overrides,
  };
}

beforeAll(() => {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT OR IGNORE INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)").run(
    "user-commitments-test",
    now,
    now,
  );
  db.prepare(
    "INSERT OR IGNORE INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)",
  ).run(WORKSPACE, WORKSPACE, "user-commitments-test", now, now);

  const ledger = new CreditLedgerService(db);
  programs = new CreditProgramService(db, ledger);
});

afterAll(() => {
  closeDb();
  try {
    fs.unlinkSync(dbPath);
  } catch {
    // already gone
  }
});

// ── Pure primitives ────────────────────────────────────────────────────────

describe("commitment primitives", () => {
  it("canonicalJson is insertion-order independent", () => {
    const a = canonicalJson({ b: 1, a: [2, 3], c: { z: 1, y: null } });
    const b = canonicalJson({ c: { y: null, z: 1 }, a: [2, 3], b: 1 });
    expect(a).toBe(b);
  });

  it("stateLeafHash is deterministic", () => {
    const s = state({});
    expect(stateLeafHash(s)).toBe(stateLeafHash({ ...s }));
    // A different balance changes the leaf.
    expect(stateLeafHash(s)).not.toBe(stateLeafHash(state({ consumedNano: 6_000_000_000 })));
  });

  it("proofs verify for odd and even leaf counts", () => {
    for (const count of [1, 2, 3, 4, 5, 50]) {
      const leaves = Array.from({ length: count }, (_, i) => sha256Hex(`leaf-${i}`));
      const tree = buildMerkleTree(leaves);
      for (let i = 0; i < count; i += 1) {
        const proof = merkleProof(tree, i);
        expect(verifyMerkleProof(tree.root, proof.leaf, proof.index, proof.path)).toBe(true);
        expect(proof.leaf).toBe(leaves[i]);
      }
    }
  });

  it("a tampered leaf fails verification", () => {
    const leaves = [sha256Hex("a"), sha256Hex("b"), sha256Hex("c")];
    const tree = buildMerkleTree(leaves);
    const proof = merkleProof(tree, 1);
    expect(verifyMerkleProof(tree.root, sha256Hex("tampered"), proof.index, proof.path)).toBe(false);
  });

  it("a tampered path fails verification", () => {
    const leaves = [sha256Hex("a"), sha256Hex("b"), sha256Hex("c")];
    const tree = buildMerkleTree(leaves);
    const proof = merkleProof(tree, 1);
    const badPath = proof.path.map((h) => sha256Hex(h));
    expect(verifyMerkleProof(tree.root, proof.leaf, proof.index, badPath)).toBe(false);
  });

  it("empty tree has a stable root", () => {
    expect(buildMerkleTree([]).root).toBe(sha256Hex(""));
  });
});

// ── Service flow ───────────────────────────────────────────────────────────

describe("LedgerCommitmentService", () => {
  it("anchors a commitment and serves a verifiable receipt", async () => {
    capturedPayloads = [];
    commitments = new LedgerCommitmentService(getDb(), fakeSinks());

    const program = programs.createProgram({
      workspaceId: WORKSPACE,
      name: "Verifiable Pilot",
      poolUsd: 1000,
      baseAllocationUsd: 20,
      multipliersMode: "ceiling",
      status: "active",
    });
    const participants = programs
      .provisionParticipants(program.id, [
        { handle: "alice" },
        { handle: "bob" },
        { handle: "carol" },
      ])
      .map((p) => p.participant);

    const row = await commitments.anchor(program.id);
    expect(row).not.toBeNull();
    expect(row!.status).toBe("anchored");
    expect(row!.participantCount).toBe(3);
    expect(row!.zerogRootHash).toMatch(/^0g-/);
    expect(row!.filecoinCid).toMatch(/^fc-/);
    expect(row!.filecoinActionId).toBe("0xaction");

    // The anchored payload contains only hashes — never handles or balances.
    expect(capturedPayloads.length).toBe(2);
    for (const payload of capturedPayloads) {
      expect(payload.type).toBe("cognivern_credit_ledger_commitment");
      expect(payload.commitment_root).toBe(row!.commitmentRoot);
      expect(payload.leaves).toHaveLength(3);
      const serialised = JSON.stringify(payload);
      expect(serialised).not.toContain("alice");
      expect(serialised).not.toContain("20_000_000_000");
    }

    // Every participant's receipt verifies against the anchored root —
    // the exact check a third party runs with no access to our DB.
    for (const p of participants) {
      const receipt = commitments.receipt(program.id, p.id);
      expect(receipt).not.toBeNull();
      expect(receipt!.state.participantId).toBe(p.id);
      expect(
        verifyMerkleProof(
          receipt!.commitment.commitmentRoot,
          receipt!.proof.leaf,
          receipt!.proof.index,
          receipt!.proof.path,
        ),
      ).toBe(true);
      // The receipt's leaf must be the hash of its own state.
      expect(receipt!.proof.leaf).toBe(stateLeafHash(receipt!.state));
    }
  });

  it("a modified balance is caught by the proof", async () => {
    capturedPayloads = [];
    commitments = new LedgerCommitmentService(getDb(), fakeSinks());

    const program = programs.createProgram({
      workspaceId: WORKSPACE,
      name: "Tamper Check",
      poolUsd: 100,
      baseAllocationUsd: 10,
      status: "active",
    });
    const participants = programs
      .provisionParticipants(program.id, [{ handle: "dave" }])
      .map((p) => p.participant);
    await commitments.anchor(program.id);

    const receipt = commitments.receipt(program.id, participants[0].id)!;
    // Tamper: recompute the leaf with a different balance, keep the same path.
    const tamperedLeaf = stateLeafHash({ ...receipt.state, consumedNano: receipt.state.consumedNano + 1 });
    expect(
      verifyMerkleProof(receipt.commitment.commitmentRoot, tamperedLeaf, receipt.proof.index, receipt.proof.path),
    ).toBe(false);
  });

  it("returns null when there is nothing to commit", async () => {
    capturedPayloads = [];
    commitments = new LedgerCommitmentService(getDb(), fakeSinks());

    const program = programs.createProgram({
      workspaceId: WORKSPACE,
      name: "Empty Pilot",
      poolUsd: 100,
      baseAllocationUsd: 10,
      status: "active",
    });
    expect(await commitments.anchor(program.id)).toBeNull();
    expect(capturedPayloads).toHaveLength(0);
    expect(commitments.receipt(program.id, "nope")).toBeNull();
  });

  it("stays 'pending' when every anchor fails — never crashes", async () => {
    commitments = new LedgerCommitmentService(getDb(), {
      zeroG: {
        async anchorAuditRecord() {
          throw new Error("0G down");
        },
      },
      filecoin: {
        async anchorAuditRecord() {
          return null;
        },
      },
    });

    const program = programs.createProgram({
      workspaceId: WORKSPACE,
      name: "Anchor Failure",
      poolUsd: 100,
      baseAllocationUsd: 10,
      status: "active",
    });
    programs.provisionParticipants(program.id, [{ handle: "erin" }]);

    const row = await commitments.anchor(program.id);
    expect(row).not.toBeNull();
    expect(row!.status).toBe("pending");
    expect(row!.zerogRootHash).toBeNull();
    expect(row!.filecoinCid).toBeNull();

    // Receipt still served, but honestly labelled pending — no false proof.
    const participants = programs.listParticipants(program.id);
    const receipt = commitments.receipt(program.id, participants[0].id);
    expect(receipt).not.toBeNull();
    expect(receipt!.commitment.status).toBe("pending");
  });

  it("lists commitments newest-first", async () => {
    capturedPayloads = [];
    commitments = new LedgerCommitmentService(getDb(), fakeSinks());

    const program = programs.createProgram({
      workspaceId: WORKSPACE,
      name: "History",
      poolUsd: 100,
      baseAllocationUsd: 10,
      status: "active",
    });
    programs.provisionParticipants(program.id, [{ handle: "frank" }]);

    await commitments.anchor(program.id);
    await commitments.anchor(program.id);

    const rows = commitments.list(program.id);
    expect(rows.length).toBe(2);
    expect(rows[0].createdAt >= rows[1].createdAt).toBe(true);
  });
});
