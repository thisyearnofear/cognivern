import { describe, expect, it } from "vitest";
import {
  combineEvaluations,
  parseEvaluationVerdict,
  type EvaluationOutcome,
} from "../../src/backend/services/inference/InferenceVerificationService.js";

describe("parseEvaluationVerdict", () => {
  it("reads verdict-shaped keys", () => {
    expect(parseEvaluationVerdict({ verdict: "correct" }).verdict).toBe("correct");
    expect(parseEvaluationVerdict({ is_correct: false }).verdict).toBe("incorrect");
    expect(parseEvaluationVerdict({ result: "INCORRECT" }).verdict).toBe("incorrect");
  });

  it("finds verdicts nested in provider payloads", () => {
    const r = parseEvaluationVerdict({
      data: { evaluation: { judgement: "correct" } },
    });
    expect(r.verdict).toBe("correct");
  });

  it("falls back to recognizable tokens in free text", () => {
    expect(parseEvaluationVerdict({ answer: "The response is correct." }).verdict).toBe(
      "correct",
    );
    expect(parseEvaluationVerdict("incorrect").verdict).toBe("incorrect");
  });

  it("returns unknown when nothing parseable exists", () => {
    expect(parseEvaluationVerdict({ foo: "bar" }).verdict).toBe("unknown");
    expect(parseEvaluationVerdict(null).verdict).toBe("unknown");
    expect(parseEvaluationVerdict(42).verdict).toBe("unknown");
  });
});

describe("combineEvaluations", () => {
  const outcome = (over: Partial<EvaluationOutcome>): EvaluationOutcome => ({
    verdict: "correct",
    minerId: "m1",
    minerName: "Miner One",
    confidence: 0.9,
    runId: "run-1",
    costUsd: "0.01",
    ...over,
  });

  it("passes a single evaluator's verdict through unchanged", () => {
    const r = combineEvaluations([outcome({ verdict: "incorrect", detail: "verdict=incorrect" })]);
    expect(r.verdict).toBe("incorrect");
    expect(r.evaluatorMinerId).toBe("m1");
    expect(r.telegraphRunId).toBe("run-1");
    expect(r.costUsd).toBe("0.01");
  });

  it("requires unanimous decided verdicts across evaluators", () => {
    const agreed = combineEvaluations([
      outcome({ minerId: "m1", minerName: "A" }),
      outcome({ minerId: "m2", minerName: "B", runId: "run-2" }),
    ]);
    expect(agreed.verdict).toBe("correct");
    expect(agreed.evaluatorMinerId).toBe("m1,m2");
    expect(agreed.telegraphRunId).toBe("run-1,run-2");
    expect(agreed.costUsd).toBe("0.020000");
    expect(agreed.detail).toContain("agreement");

    const split = combineEvaluations([
      outcome({ minerId: "m1" }),
      outcome({ minerId: "m2", verdict: "incorrect", runId: "run-2" }),
    ]);
    expect(split.verdict).toBe("unknown");
    expect(split.detail).toContain("no consensus");
    expect(split.detail).toContain("incorrect");
  });

  it("treats any inconclusive evaluator as no consensus", () => {
    const r = combineEvaluations([
      outcome({ minerId: "m1" }),
      outcome({ minerId: "m2", verdict: "unknown", detail: "evaluator call held" }),
    ]);
    expect(r.verdict).toBe("unknown");
    expect(r.detail).toContain("evaluator call held");
  });
});
