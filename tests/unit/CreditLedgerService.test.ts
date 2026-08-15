import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `cognivern-credits-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;

const { getDb, closeDb } = await import("@backend/db/index.js");
const { CreditLedgerService, InsufficientCreditsError } = await import(
  "@backend/services/credits/CreditLedgerService.js"
);
const { CreditProgramService } = await import(
  "@backend/services/credits/CreditProgramService.js"
);
const { usdToNano, nanoToUsd } = await import("@backend/services/credits/money.js");
const { CEILING_DISCLOSURE_MULTIPLIERS } = await import(
  "@backend/services/credits/disclosure.js"
);

const WORKSPACE = "workspace-credits-test";

let ledger: InstanceType<typeof CreditLedgerService>;
let programs: InstanceType<typeof CreditProgramService>;

beforeAll(() => {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT OR IGNORE INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)").run(
    "user-credits-test",
    now,
    now,
  );
  db.prepare(
    "INSERT OR IGNORE INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)",
  ).run(WORKSPACE, WORKSPACE, "user-credits-test", now, now);

  ledger = new CreditLedgerService(db);
  programs = new CreditProgramService(db, ledger);
});

afterAll(() => {
  closeDb();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${dbPath}${suffix}`);
    } catch {
      // Ignore SQLite cleanup races.
    }
  }
});

beforeEach(() => {
  const db = getDb();
  db.exec("DELETE FROM credit_ledger");
  db.exec("DELETE FROM inference_records");
  db.exec("DELETE FROM credit_participants");
  db.exec("DELETE FROM credit_programs");
});

function makeProgram(overrides: Record<string, unknown> = {}) {
  return programs.createProgram({
    workspaceId: WORKSPACE,
    name: "Test Hackathon",
    baseAllocationUsd: 20,
    poolUsd: 1000,
    status: "active",
    ...overrides,
  });
}

describe("allocation and disclosure multipliers", () => {
  it("grants base allocation at the private tier", () => {
    const program = makeProgram();
    const [{ participant }] = programs.provisionParticipants(program.id, [
      { handle: "alice", disclosureTier: "private" },
    ]);

    expect(nanoToUsd(participant.allocatedNano)).toBe(20);
  });

  it("scales allocation by tier, so more disclosure unlocks more budget", () => {
    const program = makeProgram();
    const provisioned = programs.provisionParticipants(program.id, [
      { handle: "p-private", disclosureTier: "private" },
      { handle: "p-standard", disclosureTier: "standard" },
      { handle: "p-detailed", disclosureTier: "detailed" },
      { handle: "p-open", disclosureTier: "open" },
    ]);

    const byHandle = new Map(
      provisioned.map(({ participant }) => [participant.handle, nanoToUsd(participant.allocatedNano)]),
    );

    expect(byHandle.get("p-private")).toBe(20);
    expect(byHandle.get("p-standard")).toBe(25);
    expect(byHandle.get("p-detailed")).toBe(30);
    expect(byHandle.get("p-open")).toBe(40);
  });

  it("increases available credit when a participant raises their tier", () => {
    const program = makeProgram();
    const [{ participant }] = programs.provisionParticipants(program.id, [
      { handle: "bob", disclosureTier: "private" },
    ]);

    const before = ledger.getBalance(participant.id)!;
    programs.setDisclosureTier(participant.id, "open");
    const after = ledger.getBalance(participant.id)!;

    expect(nanoToUsd(before.availableNano)).toBe(20);
    expect(nanoToUsd(after.availableNano)).toBe(40);
  });

  it("never claws back credit already spent when a tier is lowered", () => {
    const program = makeProgram();
    const [{ participant }] = programs.provisionParticipants(program.id, [
      { handle: "carol", disclosureTier: "open" },
    ]);

    // Spend $35 of a $40 open-tier allocation.
    const hold = ledger.hold(participant.id, usdToNano(35));
    ledger.settle(hold, usdToNano(35));

    // Downgrading to private would imply a $20 allocation — below what is spent.
    programs.setDisclosureTier(participant.id, "private");
    const balance = ledger.getBalance(participant.id)!;

    expect(nanoToUsd(balance.consumedNano)).toBe(35);
    expect(nanoToUsd(balance.allocatedNano)).toBe(35);
    expect(balance.availableNano).toBe(0);
    expect(balance.consumedNano).toBeLessThanOrEqual(balance.allocatedNano);
  });
});

