import { describe, expect, it } from "vitest";
import { parseEvaluationVerdict } from "../../src/backend/services/inference/InferenceVerificationService.js";

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
