import { describe, expect, it, vi } from "vitest";
import {
  DynamicExecutionBackend,
  classifyDynamicTransferError,
} from "@backend/services/blockchain/execution/DynamicExecutionBackend.js";
import { resolveExecutionBackend } from "@backend/services/blockchain/execution/index.js";

describe("resolveExecutionBackend(dynamic)", () => {
  it("resolves the dynamic backend", () => {
    expect(resolveExecutionBackend("dynamic").name).toBe("dynamic");
  });
});

describe("classifyDynamicTransferError", () => {
  it("maps missing metadata and wrong chain to failed (not uncertain)", () => {
    expect(
      classifyDynamicTransferError(
        "Dynamic walletMetadata is missing. Run provision.",
      ),
    ).toMatchObject({ status: "failed", code: "missing_metadata" });
    expect(
      classifyDynamicTransferError(
        "No configured execution rail for chain 999999.",
      ),
    ).toMatchObject({ status: "failed", code: "wrong_chain" });
    expect(
      classifyDynamicTransferError("RPC timed out talking to the node"),
    ).toMatchObject({ status: "uncertain", code: "network" });
  });
});

describe("DynamicExecutionBackend", () => {
  it("maps a successful sendTransaction to sent", async () => {
    const getClient = vi.fn(async () => ({
      walletClient: {
        sendTransaction: async () =>
          "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as `0x${string}`,
      },
      accountAddress: "0x1111111111111111111111111111111111111111",
      railId: "xlayer-testnet",
      chainId: 1952,
      rpcUrl: "https://example.invalid",
    }));

    const backend = new DynamicExecutionBackend(getClient as any, 1952);
    const result = await backend.transfer({
      intentId: "i-dyn",
      walletId: "w1",
      fromAddress: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      amountWei: 1n,
      chainId: 1952,
      idempotencyKey: "i-dyn",
      metadata: {
        dynamicAccountAddress: "0x1111111111111111111111111111111111111111",
      },
    });

    expect(result.status).toBe("sent");
    expect(result.backend).toBe("dynamic");
    expect(result.txHash).toMatch(/^0xcc/);
    expect(result.from).toBe("0x1111111111111111111111111111111111111111");
    expect(getClient).toHaveBeenCalledOnce();
  });

  it("fails closed on missing metadata without marking uncertain", async () => {
    const backend = new DynamicExecutionBackend(async () => {
      throw new Error(
        "Dynamic walletMetadata is missing. Run `pnpm dynamic:provision`.",
      );
    }, 1952);
    const result = await backend.transfer({
      intentId: "i-meta",
      walletId: "w1",
      fromAddress: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      amountWei: 1n,
      chainId: 1952,
      idempotencyKey: "i-meta",
    });
    expect(result.status).toBe("failed");
    expect(result.uncertain).toBe(false);
    expect(result.error).toMatch(/\[dynamic:missing_metadata\]/);
  });

  it("fails closed on wrong / unconfigured chain", async () => {
    const backend = new DynamicExecutionBackend(async () => {
      throw new Error(
        "No configured execution rail for chain 999001. Pick a wallet chainId that matches a Cognivern rail.",
      );
    }, 1952);
    const result = await backend.transfer({
      intentId: "i-chain",
      walletId: "w1",
      fromAddress: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      amountWei: 1n,
      chainId: 999001,
      idempotencyKey: "i-chain",
    });
    expect(result.status).toBe("failed");
    expect(result.uncertain).toBe(false);
    expect(result.error).toMatch(/\[dynamic:wrong_chain\]/);
  });

  it("rejects non-positive chainId before calling the client", async () => {
    const getClient = vi.fn();
    const backend = new DynamicExecutionBackend(getClient as any, 1952);
    const result = await backend.transfer({
      intentId: "i-bad-chain",
      walletId: "w1",
      fromAddress: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      amountWei: 1n,
      chainId: 0,
      idempotencyKey: "i-bad-chain",
    });
    expect(getClient).not.toHaveBeenCalled();
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/\[dynamic:wrong_chain\]/);
  });

  it("maps network timeouts to uncertain for reconciliation", async () => {
    const hang = new DynamicExecutionBackend(async () => {
      throw new Error("RPC timed out");
    }, 1952);
    const uncertain = await hang.transfer({
      intentId: "i-hang",
      walletId: "w1",
      fromAddress: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      amountWei: 1n,
      chainId: 1952,
      idempotencyKey: "i-hang",
    });
    expect(uncertain.status).toBe("uncertain");
    expect(uncertain.uncertain).toBe(true);
    expect(uncertain.error).toMatch(/\[dynamic:network\]/);
  });
});
