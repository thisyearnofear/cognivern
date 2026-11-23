import { describe, expect, it } from "vitest";
import fixture from "./fixtures/diligence-report.sample.json";
import {
  caseHeadline,
  isValidReportId,
  parsePublicDiligenceReport,
  whyLabel,
  type PublicCase,
} from "@/lib/diligence-report";

const report = parsePublicDiligenceReport(fixture);
if (!report) throw new Error("fixture must parse");
const cases = report.cases;
const byId = (id: string): PublicCase => {
  const found = cases.find((c) => c.id === id);
  if (!found) throw new Error(`fixture missing ${id}`);
  return found;
};

describe("isValidReportId", () => {
  it("accepts the expected shape", () => {
    expect(isValidReportId("supplier-diligence")).toBe(true);
    expect(isValidReportId("a")).toBe(true);
    expect(isValidReportId("x9-abc")).toBe(true);
  });
  it("rejects bad ids", () => {
    expect(isValidReportId("")).toBe(false);
    expect(isValidReportId("-leading")).toBe(false);
    expect(isValidReportId("UPPER")).toBe(false);
    expect(isValidReportId("has space")).toBe(false);
    expect(isValidReportId("../traversal")).toBe(false);
    expect(isValidReportId("x".repeat(65))).toBe(false);
  });
});

describe("parsePublicDiligenceReport", () => {
  it("accepts the shipped-shape fixture", () => {
    expect(report.id).toBe("test-fixture");
    expect(report.cases.map((c) => c.id)).toEqual([
      "listed-entity",
      "registered-clear",
      "unregistered-supplier",
      "individual-name-match",
    ]);
  });
  it("rejects a wrong schema string", () => {
    expect(
      parsePublicDiligenceReport({ ...fixture, schema: "other" }),
    ).toBeNull();
  });
  it("rejects non-object garbage", () => {
    expect(parsePublicDiligenceReport(null)).toBeNull();
    expect(parsePublicDiligenceReport("nope")).toBeNull();
    expect(parsePublicDiligenceReport(42)).toBeNull();
  });
  it("rejects a case with an invalid decision", () => {
    const bad = structuredClone(fixture) as Record<string, unknown>;
    (bad.cases as Record<string, unknown>[])[0].expectedDecision = "maybe";
    expect(parsePublicDiligenceReport(bad)).toBeNull();
  });
  it("rejects a report without a cases array", () => {
    const bad = { ...fixture, cases: "not-an-array" };
    expect(parsePublicDiligenceReport(bad)).toBeNull();
  });
});

describe("caseHeadline", () => {
  it("renders alone + governed + cost for a decided model", () => {
    expect(caseHeadline(byId("listed-entity"), "model-a")).toBe(
      "Alone: proceed. Governed: reject. Specialist cost: $0.01.",
    );
  });
  it("says so when the model alone produced no usable answer", () => {
    expect(caseHeadline(byId("unregistered-supplier"), "model-b")).toBe(
      "Alone: no usable answer. Governed: hold. Specialist cost: $0.01.",
    );
  });
  it("omits the alone clause when the label is missing", () => {
    expect(caseHeadline(byId("listed-entity"), "nope")).toBe(
      "Specialist cost: $0.01.",
    );
  });
});

describe("whyLabel", () => {
  it("returns the model-decision label when the gate is null", () => {
    expect(whyLabel(null)).toBe(
      "The model decided with the purchased evidence",
    );
  });
  it("maps each gate reason to plain words", () => {
    expect(whyLabel(byId("listed-entity").gate)).toBe(
      "Sanctions screen returned a hit",
    );
    expect(whyLabel(byId("unregistered-supplier").gate)).toBe(
      "Purchased evidence was low-confidence",
    );
    expect(whyLabel(byId("individual-name-match").gate)).toBe(
      "Screener asked for human review",
    );
    expect(
      whyLabel({ decision: "hold", decidedBy: "review_hold", reasons: [
        "disputed_hit",
        "spend_guard",
        "request_error",
        "incomplete_evidence",
      ] }),
    ).toBe(
      "Screeners disagreed; Spend guard blocked the call; A specialist call failed; Evidence was incomplete",
    );
  });
});
