import { describe, expect, it, vi } from "vitest";
import { DynamicExecutionBackend } from "@backend/services/blockchain/execution/DynamicExecutionBackend.js";
import { resolveExecutionBackend } from "@backend/services/blockchain/execution/index.js";

describe("resolveExecutionBackend(dynamic)", () => {
  it("resolves the dynamic backend", () => {
    expect(resolveExecutionBackend("dynamic").name).toBe("dynamic");
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

  it("maps thrown errors to failed (or uncertain on timeout)", async () => {
    const fail = new DynamicExecutionBackend(async () => {
      throw new Error("insufficient funds");
    }, 1952);
    const failed = await fail.transfer({
      intentId: "i-fail",
      walletId: "w1",
      fromAddress: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      amountWei: 1n,
      chainId: 1952,
      idempotencyKey: "i-fail",
    });
    expect(failed.status).toBe("failed");
    expect(failed.error).toMatch(/insufficient funds/);

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
  });
});
