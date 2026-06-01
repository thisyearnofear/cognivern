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
