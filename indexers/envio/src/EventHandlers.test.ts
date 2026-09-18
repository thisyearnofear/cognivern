/**
 * Handler tests via envio's in-memory test indexer — exercises the real
 * handler registrations over simulated events, no chain or Postgres needed.
 * Run: `pnpm codegen && pnpm test`.
 */
import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

const AUSDC = "0xac0893567d43c3e7e6e35a72803df05416c1f20d" as const;
// Chain 143 uses the mainnet reference registries; 10143 the testnet ones.
const IDENTITY_M = "0x8004a169fb4a3325136eb29fa0ceb6d2e539a432" as const;
const REPUTATION_M = "0x8004baa17c55a88189ae136b182e5fda19de9b63" as const;

const testIndexer = createTestIndexer();

describe("EventHandlers", () => {
  it("records aUSDC transfers as settlement rows", async () => {
    const { changes } = await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "AUsdcSettlement",
              event: "Transfer",
              srcAddress: AUSDC,
              params: {
                from: "0x1111111111111111111111111111111111111111",
                to: "0x2222222222222222222222222222222222222222",
                value: 5_000_000n,
              },
              transaction: { hash: "0xsettle1" as `0x${string}` },
              block: { number: 100, timestamp: 1700000000 },
            },
          ],
        },
      },
    });
    expect(changes.length).toBeGreaterThan(0);
    const row = await testIndexer.SettlementTransfer.get(
      "10143-0xsettle1-0",
    );
    expect(row).toBeTruthy();
    expect(row?.value).toBe(5_000_000n);
    expect(row?.chainId).toBe(10143);
  });

  it("records ERC-721 mints as registrations, skips later transfers", async () => {
    await testIndexer.process({
      chains: {
        143: {
          simulate: [
            {
              contract: "Erc8004Identity",
              event: "Transfer",
              srcAddress: IDENTITY_M,
              params: {
                from: "0x0000000000000000000000000000000000000000",
                to: "0x3333333333333333333333333333333333333333",
                tokenId: 42n,
              },
              transaction: { hash: "0xmint1" as `0x${string}` },
              block: { number: 200, timestamp: 1700000100 },
            },
            {
              contract: "Erc8004Identity",
              event: "Transfer",
              srcAddress: IDENTITY_M,
              // Non-mint transfer — must not create a registration row.
              params: {
                from: "0x3333333333333333333333333333333333333333",
                to: "0x4444444444444444444444444444444444444444",
                tokenId: 42n,
              },
              transaction: { hash: "0xmove1" as `0x${string}` },
              block: { number: 201, timestamp: 1700000200 },
            },
          ],
        },
      },
    });
    const mint = await testIndexer.AgentRegistration.get("143-0xmint1-0");
    expect(mint).toBeTruthy();
    expect(mint?.agentId).toBe(42n);
    const move = await testIndexer.AgentRegistration.get("143-0xmove1-1");
    expect(move).toBeUndefined();
  });

  it("records feedback and marks it revoked on FeedbackRevoked", async () => {
    await testIndexer.process({
      chains: {
        143: {
          simulate: [
            {
              contract: "Erc8004Reputation",
              event: "NewFeedback",
              srcAddress: REPUTATION_M,
              params: {
                agentId: 42n,
                clientAddress:
                  "0x5555555555555555555555555555555555555555",
                feedbackIndex: 1n,
                value: 90n,
                valueDecimals: 0n,
                indexedTag1: "quality",
                tag1: "quality",
                tag2: "",
                endpoint: "",
                feedbackURI: "",
                feedbackHash:
                  "0x0000000000000000000000000000000000000000000000000000000000000000",
              },
              transaction: { hash: "0xfb1" as `0x${string}` },
              block: { number: 300, timestamp: 1700000300 },
            },
            {
              contract: "Erc8004Reputation",
              event: "FeedbackRevoked",
              srcAddress: REPUTATION_M,
              params: {
                agentId: 42n,
                clientAddress:
                  "0x5555555555555555555555555555555555555555",
                feedbackIndex: 1n,
              },
              transaction: { hash: "0xrev1" as `0x${string}` },
              block: { number: 301, timestamp: 1700000400 },
            },
          ],
        },
      },
    });
    const fb = await testIndexer.AgentFeedback.get(
      "143-42-0x5555555555555555555555555555555555555555-1",
    );
    expect(fb).toBeTruthy();
    expect(fb?.value).toBe(90n);
    expect(fb?.revoked).toBe(true);
  });
});
