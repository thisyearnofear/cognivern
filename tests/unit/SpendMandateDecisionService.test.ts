import { describe, expect, it } from "vitest";
import {
  evaluateMandateDecision,
  mandateDecisionRequestSchema,
  type SpendMandate,
  type SpendPurchaseRequest,
} from "@backend/services/governance/SpendMandateDecisionService.js";

const baseMandate: SpendMandate = {
  agent_id: "procurement-bot-7",
  budget_usd: 500,
  spent_usd: 120,
  period: "2026-11",
  allowed_vendors: ["aws-marketplace", "vercel", "cloudflare", "notion"],
  blocked_categories: ["gambling", "adult", "weapons"],
  approval_categories: ["software-subscription-over-200"],
  allow_split_purchases: false,
};

function decide(
  mandate: Partial<SpendMandate>,
  request: Partial<SpendPurchaseRequest>,
) {
  return evaluateMandateDecision(
    { ...baseMandate, ...mandate },
    {
      action: "purchase",
      ...request,
    } as SpendPurchaseRequest,
  );
}

describe("SpendMandateDecisionService", () => {
  it("allows a clean in-policy purchase", () => {
    const d = decide({}, {
      item: "Figma Professional annual seat",
      vendor: "vercel",
      amount_usd: 45,
      category: "design-software",
    });
    expect(d.decision).toBe("ALLOW");
    expect(d.rule).toBe("within_policy");
    expect(d.reason_code).toBe("within_policy");
    expect(d.checks.vendor_allowed).toBe(true);
    expect(d.checks.within_budget).toBe(true);
  });

  it("refuses over-budget spend", () => {
    const d = decide({ spent_usd: 480 }, {
      item: "Datadog annual subscription",
      vendor: "aws-marketplace",
      amount_usd: 1200,
      category: "observability",
    });
    expect(d.decision).toBe("REFUSE");
    expect(d.rule).toBe("over_budget");
  });

  it("uses estimated_total_usd for the budget check when present", () => {
    const d = decide({ spent_usd: 400 }, {
      item: "Tool with fees",
      vendor: "vercel",
      amount_usd: 80,
      estimated_total_usd: 150,
      category: "design-software",
    });
    // sticker 80 fits in 100 left, estimated 150 does not
    expect(d.decision).toBe("REFUSE");
    expect(d.rule).toBe("over_budget");
  });

  it("escalates non-allowlisted vendors", () => {
    const d = decide({}, {
      item: "Premium VPN subscription",
      vendor: "unknown-vendor-xyz",
      amount_usd: 60,
      category: "security-software",
    });
    expect(d.decision).toBe("ESCALATE");
    expect(d.rule).toBe("vendor_not_allowlisted");
  });

  it("refuses blocked categories even for allowlisted vendors", () => {
    const d = decide({}, {
      item: "Online casino credits",
      vendor: "aws-marketplace",
      amount_usd: 200,
      category: "gambling",
    });
    expect(d.decision).toBe("REFUSE");
    expect(d.rule).toBe("blocked_category");
  });

  it("escalates approval-gated categories and recurring commitments", () => {
    const cat = decide({}, {
      vendor: "aws-marketplace",
      amount_usd: 300,
      category: "software-subscription-over-200",
    });
    expect(cat.decision).toBe("ESCALATE");
    expect(cat.rule).toBe("approval_required");

    const rec = decide({}, {
      vendor: "vercel",
      amount_usd: 20,
      category: "productivity",
      recurring: true,
    });
    expect(rec.decision).toBe("ESCALATE");
    expect(rec.rule).toBe("approval_required");
  });

  it("asks for clarification when amount or vendor/category is missing", () => {
    const noAmount = decide({}, {
      item: "Cloud service",
      vendor: "some-cloud-provider",
      category: "cloud-infrastructure",
    });
    expect(noAmount.decision).toBe("ASK_CLARIFICATION");
    expect(noAmount.rule).toBe("missing_amount");

    const noVendor = decide({}, {
      item: "Misc",
      amount_usd: 10,
      category: "productivity",
    });
    expect(noVendor.decision).toBe("ASK_CLARIFICATION");
  });

  it("applies sequential budget accounting across multi-item orders", () => {
    // budget_left = 380; items $40 + $2000 -> gartner over budget
    const d = decide({ spent_usd: 120 }, {
      multi_item: true,
      item_labels: {
        sentry: "(a) Sentry error monitoring $40/mo",
        gartner: "(b) Gartner research subscription $2000/yr",
      },
      vendor: "aws-marketplace",
      category: "observability",
    });
    expect(d.item_decisions).toEqual({ sentry: "ALLOW", gartner: "REFUSE" });
    expect(d.decision).toBe("REFUSE");
    expect(d.reason_code).toBe("multi_item_policy");
  });

  it("refuses combined multi-item totals that jointly exceed budget", () => {
    // budget_left = 100; two $60 items each fit alone, combined does not
    const d = decide({ spent_usd: 400 }, {
      multi_item: true,
      item_labels: {
        a: "Widget A $60",
        b: "Widget B $60",
      },
      vendor: "vercel",
      category: "productivity",
    });
    expect(d.item_decisions).toEqual({ a: "ALLOW", b: "REFUSE" });
    expect(d.item_checks?.b?.within_budget).toBe(false);
    expect(d.decision).toBe("REFUSE");
  });

  it("validates the request schema", () => {
    const ok = mandateDecisionRequestSchema.safeParse({
      mandate: { budget_usd: 100, allowed_vendors: ["v"] },
      request: { vendor: "v", amount_usd: 10, category: "c" },
    });
    expect(ok.success).toBe(true);

    const bad = mandateDecisionRequestSchema.safeParse({
      mandate: { budget_usd: -5 },
      request: {},
    });
    expect(bad.success).toBe(false);
  });
});
