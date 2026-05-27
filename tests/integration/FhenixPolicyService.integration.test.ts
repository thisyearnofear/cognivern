import { describe, it, expect } from "vitest";

const { FhenixPolicyService } = await import(
  "../../src/backend/services/FhenixPolicyService.js"
);

describe("FhenixPolicyService", () => {
  it("evaluateEncrypted uses fallback when client is absent", async () => {
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

    expect(decision.outcome).toBe("deny");
    expect(decision.decisionId.startsWith("0x")).toBeTruthy();
  });

  it("evaluateEncrypted normalizes adapter outputs", async () => {
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

    expect(decision.outcome).toBe("hold");
    expect(decision.decisionId).toBe("0x1234");
    expect(decision.attestation).toBe("0xbeef");
  });

  it("evaluateEncrypted fails on timeout", async () => {
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

    await expect(
      svc.evaluateEncrypted({
        agentId: "agent-1",
        policyId: "policy-1",
        amountWei: 1n,
        vendorHash: "0x03",
      }),
    ).rejects.toThrow(/timed out/i);
  });
});
