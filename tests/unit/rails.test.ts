import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXECUTION_RAIL_ID,
  defaultExecutionRail,
  executionRailIdForChainId,
  explorerTxUrl,
  formatEvidenceAnchorLine,
  getRailByChainId,
  getRailById,
} from "@cognivern/shared";

describe("rail registry", () => {
  it("maps X Layer testnet and mainnet to the correct explorers", () => {
    const testnet = getRailByChainId(1952);
    const mainnet = getRailByChainId(196);
    expect(testnet?.id).toBe("xlayer-testnet");
    expect(mainnet?.id).toBe("xlayer-mainnet");

    const hash = "0xabc123";
    expect(explorerTxUrl(1952, hash)).toBe(
      "https://www.oklink.com/xlayer-test/tx/0xabc123",
    );
    // Regression: mainnet must not use the testnet explorer path.
    expect(explorerTxUrl(196, hash)).toBe(
      "https://www.oklink.com/xlayer/tx/0xabc123",
    );
    expect(explorerTxUrl(196, hash)).not.toContain("xlayer-test");
  });

  it("defaults execution rail to xlayer-testnet", () => {
    expect(defaultExecutionRail().id).toBe(DEFAULT_EXECUTION_RAIL_ID);
    expect(executionRailIdForChainId(1952)).toBe("xlayer-testnet");
    expect(executionRailIdForChainId(196)).toBe("xlayer-mainnet");
  });

  it("formats evidence copy from rail display names", () => {
    expect(formatEvidenceAnchorLine()).toContain("0G");
    expect(formatEvidenceAnchorLine()).toContain(
      getRailById(DEFAULT_EXECUTION_RAIL_ID)?.displayName,
    );
    expect(formatEvidenceAnchorLine()).not.toBe("Immutable on 0G + X Layer");
  });

  it("resolves Arbitrum Sepolia explorers", () => {
    expect(explorerTxUrl(421614, "0xdead")).toBe(
      "https://sepolia.arbiscan.io/tx/0xdead",
    );
  });
});
