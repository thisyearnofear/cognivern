import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fixture from "./fixtures/diligence-report.sample.json";
import { parsePublicDiligenceReport } from "@/lib/diligence-report";

/**
 * Guards the worked example linked from /telegraph: the page tells a
 * first-time operator that the fictional supplier Northwind was held because
 * purchased evidence was low-confidence, and deep-links into the governed
 * view of case 2 for model "groq". If the shipped public report changes,
 * update the telegraph copy instead of weakening this test.
 */
const publicReport = parsePublicDiligenceReport(
  JSON.parse(
    readFileSync(
      join(__dirname, "../public/evidence/diligence/supplier-diligence.json"),
      "utf8",
    ),
  ),
);
if (!publicReport) throw new Error("public supplier-diligence report must parse");

describe("supplier-diligence worked example", () => {
  it("keeps the synthetic fixture case order (index 2 = unregistered-supplier)", () => {
    const report = parsePublicDiligenceReport(fixture);
    expect(report?.cases[2].id).toBe("unregistered-supplier");
  });

  it("public report case 2 is the unregistered supplier held on low-confidence evidence", () => {
    const northwind = publicReport.cases[2];
    expect(northwind.id).toBe("unregistered-supplier");
    expect(northwind.gate?.decision).toBe("hold");
    expect(northwind.gate?.reasons).toContain("low_confidence_evidence");
  });

  it("groq alone recommended proceeding; governed review held", () => {
    const northwind = publicReport.cases[2];
    const groq = northwind.perModel.find((m) => m.label === "groq");
    expect(groq).toBeDefined();
    expect(groq!.alone?.decision).toBe("proceed");
    expect(groq!.alone?.correct).toBe(false);
    expect(groq!.governed?.finalDecision).toBe("hold");
    expect(groq!.governed?.decidedBy).toBe("review_hold");
    expect(groq!.decisionChanged).toBe(true);
  });
});
