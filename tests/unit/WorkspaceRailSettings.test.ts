import { describe, expect, it } from "vitest";
import {
  isSelectableExecutionRailId,
  isWorkspaceExecutionProviderId,
  normalizeWorkspaceEvidenceSinks,
  workspaceSelectableExecutionRails,
} from "@cognivern/shared";
import { selectEvidenceSinks } from "@backend/services/governance/evidence/index.js";
import type { EvidenceSink } from "@backend/services/governance/evidence/EvidenceSink.js";

describe("workspace rail settings helpers", () => {
  it("lists selectable execution rails with chain ids", () => {
    const rails = workspaceSelectableExecutionRails();
    expect(rails.length).toBeGreaterThan(0);
    expect(rails.every((r) => r.plane === "execution")).toBe(true);
    expect(rails.every((r) => typeof r.chainId === "number")).toBe(true);
    expect(isSelectableExecutionRailId("xlayer-testnet")).toBe(true);
    expect(isSelectableExecutionRailId("canton-devnet")).toBe(false);
    expect(isSelectableExecutionRailId("ethereum-mainnet")).toBe(false);
  });

  it("validates execution providers and evidence sink lists", () => {
    expect(isWorkspaceExecutionProviderId("local")).toBe(true);
    expect(isWorkspaceExecutionProviderId("keeperhub")).toBe(true);
    expect(isWorkspaceExecutionProviderId("nope")).toBe(false);

    expect(normalizeWorkspaceEvidenceSinks(["zerog", "filecoin"])).toEqual([
      "zerog",
      "filecoin",
    ]);
    expect(normalizeWorkspaceEvidenceSinks(["zerog", "zerog", "bad"])).toEqual([
      "zerog",
    ]);
    expect(normalizeWorkspaceEvidenceSinks([])).toBeUndefined();
    expect(normalizeWorkspaceEvidenceSinks(null)).toBeUndefined();
  });
});

describe("selectEvidenceSinks", () => {
  const sinks: EvidenceSink[] = [
    {
      name: "zerog-storage",
      anchor: async () => null,
    },
    {
      name: "filecoin",
      anchor: async () => null,
    },
  ];

  it("returns all sinks when unset or empty", () => {
    expect(selectEvidenceSinks(undefined, sinks)).toEqual(sinks);
    expect(selectEvidenceSinks([], sinks)).toEqual(sinks);
  });

  it("filters by workspace sink ids including zerog alias", () => {
    const onlyZerog = selectEvidenceSinks(["zerog"], sinks);
    expect(onlyZerog.map((s) => s.name)).toEqual(["zerog-storage"]);

    const onlyFilecoin = selectEvidenceSinks(["filecoin"], sinks);
    expect(onlyFilecoin.map((s) => s.name)).toEqual(["filecoin"]);
  });

  it("falls back to available sinks when filter matches nothing", () => {
    expect(selectEvidenceSinks(["unknown"], sinks)).toEqual(sinks);
  });
});
