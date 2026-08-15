/**
 * Budget formatting utilities.
 * Parses budget strings like "$500/day", "$5,000", "unlimited" into structured values.
 */

export interface ParsedBudget {
  raw: string;
  amount: number | null;
  period: "hour" | "day" | "week" | "month" | null;
  formatted: string;
}

/**
 * Parse a budget string into a structured value.
 * Examples:
 *   "$500/day" → { amount: 500, period: "day" }
 *   "$5,000" → { amount: 5000, period: null }
 *   "unlimited" → { amount: null, period: null }
 */
export function parseBudget(raw: string): ParsedBudget {
  const lower = raw.toLowerCase().trim();

  if (lower === "unlimited" || lower === "—") {
    return { raw, amount: null, period: null, formatted: raw };
  }

  // Extract amount (handle $, commas, decimals)
  const amountMatch = raw.match(/\$?\s*([\d,]+(?:\.\d+)?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : null;

  // Extract period
  let period: ParsedBudget["period"] = null;
  if (/\/h(our)?/.test(lower)) period = "hour";
  else if (/\/d(ay)?/.test(lower)) period = "day";
  else if (/\/w(eek)?/.test(lower)) period = "week";
  else if (/\/m(onth)?/.test(lower)) period = "month";

  // Format for display
  let formatted = raw;
  if (amount !== null) {
    const formattedAmount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);

    formatted = period ? `${formattedAmount}/${period}` : formattedAmount;
  }

  return { raw, amount, period, formatted };
}

/**
 * Format a budget value for display in stat cards and tables.
 */
export function formatBudget(raw: string): string {
  return parseBudget(raw).formatted;
}

/**
 * Format a USD number for display — the single formatter for numeric money
 * across stat cards, tables, and feeds.
 *
 * `maxFractionDigits` defaults to 2; pass 6 for per-call costs where 2dp hides
 * real inference prices (a 0G call can cost $0.0001). Null/undefined renders
 * as an em dash so callers never sprinkle their own fallbacks.
 */
export function formatUsd(value: number | null | undefined, maxFractionDigits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}
