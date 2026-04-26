import test from "node:test";
import assert from "node:assert/strict";

const { FhenixPolicyService } = await import(
  "../../src/services/FhenixPolicyService.js"
);

test("FhenixPolicyService.evaluateEncrypted uses fallback when client is absent", async () => {
  const svc = new FhenixPolicyService({
    rpcUrl: "",
    contractAddress: "",
  });

  const decision = await svc.evaluateEncrypted({
    agentId: "agent-1",
    policyId: "policy-1",
    amountWei: 100n,
    vendorHash: "0x01",
  });

  assert.equal(decision.outcome, "deny");
  assert.ok(decision.decisionId.startsWith("0x"));
});

test("FhenixPolicyService.evaluateEncrypted normalizes adapter outputs", async () => {
  const svc = new FhenixPolicyService({
    rpcUrl: "http://localhost:8545",
    contractAddress: "0xabc",
    client: {
      encryptUint256: async () => "0xdead",
      evaluateSpend: async () => ({
        decisionId: "0x1234",
        outcome: 1,
        attestation: "0xbeef",
      }),
    },
  });

  const decision = await svc.evaluateEncrypted({
    agentId: "agent-1",
    policyId: "policy-1",
    amountWei: 50n,
    vendorHash: "0x02",
  });

  assert.equal(decision.outcome, "hold");
  assert.equal(decision.decisionId, "0x1234");
  assert.equal(decision.attestation, "0xbeef");
});

test("FhenixPolicyService.evaluateEncrypted fails on timeout", async () => {
  const svc = new FhenixPolicyService({
    rpcUrl: "http://localhost:8545",
    contractAddress: "0xabc",
    evaluateTimeoutMs: 10,
    client: {
      encryptUint256: async () =>
        await new Promise<string>(() => {
          // intentionally unresolved
        }),
      evaluateSpend: async () => ({
        decisionId: "0x0",
        outcome: "deny",
      }),
    },
  });

  await assert.rejects(
    svc.evaluateEncrypted({
      agentId: "agent-1",
      policyId: "policy-1",
      amountWei: 1n,
      vendorHash: "0x03",
    }),
    /timed out/i,
  );
});