describe("two-phase hold and settle", () => {
  it("reserves credit on hold and releases it on settle at the real cost", () => {
    const program = makeProgram();
    const [{ participant }] = programs.provisionParticipants(program.id, [{ handle: "dave" }]);

    const hold = ledger.hold(participant.id, usdToNano(5));
    const held = ledger.getBalance(participant.id)!;
    expect(nanoToUsd(held.heldNano)).toBe(5);
    expect(nanoToUsd(held.availableNano)).toBe(20); // 25 allocated - 5 held

    // Real cost came in far below the estimate.
    ledger.settle(hold, usdToNano(0.5));
    const settled = ledger.getBalance(participant.id)!;

    expect(settled.heldNano).toBe(0);
    expect(nanoToUsd(settled.consumedNano)).toBe(0.5);
    expect(nanoToUsd(settled.availableNano)).toBe(24.5);
    expect(settled.requestCount).toBe(1);
  });

  it("returns the full hold on release and does not charge the participant", () => {
    const program = makeProgram();
    const [{ participant }] = programs.provisionParticipants(program.id, [{ handle: "erin" }]);

    const hold = ledger.hold(participant.id, usdToNano(5));
    ledger.release(hold);
    const balance = ledger.getBalance(participant.id)!;

    expect(balance.heldNano).toBe(0);
    expect(balance.consumedNano).toBe(0);
    expect(nanoToUsd(balance.availableNano)).toBe(25);
    expect(balance.requestCount).toBe(0);
  });

  it("rejects a hold that exceeds available credit", () => {
    const program = makeProgram();
    const [{ participant }] = programs.provisionParticipants(program.id, [{ handle: "frank" }]);

    expect(() => ledger.hold(participant.id, usdToNano(26))).toThrow(InsufficientCreditsError);

    // The failed hold must not have moved anything.
    const balance = ledger.getBalance(participant.id)!;
    expect(balance.heldNano).toBe(0);
    expect(nanoToUsd(balance.availableNano)).toBe(25);
  });

  it("counts concurrent holds against the same budget", () => {
    const program = makeProgram();
    const [{ participant }] = programs.provisionParticipants(program.id, [{ handle: "grace" }]);

    // Three in-flight requests at $10 each: the third must not fit in $25.
    ledger.hold(participant.id, usdToNano(10));
    ledger.hold(participant.id, usdToNano(10));
    expect(() => ledger.hold(participant.id, usdToNano(10))).toThrow(InsufficientCreditsError);

    expect(nanoToUsd(ledger.getBalance(participant.id)!.heldNano)).toBe(20);
  });

  it("records an overdraft when actual cost exceeds the hold", () => {
    const program = makeProgram();
    const [{ participant }] = programs.provisionParticipants(program.id, [{ handle: "heidi" }]);

    const hold = ledger.hold(participant.id, usdToNano(25));
    // Provider billed more than the estimate reserved.
    ledger.settle(hold, usdToNano(30));

    const balance = ledger.getBalance(participant.id)!;
    expect(nanoToUsd(balance.consumedNano)).toBe(30);
    expect(nanoToUsd(balance.overdrawnNano)).toBe(5);
    expect(balance.availableNano).toBe(0);

    // And the next request is refused.
    expect(() => ledger.hold(participant.id, 1)).toThrow(InsufficientCreditsError);
  });

  it("refuses to spend on behalf of a suspended participant", () => {
    const program = makeProgram();
    const [{ participant }] = programs.provisionParticipants(program.id, [{ handle: "ivan" }]);

    programs.setParticipantStatus(participant.id, "suspended");
    expect(() => ledger.hold(participant.id, usdToNano(1))).toThrow(/suspended/);
  });
});

