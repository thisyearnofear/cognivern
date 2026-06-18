import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Coverage for the native value-transfer slice of the spend path.
 *
 * These tests drive the REAL (unmocked) OwsWalletService + OwsLocalVaultService
 * against an isolated temp vault, and only stub the actual broadcast
 * (sendNativeTransfer) so no RPC is hit. The governance recordOnChainApproval
 * short-circuits to success:false when no XLAYER key is configured, so it never
 * touches the network either.
 *
 * The invariants under test:
 *   - an approved spend broadcasts the native transfer with the parsed wei value
 *   - a FAILED broadcast is never reported as moved money (transferTxHash stays
 *     undefined, transferStatus "failed", decision still "approved")
 *   - a non-positive amount is held, not broadcast
 *   - resumeHeldSpend broadcasts under operatorApproved=true
 *   - resumeHeldSpend refuses runs that are not paused spend runs (no broadcast)
 */

const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const RECIPIENT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

let tmpDir: string;
const savedEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ows-transfer-test-"));
  process.env.OWS_VAULT_PATH = path.join(tmpDir, "ows-vault.json");
  process.env.OWS_VAULT_SECRET = "test-vault-secret-native-transfer";
  process.env.CRE_RUNS_FILE = path.join(tmpDir, "cre-runs.jsonl");
  // Keep the whole test offline. These are set (to "") BEFORE the modules are
  // dynamically imported, so dotenv (which never overrides an already-set var)
  // cannot repopulate them from .env:
  //   - MONGODB_URI="" → JSONL-only run store + no Mongo policy persistence
  //   - XLAYER_PRIVATE_KEY="" → blockchainConfig.privateKey="" so the
  //     governance recordOnChainApproval short-circuits (no real broadcast)
  for (const key of ["MONGODB_URI", "XLAYER_PRIVATE_KEY"]) {
    savedEnv[key] = process.env[key];
    process.env[key] = "";
  }
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.OWS_VAULT_PATH;
  delete process.env.OWS_VAULT_SECRET;
  delete process.env.CRE_RUNS_FILE;
  for (const [key, val] of Object.entries(savedEnv)) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
});

function resetVaultFile() {
  fs.writeFileSync(
    process.env.OWS_VAULT_PATH!,
    JSON.stringify({ version: 1, wallets: [], apiKeys: [], agents: [] }),
  );
}

async function loadModules() {
  const { OwsWalletService } = await import(
    "../../src/backend/services/blockchain/OwsWalletService.js"
  );
  const { owsLocalVaultService } = await import(
    "../../src/backend/services/blockchain/OwsLocalVaultService.js"
  );
  const { creRunStore } = await import(
    "../../src/backend/cre/storage/CreRunStore.js"
  );
  return { OwsWalletService, owsLocalVaultService, creRunStore };
}

async function seedScopedAccess(owsLocalVaultService: any) {
  const wallet = await owsLocalVaultService.importWallet({
    name: "Treasury",
    privateKey: TEST_PRIVATE_KEY,
  });
  const { token } = await owsLocalVaultService.createApiKey({
    name: "scoped",
    walletIds: [wallet.id],
    policyIds: [],
  });
  const access = await owsLocalVaultService.resolveAccess({
    apiKeyToken: token,
  });
  return { wallet, token, access };
}

