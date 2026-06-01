import { describe, it, expect } from "vitest";
import { parseBudget, formatBudget } from "@/lib/budget-format";

describe("parseBudget", () => {
  it("parses $500/day correctly", () => {
    const result = parseBudget("$500/day");
    expect(result.amount).toBe(500);
    expect(result.period).toBe("day");
    expect(result.formatted).toBe("$500/day");
  });

  it("parses $5,000 with comma formatting", () => {
    const result = parseBudget("$5,000");
    expect(result.amount).toBe(5000);
    expect(result.period).toBeNull();
    expect(result.formatted).toBe("$5,000");
  });

  it("parses $1,500.50 with decimals", () => {
    const result = parseBudget("$1,500.50");
    expect(result.amount).toBe(1500.5);
    expect(result.period).toBeNull();
  });

  it("handles 'unlimited'", () => {
    const result = parseBudget("unlimited");
    expect(result.amount).toBeNull();
    expect(result.period).toBeNull();
    expect(result.formatted).toBe("unlimited");
  });

  it("handles em-dash as unlimited", () => {
    const result = parseBudget("—");
    expect(result.amount).toBeNull();
    expect(result.period).toBeNull();
  });

  it("parses $200/week", () => {
    const result = parseBudget("$200/week");
    expect(result.amount).toBe(200);
    expect(result.period).toBe("week");
  });

  it("parses $1000/month", () => {
    const result = parseBudget("$1000/month");
    expect(result.amount).toBe(1000);
    expect(result.period).toBe("month");
  });

  it("parses $50/hour", () => {
    const result = parseBudget("$50/hour");
    expect(result.amount).toBe(50);
    expect(result.period).toBe("hour");
  });

  it("handles amount without dollar sign", () => {
    const result = parseBudget("500");
    expect(result.amount).toBe(500);
    expect(result.period).toBeNull();
  });

  it("handles empty string gracefully", () => {
    const result = parseBudget("");
    expect(result.amount).toBeNull();
    expect(result.period).toBeNull();
  });

  it("handles whitespace around the value", () => {
    const result = parseBudget("  $300/day  ");
    expect(result.amount).toBe(300);
    expect(result.period).toBe("day");
  });
});

describe("formatBudget", () => {
  it("formats $500/day for display", () => {
    expect(formatBudget("$500/day")).toBe("$500/day");
  });

  it("returns raw value for unlimited", () => {
    expect(formatBudget("unlimited")).toBe("unlimited");
  });

  it("formats with proper currency symbol", () => {
    expect(formatBudget("2000")).toBe("$2,000");
  });
});
