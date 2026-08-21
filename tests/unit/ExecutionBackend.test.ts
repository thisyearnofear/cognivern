import { describe, expect, it } from "vitest";
import {
  EvmExecutionBackend,
  KeeperHubExecutionBackend,
  resolveExecutionBackend,
  normalizeTxStatus,
} from "@backend/services/blockchain/execution/index.js";

describe("normalizeTxStatus", () => {
  it("marks valid hashes as sent", () => {
    expect(
      normalizeTxStatus(
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ),
    ).toBe("sent");
  });

  it("marks missing hashes as failed unless uncertain/executionId", () => {
    expect(normalizeTxStatus(undefined)).toBe("failed");
    expect(normalizeTxStatus(undefined, { uncertain: true })).toBe("uncertain");
    expect(normalizeTxStatus(undefined, { executionId: "ex-1" })).toBe(
      "uncertain",
    );
  });
});

describe("resolveExecutionBackend", () => {
  it("resolves known providers and defaults unknown to local EVM", () => {
    expect(resolveExecutionBackend("local").name).toBe("local");
    expect(resolveExecutionBackend("keeperhub").name).toBe("keeperhub");
    expect(resolveExecutionBackend("cleanverse").name).toBe("cleanverse");
    expect(resolveExecutionBackend("nope").name).toBe("local");
    expect(resolveExecutionBackend(undefined).name).toBe("local");
  });
});

describe("EvmExecutionBackend", () => {
  it("maps vault success and failure into ExecutionTransferResult", async () => {
    const defaultRail = {
      railId: "xlayer-testnet",
      chainId: 1952,
      rpcUrl: "https://example.invalid",
      gasLimits: { nativeTransfer: 21000 },
    } as any;
    const ok = new EvmExecutionBackend(defaultRail, {
      sendNativeTransfer: async () => ({
        txHash:
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        from: "0x1111111111111111111111111111111111111111",
      }),
    } as any);
    const sent = await ok.transfer({
      intentId: "i1",
      walletId: "w1",
      fromAddress: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      amountWei: 1n,
      chainId: 1952,
      idempotencyKey: "i1",
    });
    expect(sent.status).toBe("sent");
    expect(sent.backend).toBe("local");
    expect(sent.railId).toBe("xlayer-testnet");
    expect(sent.explorerUrl).toContain("oklink.com/xlayer-test/tx/");

    const fail = new EvmExecutionBackend(defaultRail, {
      sendNativeTransfer: async () => ({ error: "no funds" }),
    } as any);
    const failed = await fail.transfer({
      intentId: "i2",
      walletId: "w1",
      fromAddress: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      amountWei: 1n,
      chainId: 1952,
      idempotencyKey: "i2",
    });
    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("no funds");
  });

  it("routes native transfer RPC by request chainId (second EVM rail)", async () => {
    const defaultRail = {
      railId: "xlayer-testnet",
      chainId: 1952,
      rpcUrl: "https://xlayer.invalid",
      gasLimits: { nativeTransfer: 21000 },
    } as any;
    const mantleRail = {
      railId: "mantle-sepolia",
      chainId: 5003,
      rpcUrl: "https://mantle.invalid",
      gasLimits: { nativeTransfer: 25000 },
    } as any;
    let seenRpc: string | undefined;
    let seenGas: number | undefined;
    const backend = new EvmExecutionBackend(
      defaultRail,
      {
        sendNativeTransfer: async (params) => {
          seenRpc = params.rpcUrl;
          seenGas = params.gasLimit;
          return {
            txHash:
              "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
            from: "0x1111111111111111111111111111111111111111",
          };
        },
      } as any,
      (id) => (id === 5003 || id === "mantle-sepolia" ? mantleRail : defaultRail),
    );

    const result = await backend.transfer({
      intentId: "i-mantle",
      walletId: "w1",
      fromAddress: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      amountWei: 1n,
      chainId: 5003,
      idempotencyKey: "i-mantle",
    });
    expect(seenRpc).toBe("https://mantle.invalid");
    expect(seenGas).toBe(25000);
    expect(result.railId).toBe("mantle-sepolia");
    expect(result.explorerUrl).toContain("sepolia.mantlescan.xyz");
  });
});

describe("KeeperHubExecutionBackend", () => {
  it("wraps provider success and error shapes", async () => {
    const backend = new KeeperHubExecutionBackend({
      executeTransfer: async () => ({
        txHash:
          "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        transactionHash:
          "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        executionId: "ex-9",
        chainId: 1952,
        recipientMatches: true,
        valueMatches: true,
        verified: true,
        receiptStatus: "success",
        simulation: {
          status: "simulated",
          success: true,
          wouldRevert: false,
        },
      }),
    } as any);

    const sent = await backend.transfer({
      intentId: "i3",
      walletId: "w1",
      fromAddress: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      amountWei: 5n,
      chainId: 1952,
      idempotencyKey: "i3",
    });
    expect(sent.status).toBe("sent");
    expect(sent.executionId).toBe("ex-9");
    expect(sent.recipientMatches).toBe(true);

    const errBackend = new KeeperHubExecutionBackend({
      executeTransfer: async () => ({ error: "down", uncertain: true }),
    } as any);
    const failed = await errBackend.transfer({
      intentId: "i4",
      walletId: "w1",
      fromAddress: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      amountWei: 5n,
      chainId: 1952,
      idempotencyKey: "i4",
    });
    expect(failed.status).toBe("uncertain");
    expect(failed.error).toBe("down");
  });
});