describe("OwsWalletService — native transfer on approve", () => {
  beforeEach(async () => {
    resetVaultFile();
    const { creRunStore } = await loadModules();
    await creRunStore.reset();
    vi.restoreAllMocks();
  });

  it("broadcasts the native transfer with the parsed wei value and recipient", async () => {
    const { OwsWalletService, owsLocalVaultService } = await loadModules();
    const { token, access } = await seedScopedAccess(owsLocalVaultService);

    const sendSpy = vi
      .spyOn(owsLocalVaultService, "sendNativeTransfer")
      .mockResolvedValue({ txHash: "0xfeedface", from: access!.wallet.accounts[0]?.address });

    const service = new OwsWalletService();
    const intent = {
      id: "intent-1",
      agentId: "agent-1",
      recipient: RECIPIENT,
      amount: "1000",
      asset: "OKB",
      reason: "test transfer",
      timestamp: new Date().toISOString(),
    };

    const result = await (service as any).handleApprove(
      intent,
      new (await import("../../src/backend/cre/runRecorder.js")).CreRunRecorder({
        workflow: "spend",
        mode: "cre",
      }),
      "policy-1",
      access,
      token,
    );

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const callArg = sendSpy.mock.calls[0][0];
    expect(callArg.valueWei).toBe(1000n);
    expect(callArg.to).toBe(RECIPIENT);
    expect(callArg.operatorApproved).toBe(false);
    expect(result.status).toBe("approved");
    expect(result.transferStatus).toBe("sent");
    expect(result.transferTxHash).toBe("0xfeedface");
  });

  it("does NOT fabricate a txHash when the broadcast fails", async () => {
    const { OwsWalletService, owsLocalVaultService } = await loadModules();
    const { token, access } = await seedScopedAccess(owsLocalVaultService);

    vi.spyOn(owsLocalVaultService, "sendNativeTransfer").mockResolvedValue({
      error: "insufficient funds",
    });

    const service = new OwsWalletService();
    const intent = {
      id: "intent-2",
      agentId: "agent-1",
      recipient: RECIPIENT,
      amount: "5000",
      asset: "OKB",
      reason: "test failed transfer",
      timestamp: new Date().toISOString(),
    };

    const { CreRunRecorder } = await import(
      "../../src/backend/cre/runRecorder.js"
    );
    const result = await (service as any).handleApprove(
      intent,
      new CreRunRecorder({ workflow: "spend", mode: "cre" }),
      "policy-1",
      access,
      token,
    );

    // Policy approved, but the transfer failed — a PARTIAL success, never
    // reported as moved money.
    expect(result.status).toBe("approved");
    expect(result.transferStatus).toBe("failed");
    expect(result.transferTxHash).toBeUndefined();
    expect(result.transferError).toBe("insufficient funds");
  });

  it("holds (does not broadcast) a non-positive amount", async () => {
    const { OwsWalletService, owsLocalVaultService } = await loadModules();
    const { token, access } = await seedScopedAccess(owsLocalVaultService);

    const sendSpy = vi.spyOn(owsLocalVaultService, "sendNativeTransfer");

    const service = new OwsWalletService();
    const intent = {
      id: "intent-3",
      agentId: "agent-1",
      recipient: RECIPIENT,
      amount: "0",
      asset: "OKB",
      reason: "zero amount",
      timestamp: new Date().toISOString(),
    };

    const { CreRunRecorder } = await import(
      "../../src/backend/cre/runRecorder.js"
    );
    const result = await (service as any).handleApprove(
      intent,
      new CreRunRecorder({ workflow: "spend", mode: "cre" }),
      "policy-1",
      access,
      token,
    );

    expect(result.status).toBe("held");
    expect(sendSpy).not.toHaveBeenCalled();
  });
});

