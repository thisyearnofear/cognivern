// Tamper drill — runs against COPIES of the live run store + ledger.
// Validates both tamper surfaces the audit page relies on:
//   1. run-content hash mismatch  (a persisted run byte edited)
//   2. ledger-chain break          (a ledger entry's runHash edited)
//
// Usage: node tamper-drill.mjs <runs.jsonl> <ledger.jsonl>
// Operates only on the files passed in; never touches the live store.
import fs from "node:fs";
import crypto from "node:crypto";

const sha = (s) => `0x${crypto.createHash("sha256").update(s).digest("hex")}`;
const hashRun = (run) => sha(JSON.stringify(run));
const GENESIS = `0x${"0".repeat(64)}`;
const entryHash = (e) =>
  sha(`${e.prevHash}|${e.seq}|${e.op}|${e.runId}|${e.runHash}|${e.timestamp}`);

function readJsonl(p) {
  return fs
    .readFileSync(p, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function latestRunHashes(ledger) {
  const m = new Map();
  for (const e of ledger) m.set(e.runId, e.runHash); // last write wins
  return m;
}

function tamperedRuns(runs, ledger) {
  const lh = latestRunHashes(ledger);
  const tampered = [];
  for (const r of runs) {
    const chained = lh.get(r.runId);
    if (chained && chained !== hashRun(r)) tampered.push(r.runId);
  }
  return tampered;
}

function chainVerify(ledger) {
  let prevHash = GENESIS,
    prevSeq = 0;
  for (const e of ledger) {
    if (e.seq !== prevSeq + 1)
      return { valid: false, brokenAtSeq: e.seq, reason: "sequence gap" };
    if (e.prevHash !== prevHash)
      return { valid: false, brokenAtSeq: e.seq, reason: "prevHash mismatch" };
    if (entryHash(e) !== e.entryHash)
      return { valid: false, brokenAtSeq: e.seq, reason: "entryHash mismatch" };
    prevHash = e.entryHash;
    prevSeq = e.seq;
  }
  return { valid: true, entries: ledger.length };
}

const [runsPath, ledgerPath] = process.argv.slice(2);
const runs = readJsonl(runsPath);
const ledger = readJsonl(ledgerPath);

console.log("=== CLEAN STATE ===");
console.log("runs:", runs.length, "ledger entries:", ledger.length);
console.log("chain:", JSON.stringify(chainVerify(ledger)));
console.log("tamperedRuns:", tamperedRuns(runs, ledger));

// Pick the one chained run (has a ledger entry) for the run-tamper test.
const chained = runs.find((r) => latestRunHashes(ledger).has(r.runId));
if (!chained) {
  console.log("\nNo chained run to tamper — aborting run-tamper step.");
  process.exit(0);
}
const targetId = chained.runId;
console.log("\n=== DRILL 1: edit one persisted run byte (content tamper) ===");
console.log("target run:", targetId);
chained.provenance = { ...chained.provenance, tampered: true }; // flip content
fs.writeFileSync(
  runsPath,
  runs.map((r) => JSON.stringify(r)).join("\n") + "\n",
);
const t1 = tamperedRuns(runs, ledger);
console.log("tamperedRuns after edit:", t1);
console.log("DETECTED:", t1.includes(targetId) ? "YES ✓" : "NO ✗");

// Restore the run, then tamper the ledger chain instead.
delete chained.provenance.tampered;
fs.writeFileSync(
  runsPath,
  runs.map((r) => JSON.stringify(r)).join("\n") + "\n",
);
console.log("\nrestored — tamperedRuns:", tamperedRuns(runs, ledger));

console.log("\n=== DRILL 2: edit a ledger entry's runHash (chain break) ===");
const ledgerMut = readJsonl(ledgerPath); // fresh read
ledgerMut[0].runHash = sha("tampered-ledger-content"); // break entryHash
fs.writeFileSync(
  ledgerPath,
  ledgerMut.map((e) => JSON.stringify(e)).join("\n") + "\n",
);
const cv = chainVerify(ledgerMut);
console.log("chain after ledger edit:", JSON.stringify(cv));
console.log("DETECTED:", !cv.valid ? "YES ✓" : "NO ✗");
