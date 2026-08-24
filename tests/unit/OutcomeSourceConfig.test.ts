import { describe, expect, it } from "vitest";
import { normalizeOutcomeSources } from "@backend/services/outcomes/outcomeSourceConfig.js";

const METRIC_IDS = ["deliverables", "engagement_rate"];

describe("normalizeOutcomeSources", () => {
  it("returns undefined for absent or empty input", () => {
    expect(normalizeOutcomeSources(undefined, METRIC_IDS)).toBeUndefined();
    expect(normalizeOutcomeSources(null, METRIC_IDS)).toBeUndefined();
    expect(normalizeOutcomeSources([], METRIC_IDS)).toBeUndefined();
  });

  it("accepts a minimal pr-mode source", () => {
    const result = normalizeOutcomeSources(
      [{ type: "github", repo: "owner/name", mode: "pr", metricId: "deliverables" }],
      METRIC_IDS,
    );
    expect(result).toEqual([
      { type: "github", repo: "owner/name", mode: "pr", metricId: "deliverables" },
    ]);
  });

  it("accepts a fully populated commits-mode source", () => {
    const result = normalizeOutcomeSources(
      [
        {
          type: "github",
          repo: "owner/name",
          mode: "commits",
          branch: "main",
          pathFilter: "src/backend",
          since: "2026-08-01T00:00:00Z",
          metricId: "deliverables",
        },
      ],
      METRIC_IDS,
    );
    expect(result).toEqual([
      {
        type: "github",
        repo: "owner/name",
        mode: "commits",
        branch: "main",
        pathFilter: "src/backend",
        since: "2026-08-01T00:00:00.000Z",
        metricId: "deliverables",
      },
    ]);
  });

  it("rejects malformed repos, modes, and source types", () => {
    expect(() =>
      normalizeOutcomeSources([{ type: "github", repo: "no-slash", mode: "pr" }], METRIC_IDS),
    ).toThrow(/owner\/name/);
    expect(() =>
      normalizeOutcomeSources([{ type: "github", repo: "owner/name", mode: "issues" }], METRIC_IDS),
    ).toThrow(/"pr" or "commits"/);
    expect(() =>
      normalizeOutcomeSources([{ type: "gitlab", repo: "owner/name", mode: "pr" }], METRIC_IDS),
    ).toThrow(/only type "github"/);
  });

  it("rejects labels in commits mode and bad since values", () => {
    expect(() =>
      normalizeOutcomeSources(
        [{ type: "github", repo: "owner/name", mode: "commits", labels: ["shipped"] }],
        METRIC_IDS,
      ),
    ).toThrow(/labels.*"pr"/i);
    expect(() =>
      normalizeOutcomeSources(
        [{ type: "github", repo: "owner/name", mode: "pr", since: "not-a-date" }],
        METRIC_IDS,
      ),
    ).toThrow(/since/i);
  });

  it("requires metricId to reference a mandate success metric", () => {
    expect(() =>
      normalizeOutcomeSources(
        [{ type: "github", repo: "owner/name", mode: "pr", metricId: "not-a-metric" }],
        METRIC_IDS,
      ),
    ).toThrow(/successMetrics/);
  });

  it("caps sources at ten", () => {
    const sources = Array.from({ length: 11 }, (_, index) => ({
      type: "github",
      repo: `owner/repo-${index}`,
      mode: "pr",
    }));
    expect(() => normalizeOutcomeSources(sources, METRIC_IDS)).toThrow(/at most 10/);
  });
});