describe("OwsWalletService — resumeHeldSpend (operator approval)", () => {
  beforeEach(async () => {
    resetVaultFile();
    const { creRunStore } = await loadModules();
    await creRunStore.reset();
    vi.restoreAllMocks();
  });

  it("broadcasts under operatorApproved=true for a paused spend run", async () => {
    const { OwsWalletService, owsLocalVaultService } = await loadModules();
    const { access } = await seedScopedAccess(owsLocalVaultService);

    const sendSpy = vi
      .spyOn(owsLocalVaultService, "sendNativeTransfer")
      .mockResolvedValue({ txHash: "0xresumed", from: access!.wallet.accounts[0]?.address });

    const service = new OwsWalletService();
    const intent = {
      id: "intent-held",
      agentId: "agent-1",
      recipient: RECIPIENT,
      amount: "2500",
      asset: "OKB",
      reason: "held spend",
      timestamp: new Date().toISOString(),
    };

    const { CreRunRecorder } = await import(
      "../../src/backend/cre/runRecorder.js"
    );
    // Persist a held run carrying the spend_intent + walletId. executeSpend
    // adds the spend_intent artifact before any handle* call, so mirror that.
    const heldRecorder = new CreRunRecorder({ workflow: "spend", mode: "cre" });
    await heldRecorder.addArtifact({ type: "spend_intent", data: intent });
    const held = await (service as any).handleHold(
      intent,
      heldRecorder,
      "needs review",
      "policy-1",
      access,
    );
    expect(held.status).toBe("held");

    const result = await service.resumeHeldSpend(held.runId, "operator-42");

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const callArg = sendSpy.mock.calls[0][0];
    expect(callArg.operatorApproved).toBe(true);
    expect(callArg.valueWei).toBe(2500n);
    expect(callArg.to).toBe(RECIPIENT);
    expect(result.status).toBe("approved");
    expect(result.transferStatus).toBe("sent");
    expect(result.transferTxHash).toBe("0xresumed");
  });

  it("refuses to broadcast for an unknown run", async () => {
    const { OwsWalletService, owsLocalVaultService } = await loadModules();
    const sendSpy = vi.spyOn(owsLocalVaultService, "sendNativeTransfer");

    const service = new OwsWalletService();
    const result = await service.resumeHeldSpend("no-such-run", "operator-42");

    expect(result.status).toBe("denied");
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("surfaces a failed transfer as a failed resume (not moved money)", async () => {
    const { OwsWalletService, owsLocalVaultService } = await loadModules();
    const { access } = await seedScopedAccess(owsLocalVaultService);

    vi.spyOn(owsLocalVaultService, "sendNativeTransfer").mockResolvedValue({
      error: "rpc unreachable",
    });

    const service = new OwsWalletService();
    const intent = {
      id: "intent-held-2",
      agentId: "agent-1",
      recipient: RECIPIENT,
      amount: "777",
      asset: "OKB",
      reason: "held spend",
      timestamp: new Date().toISOString(),
    };

    const { CreRunRecorder } = await import(
      "../../src/backend/cre/runRecorder.js"
    );
    const heldRecorder = new CreRunRecorder({ workflow: "spend", mode: "cre" });
    await heldRecorder.addArtifact({ type: "spend_intent", data: intent });
    const held = await (service as any).handleHold(
      intent,
      heldRecorder,
      "needs review",
      "policy-1",
      access,
    );

    const result = await service.resumeHeldSpend(held.runId, "operator-42");
    expect(result.transferStatus).toBe("failed");
    expect(result.transferTxHash).toBeUndefined();
    expect(result.transferError).toBe("rpc unreachable");

    // After failure, the held run must roll back to paused_for_approval so a
    // retry can re-enter the broadcast path.
    const { creRunStore } = await loadModules();
    const restored = await creRunStore.get(held.runId);
    expect(restored?.status).toBe("paused_for_approval");
  });

  it("claims the held run before broadcast: concurrent resume → only one broadcast", async () => {
    const { OwsWalletService, owsLocalVaultService } = await loadModules();
    const { access } = await seedScopedAccess(owsLocalVaultService);

    // Make the mock yield so the second resume call can interleave between
    // the claim-write (in-process) and the broadcast.
    let broadcasts = 0;
    const sendSpy = vi
      .spyOn(owsLocalVaultService, "sendNativeTransfer")
      .mockImplementation(async () => {
        broadcasts++;
        await new Promise((r) => setTimeout(r, 20));
        return { txHash: `0xrace-${broadcasts}`, from: access!.wallet.accounts[0]?.address };
      });

    const service = new OwsWalletService();
    const intent = {
      id: "intent-race",
      agentId: "agent-1",
      recipient: RECIPIENT,
      amount: "1234",
      asset: "OKB",
      reason: "race",
      timestamp: new Date().toISOString(),
    };

    const { CreRunRecorder } = await import(
      "../../src/backend/cre/runRecorder.js"
    );
    const heldRecorder = new CreRunRecorder({ workflow: "spend", mode: "cre" });
    await heldRecorder.addArtifact({ type: "spend_intent", data: intent });
    const held = await (service as any).handleHold(
      intent,
      heldRecorder,
      "needs review",
      "policy-1",
      access,
    );

    // Fire two resumes in parallel against the same held run.
    const [r1, r2] = await Promise.all([
      service.resumeHeldSpend(held.runId, "operator-A"),
      service.resumeHeldSpend(held.runId, "operator-B"),
    ]);

    // Exactly one broadcast; the other call is denied by the claim.
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual(["approved", "denied"]);
    const denied = r1.status === "denied" ? r1 : r2;
    expect(denied.error).toMatch(/not awaiting approval/);
  });
});
