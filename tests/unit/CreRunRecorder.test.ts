import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ethers } from "ethers";

// Well-known throwaway dev key (hardhat account #1) — never used on a real network.
const TEST_PK =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // pragma: allowlist secret
const TEST_ADDRESS = new ethers.Wallet(TEST_PK).address;

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  delete process.env.EVIDENCE_SIGNING_KEY;
  delete process.env.FILECOIN_PRIVATE_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

async function freshRecorder(params?: { signer?: ethers.Signer }) {
  const { CreRunRecorder } = await import("@backend/cre/runRecorder.js");
  return new CreRunRecorder({
    workflow: "spend",
    mode: "local",
    signer: params?.signer,
  });
}

describe("CreRunRecorder evidence", () => {
  it("always hashes artifact and run evidence even without a signer", async () => {
    const recorder = await freshRecorder();
    const artifact = await recorder.addArtifact({
      type: "spend_intent",
      data: { amount: "1" },
    });
    await recorder.finish(true);
    const run = recorder.getRun();

    expect(artifact.evidence?.hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(artifact.evidence?.signature).toBeUndefined();
    expect(run.evidence?.hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(run.evidence?.signature).toBeUndefined();
  });

  it("signs evidence with an explicitly injected signer", async () => {
    const wallet = new ethers.Wallet(TEST_PK);
    const recorder = await freshRecorder({ signer: wallet });
    const artifact = await recorder.addArtifact({
      type: "spend_intent",
      data: { amount: "1" },
    });
    await recorder.finish(true);
    const run = recorder.getRun();

    expect(artifact.evidence?.signer).toBe(TEST_ADDRESS);
    expect(run.evidence?.signer).toBe(TEST_ADDRESS);
    // The signature must actually recover to the signer — evidence is
    // verifiable, not a self-reported claim.
    const recovered = ethers.verifyMessage(
      run.evidence!.hash,
      run.evidence!.signature!,
    );
    expect(recovered).toBe(TEST_ADDRESS);
  });

  it("uses EVIDENCE_SIGNING_KEY as the default signer when none is injected", async () => {
    process.env.EVIDENCE_SIGNING_KEY = TEST_PK;
    const recorder = await freshRecorder();
    await recorder.finish(true);
    const run = recorder.getRun();

    expect(run.evidence?.signer).toBe(TEST_ADDRESS);
    expect(run.evidence?.signature).toBeDefined();
  });

  it("signs paused_for_approval evidence too", async () => {
    const wallet = new ethers.Wallet(TEST_PK);
    const recorder = await freshRecorder({ signer: wallet });
    await recorder.pauseForApproval("amount above auto-approve threshold");
    const run = recorder.getRun();

    expect(run.status).toBe("paused_for_approval");
    expect(run.evidence?.hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(run.evidence?.signer).toBe(TEST_ADDRESS);
  });
});