describe("ledger integrity", () => {
  it("keeps denormalised counters in agreement with the append-only ledger", () => {
    const program = makeProgram();
    const [{ participant }] = programs.provisionParticipants(program.id, [{ handle: "judy" }]);

    for (let i = 0; i < 25; i += 1) {
      const hold = ledger.hold(participant.id, usdToNano(0.5));
      ledger.settle(hold, usdToNano(0.2));
    }
    const released = ledger.hold(participant.id, usdToNano(1));
    ledger.release(released);
    ledger.refund(participant.id, usdToNano(1));

    const reconciliation = ledger.reconcile(participant.id);
    expect(reconciliation.ok).toBe(true);
    expect(reconciliation.driftNano).toBe(0);
  });

  it("writes an append-only trail covering holds, releases and debits", () => {
    const program = makeProgram();
    const [{ participant }] = programs.provisionParticipants(program.id, [{ handle: "ken" }]);

    const hold = ledger.hold(participant.id, usdToNano(2), { refId: "inf_1" });
    ledger.settle(hold, usdToNano(1), { refId: "inf_1" });

    const kinds = ledger.listEntries(participant.id).map((e) => e.kind);
    expect(kinds).toContain("allocation");
    expect(kinds).toContain("hold");
    expect(kinds).toContain("hold_release");
    expect(kinds).toContain("debit");
  });

  it("rejects fractional and negative amounts rather than corrupting balances", () => {
    const program = makeProgram();
    const [{ participant }] = programs.provisionParticipants(program.id, [{ handle: "leo" }]);

    expect(() => ledger.hold(participant.id, 1.5)).toThrow(/integer/);
    expect(() => ledger.hold(participant.id, -1)).toThrow(/negative/);
    expect(() => ledger.hold(participant.id, Number.NaN)).toThrow();
  });

  it("aggregates program totals across the cohort", () => {
    const program = makeProgram();
    const provisioned = programs.provisionParticipants(
      program.id,
      Array.from({ length: 10 }, (_, i) => ({ handle: `p${i}`, disclosureTier: "standard" as const })),
    );

    for (const { participant } of provisioned) {
      const hold = ledger.hold(participant.id, usdToNano(1));
      ledger.settle(hold, usdToNano(1));
    }

    const totals = ledger.programTotals(program.id);
    expect(totals.participantCount).toBe(10);
    expect(nanoToUsd(totals.allocatedNano)).toBe(250);
    expect(nanoToUsd(totals.consumedNano)).toBe(10);
    expect(totals.requestCount).toBe(10);
  });
});

describe("sponsor top-ups", () => {
  it("tops up one participant, respecting their disclosure multiplier", () => {
    const program = makeProgram();
    const [{ participant }] = programs.provisionParticipants(program.id, [
      { handle: "topup-one", disclosureTier: "open" },
    ]);

    // $20 base at open (2x) = $40.
    expect(nanoToUsd(participant.allocatedNano)).toBe(40);

    // Raising the base to $30 grants $60 spendable, not $30.
    const updated = programs.setBaseAllocation(participant.id, 30);
    expect(nanoToUsd(updated.baseAllocationNano)).toBe(30);
    expect(nanoToUsd(updated.allocatedNano)).toBe(60);
    expect(nanoToUsd(ledger.getBalance(participant.id)!.availableNano)).toBe(60);
  });

  it("tops up the whole cohort in one call", () => {
    const program = makeProgram();
    programs.provisionParticipants(
      program.id,
      Array.from({ length: 5 }, (_, i) => ({ handle: `bulk-${i}` })),
    );

    const { toppedUp } = programs.topUpAll(program.id, 10);
    expect(toppedUp).toBe(5);

    // $20 + $10 base at standard (1.25x) = $37.50 each.
    for (const participant of programs.listParticipants(program.id)) {
      expect(nanoToUsd(participant.baseAllocationNano)).toBe(30);
      expect(nanoToUsd(participant.allocatedNano)).toBe(37.5);
    }
    expect(nanoToUsd(ledger.programTotals(program.id).allocatedNano)).toBe(187.5);
  });

  it("skips suspended participants when topping up the cohort", () => {
    const program = makeProgram();
    const provisioned = programs.provisionParticipants(program.id, [
      { handle: "active-one" },
      { handle: "suspended-one" },
    ]);
    programs.setParticipantStatus(provisioned[1].participant.id, "suspended");

    const { toppedUp } = programs.topUpAll(program.id, 10);
    expect(toppedUp).toBe(1);
    expect(
      nanoToUsd(programs.getParticipant(provisioned[1].participant.id)!.baseAllocationNano),
    ).toBe(20);
  });

  it("refuses a top-up that would exceed the pool", () => {
    // $100 pool, 3 participants at $20 base. Worst case is already $120 at the
    // 2x open multiplier, so use ceiling multipliers to make the setup valid,
    // then attempt a top-up that genuinely overruns.
    const program = makeProgram({
      poolUsd: 100,
      baseAllocationUsd: 20,
      disclosureMultipliers: CEILING_DISCLOSURE_MULTIPLIERS,
    });
    programs.provisionParticipants(
      program.id,
      Array.from({ length: 5 }, (_, i) => ({ handle: `cap-${i}` })),
    );

    // 5 x $20 = $100, exactly the pool. Any top-up must be refused.
    expect(() => programs.topUpAll(program.id, 5)).toThrow(/pool/i);
  });

  it("leaves the cohort untouched when a bulk top-up is refused", () => {
    const program = makeProgram({
      poolUsd: 100,
      baseAllocationUsd: 20,
      disclosureMultipliers: CEILING_DISCLOSURE_MULTIPLIERS,
    });
    programs.provisionParticipants(
      program.id,
      Array.from({ length: 5 }, (_, i) => ({ handle: `atomic-${i}` })),
    );

    expect(() => programs.topUpAll(program.id, 5)).toThrow();
    for (const participant of programs.listParticipants(program.id)) {
      expect(nanoToUsd(participant.baseAllocationNano)).toBe(20);
    }
  });

  it("keeps the ledger reconciled after top-ups and spend", () => {
    const program = makeProgram();
    const [{ participant }] = programs.provisionParticipants(program.id, [{ handle: "recon" }]);

    const hold = ledger.hold(participant.id, usdToNano(5));
    ledger.settle(hold, usdToNano(3));
    programs.setBaseAllocation(participant.id, 40);
    const hold2 = ledger.hold(participant.id, usdToNano(2));
    ledger.settle(hold2, usdToNano(2));

    expect(ledger.reconcile(participant.id).ok).toBe(true);
  });

  it("records every top-up as a ledger line", () => {
    const program = makeProgram();
    const [{ participant }] = programs.provisionParticipants(program.id, [{ handle: "trail" }]);

    programs.setBaseAllocation(participant.id, 30);
    const entries = ledger.listEntries(participant.id);
    const adjustments = entries.filter((e) => e.kind === "adjustment");

    expect(adjustments.length).toBeGreaterThan(0);
    expect(adjustments[0].note).toMatch(/base allocation/i);
  });
});

