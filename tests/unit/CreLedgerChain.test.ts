import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CreLedgerChain,
  hashRun,
} from "@backend/cre/persistence/CreLedgerChain.js";
import type { CreRun } from "@backend/cre/types.js";

function makeRun(runId: string): CreRun {
  return {
    runId,
    workflow: "spend",
    mode: "local",
    startedAt: new Date().toISOString(),
    ok: true,
    status: "completed",
    steps: [],
    artifacts: [],
  };
}

let ledgerFile: string;
let chain: CreLedgerChain;

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cre-ledger-"));
  ledgerFile = path.join(dir, "cre-ledger.jsonl");
  chain = new CreLedgerChain({ filePath: ledgerFile });
});

describe("CreLedgerChain", () => {
  it("chains entries and verifies a clean ledger", async () => {
    await chain.record("add", makeRun("run-1"));
    await chain.record("replace", makeRun("run-1"));
    await chain.record("add", makeRun("run-2"));

    const result = await chain.verify();
    expect(result.valid).toBe(true);
    expect(result.entries).toBe(3);
    expect(result.headHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("verifies an empty ledger as valid", async () => {
    const result = await chain.verify();
    expect(result.valid).toBe(true);
    expect(result.entries).toBe(0);
  });

  it("detects an edited entry", async () => {
    await chain.record("add", makeRun("run-1"));
    await chain.record("add", makeRun("run-2"));

    const lines = fs
      .readFileSync(ledgerFile, "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    lines[0].runHash = hashRun(makeRun("run-tampered"));
    fs.writeFileSync(
      ledgerFile,
      lines.map((l) => JSON.stringify(l)).join("\n") + "\n",
    );

    const result = await chain.verify();
    expect(result.valid).toBe(false);
    expect(result.brokenAtSeq).toBe(1);
    expect(result.reason).toContain("entryHash");
  });

  it("detects a deleted entry", async () => {
    await chain.record("add", makeRun("run-1"));
    await chain.record("add", makeRun("run-2"));
    await chain.record("add", makeRun("run-3"));

    const lines = fs.readFileSync(ledgerFile, "utf8").trim().split("\n");
    lines.splice(1, 1); // remove the middle entry
    fs.writeFileSync(ledgerFile, lines.join("\n") + "\n");

    const result = await chain.verify();
    expect(result.valid).toBe(false);
    expect(result.brokenAtSeq).toBe(3);
  });

  it("tracks the latest content hash per run for cross-checking", async () => {
    const v1 = makeRun("run-1");
    await chain.record("add", v1);
    const v2 = { ...v1, ok: false, status: "failed" as const };
    await chain.record("replace", v2);

    const hashes = await chain.latestRunHashes();
    expect(hashes.get("run-1")).toBe(hashRun(v2));
    expect(hashes.get("run-1")).not.toBe(hashRun(v1));
  });

  it("serializes concurrent appends without breaking the chain", async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        chain.record("add", makeRun(`run-${i}`)),
      ),
    );
    const result = await chain.verify();
    expect(result.valid).toBe(true);
    expect(result.entries).toBe(20);
  });
});