describe("multiplier mode selection", () => {
  it("derives 'bonus' mode when nothing is overridden", () => {
    const program = makeProgram();
    expect(program.multipliersMode).toBe("bonus");
  });

  it("resolves the 'ceiling' preset from the multipliersMode knob", () => {
    const program = makeProgram({ multipliersMode: "ceiling" });
    expect(program.multipliersMode).toBe("ceiling");
    expect(program.disclosureMultipliers.private).toBe(0.5);
    expect(program.disclosureMultipliers.open).toBe(1);
  });

  it("re-derives the mode after a PATCH back to bonus", () => {
    const program = makeProgram({ multipliersMode: "ceiling" });
    const updated = programs.updateProgram(program.id, { multipliersMode: "bonus" });
    expect(updated.multipliersMode).toBe("bonus");
  });

  it("labels a partial override as custom", () => {
    const program = makeProgram({ disclosureMultipliers: { open: 1.5 } });
    expect(program.multipliersMode).toBe("custom");
  });

  it("ceiling mode lets a $1000 pool fund exactly 50 x $20", () => {
    // This is the same cohort the bonus-mode test refuses below: the ceiling
    // preset makes the configured $20 the maximum, so the pool is exactly
    // committed rather than over-subscribed.
    const program = makeProgram({
      poolUsd: 1000,
      baseAllocationUsd: 20,
      multipliersMode: "ceiling",
    });

    const provisioned = programs.provisionParticipants(
      program.id,
      Array.from({ length: 50 }, (_, i) => ({ handle: `ceiling-${i}` })),
    );
    expect(provisioned).toHaveLength(50);

    // Worst case == base total == pool under ceiling multipliers.
    expect(programs.programWorstCaseCommitment(program.id)).toBe(usdToNano(1000));
  });

  it("worst-case commitment uses the highest multiplier", () => {
    const program = makeProgram({ poolUsd: 1000, baseAllocationUsd: 20 });
    programs.provisionParticipants(program.id, [
      { handle: "only-one", disclosureTier: "private" },
    ]);

    // Bonus defaults: open is 2x, so worst case is $40 for one $20 base.
    expect(programs.programWorstCaseCommitment(program.id)).toBe(usdToNano(40));
  });
});

describe("cohort provisioning", () => {
  it("provisions the customer's actual cohort: 50 participants, $20 each, $1000 pool", () => {
    // Uses ceiling multipliers so $20 is the maximum a participant can hold.
    // With the default (base+bonus) multipliers this exact configuration is
    // over-subscribed — see the next test.
    const program = makeProgram({
      poolUsd: 1000,
      baseAllocationUsd: 20,
      disclosureMultipliers: CEILING_DISCLOSURE_MULTIPLIERS,
    });

    const provisioned = programs.provisionParticipants(
      program.id,
      Array.from({ length: 50 }, (_, i) => ({ handle: `participant-${i}` })),
    );

    expect(provisioned).toHaveLength(50);
    expect(new Set(provisioned.map((p) => p.key)).size).toBe(50);
    expect(provisioned.every((p) => p.key.startsWith("cvk_"))).toBe(true);

    // Even if every participant upgrades to `open`, the pool still covers it.
    for (const { participant } of provisioned) {
      programs.setDisclosureTier(participant.id, "open");
    }
    const totals = ledger.programTotals(program.id);
    expect(nanoToUsd(totals.allocatedNano)).toBe(1000);
    expect(totals.allocatedNano).toBeLessThanOrEqual(usdToNano(1000));
  });

  it("refuses a $1000 pool for 50 x $20 under bonus-style multipliers", () => {
    // Guards the sponsor against the tension in "$20 each" + "openness doubles
    // your budget": the honest worst case is $2000, not $1000.
    const program = makeProgram({ poolUsd: 1000, baseAllocationUsd: 20 });

    expect(() =>
      programs.provisionParticipants(
        program.id,
        Array.from({ length: 50 }, (_, i) => ({ handle: `participant-${i}` })),
      ),
    ).toThrow(/highest disclosure multiplier/);
  });

  it("resolves a minted key back to its participant and program", () => {
    const program = makeProgram();
    const [{ participant, key }] = programs.provisionParticipants(program.id, [{ handle: "mallory" }]);

    const resolved = programs.resolveGatewayKey(key);
    expect(resolved?.participant.id).toBe(participant.id);
    expect(resolved?.program.id).toBe(program.id);
  });

  it("refuses unknown, revoked, and malformed keys", () => {
    const program = makeProgram();
    const [{ participant, key }] = programs.provisionParticipants(program.id, [{ handle: "niaj" }]);

    expect(programs.resolveGatewayKey("cvk_totally-made-up-key-value")).toBeNull();
    expect(programs.resolveGatewayKey("")).toBeNull();

    programs.setParticipantStatus(participant.id, "revoked");
    expect(programs.resolveGatewayKey(key)).toBeNull();
  });

  it("invalidates the old key on rotation", () => {
    const program = makeProgram();
    const [{ participant, key: original }] = programs.provisionParticipants(program.id, [
      { handle: "olivia" },
    ]);

    const rotated = programs.rotateKey(participant.id);
    expect(rotated).not.toBe(original);
    expect(programs.resolveGatewayKey(original)).toBeNull();
    expect(programs.resolveGatewayKey(rotated)?.participant.id).toBe(participant.id);
  });

  it("refuses to over-commit the sponsor's pool", () => {
    // $100 pool, $20 base. At the open tier's 2x multiplier each participant
    // could claim $40, so 3 is the most that can be safely committed.
    const program = makeProgram({ poolUsd: 100, baseAllocationUsd: 20 });

    expect(() =>
      programs.provisionParticipants(
        program.id,
        Array.from({ length: 4 }, (_, i) => ({ handle: `over-${i}` })),
      ),
    ).toThrow(/pool/i);
  });

  it("provisions the whole cohort or none of it", () => {
    const program = makeProgram();
    programs.provisionParticipants(program.id, [{ handle: "duplicate" }]);

    // A handle collision mid-batch must not leave the earlier entries behind.
    expect(() =>
      programs.provisionParticipants(program.id, [
        { handle: "fresh-one" },
        { handle: "fresh-two" },
        { handle: "duplicate" },
      ]),
    ).toThrow();

    const handles = programs.listParticipants(program.id).map((p) => p.handle);
    expect(handles).toEqual(["duplicate"]);
  });

  it("rejects duplicate handles inside a single batch", () => {
    const program = makeProgram();
    expect(() =>
      programs.provisionParticipants(program.id, [{ handle: "same" }, { handle: "same" }]),
    ).toThrow(/duplicate/i);
  });
});
