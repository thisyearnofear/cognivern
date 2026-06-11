/**
 * MongoDB seed script for the Cognivern Copilot hackathon submission.
 *
 * Loads realistic data into the four collections the agent depends on:
 *   - agent_memory       (long-term, reasoning, observation entries)
 *   - audit_logs         (~100 entries, mixed compliance status)
 *   - vendor_reputation  (10 vendors, mix of trusted and risky)
 *   - cre_runs           (20 runs across 3 agents)
 *
 * Usage:
 *   MONGODB_URI=mongodb+srv://... pnpm tsx scripts/db/seed-hackathon.ts
 *   MONGODB_URI=mongodb://localhost:27017 pnpm tsx scripts/db/seed-hackathon.ts --reset
 *
 *   --reset   Drops the four collections before inserting (idempotent seed)
 */

import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";

const RESET = process.argv.includes("--reset");
const DB_NAME = process.env.MONGODB_DB_NAME || "cognivern";
const URI = process.env.MONGODB_URI;

if (!URI) {
  console.error("MONGODB_URI is required");
  process.exit(1);
}

const AGENTS = [
  { id: "agent-alpha", name: "Alpha Trading Agent" },
  { id: "agent-bravo", name: "Bravo Payroll Agent" },
  { id: "agent-copilot", name: "Cognivern Copilot (the agent being submitted)" },
];

const VENDORS = [
  { address: "0xABCDEF1234567890abcdef1234567890abcdef12", name: "Chainlink Node Operator", trust: 92, category: "infra" },
  { address: "0xVendor1GOOD0000000000000000000000000000a", name: "Privara Payroll Inc",     trust: 88, category: "payroll" },
  { address: "0xVendor2GOOD0000000000000000000000000000b", name: "Filecoin Storage Co",     trust: 81, category: "storage" },
  { address: "0xVendor3GOOD0000000000000000000000000000c", name: "AWS Cloud Credits",       trust: 95, category: "cloud" },
  { address: "0xVendor4GOOD0000000000000000000000000000d", name: "Notion Workspace",        trust: 90, category: "saas" },
  { address: "0xVendor5GOOD0000000000000000000000000000e", name: "GitLab.com Seat",         trust: 89, category: "devtools" },
  { address: "0xBAD00000000000000000000000000000000000f", name: "Sketchy Mixer",           trust: 12, category: "unknown" },
  { address: "0xBAD0000000000000000000000000000000000aa", name: "Unverified Token Launch", trust: 18, category: "meme" },
  { address: "0xBAD0000000000000000000000000000000000bb", name: "Phishing Site Payout",    trust: 5,  category: "scam" },
  { address: "0xVendor6GOOD0000000000000000000000000000ff", name: "Fhenix Testnet Faucet", trust: 75, category: "testnet" },
];

const POLICIES = [
  { id: "policy-saas-allow-200",  name: "SaaS under $200/day",   dailyLimitUsdc: 200,   allowedCategories: ["saas", "devtools", "cloud"] },
  { id: "policy-payroll-monthly",  name: "Payroll under $5k/mo",  dailyLimitUsdc: 5000,  allowedCategories: ["payroll"] },
  { id: "policy-trading-strict",   name: "Trading (no meme)",     dailyLimitUsdc: 1000,  allowedCategories: ["infra", "storage", "devtools"], deniedCategories: ["meme", "scam", "unknown"] },
];

const ACTION_TYPES = [
  "transfer_usdc",
  "call_contract",
  "subscribe_api",
  "renew_domain",
  "fund_aws",
];

const REASONING = [
  "Vendor has 92 trust score and is in the SaaS allowlist.",
  "Amount is within daily $200 SaaS limit.",
  "Vendor flagged as scam in vendor_reputation (trust=5).",
  "Amount exceeds daily limit; held for human review.",
  "Policy compliance: vendor in devtools category, daily limit OK.",
  "ChainGPT audit returned clean; contract is verified.",
  "Vendor is in deny-list (meme category) — denied.",
  "Prior run with this vendor was non-compliant; escalated.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isoDaysAgo(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString();
}

async function main() {
  const client = new MongoClient(URI!, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const db = client.db(DB_NAME);
  console.log(`✓ Connected to ${DB_NAME}`);

  if (RESET) {
    console.log("Resetting collections...");
    await Promise.all([
      db.collection("agent_memory").deleteMany({}),
      db.collection("audit_logs").deleteMany({}),
      db.collection("vendor_reputation").deleteMany({}),
      db.collection("cre_runs").deleteMany({}),
    ]);
  }

  // --- vendor_reputation ---
  console.log("Seeding vendor_reputation...");
  const vendors = VENDORS.map((v) => {
    const incidents = v.trust < 30
      ? pickInt(2, 6)
      : v.trust < 60 ? pickInt(0, 2) : 0;
    return {
      _id: randomUUID(),
      vendor: v.address,
      name: v.name,
      category: v.category,
      trustScore: v.trust,
      priorIncidents: incidents,
      lastIncidentAt: incidents > 0 ? isoDaysAgo(pickInt(10, 180)) : null,
      chaingptAudit: v.trust > 70
        ? { status: "clean", auditedAt: isoDaysAgo(pickInt(1, 30)), model: "chaingpt-smart-contract-auditor" }
        : v.trust < 30
          ? { status: "flagged", findings: ["unverified-owner", "mixer-pattern"], auditedAt: isoDaysAgo(pickInt(1, 30)) }
          : null,
      updatedAt: isoDaysAgo(0),
    };
  });
  await db.collection("vendor_reputation").insertMany(vendors);
  console.log(`  → ${vendors.length} vendors`);

  // --- agent_memory ---
  console.log("Seeding agent_memory...");
  const memories: any[] = [];
  for (const agent of AGENTS) {
    for (let i = 0; i < pickInt(8, 12); i++) {
      const type = pick(["short_term", "long_term", "reasoning", "observation"] as const);
      const vendor = pick(VENDORS);
      memories.push({
        id: randomUUID(),
        agentId: agent.id,
        type,
        content: type === "reasoning"
          ? `Considering ${vendor.name} (trust ${vendor.trust}) for ${pick(ACTION_TYPES)}. Policy ${pick(POLICIES).id} applies.`
          : type === "observation"
            ? `Vendor ${vendor.address} responded to our last query in ${pickInt(50, 800)}ms.`
            : type === "short_term"
              ? `Recent task: ${pick(ACTION_TYPES)} ${pickInt(10, 500)} USDC to ${vendor.name}.`
              : `Long-term: prefer vendors with trust > 70 and ChainGPT-clean audits.`,
        confidence: pick([0.7, 0.8, 0.85, 0.9, 0.95]),
        timestamp: isoDaysAgo(pickInt(0, 30)),
        metadata: { vendor: vendor.address, action: pick(ACTION_TYPES) },
      });
    }
  }
  await db.collection("agent_memory").insertMany(memories);
  console.log(`  → ${memories.length} memory entries`);

  // --- audit_logs ---
  console.log("Seeding audit_logs...");
  const audits: any[] = [];
  for (let i = 0; i < 100; i++) {
    const agent = pick(AGENTS);
    const vendor = pick(VENDORS);
    const policy = pick(POLICIES);
    const compliance = vendor.trust < 30
      ? pick(["non-compliant", "warning"] as const)
      : vendor.trust > 80
        ? "compliant"
        : pick(["compliant", "warning"] as const);
    const riskScore = compliance === "compliant" ? pickInt(5, 35) : compliance === "warning" ? pickInt(40, 65) : pickInt(70, 95);
    audits.push({
      id: randomUUID(),
      decisionId: `dec_${randomUUID().slice(0, 8)}`,
      attestationHash: `0x${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`,
      timestamp: isoDaysAgo(pickInt(0, 60)),
      agentId: agent.id,
      action: {
        type: pick(ACTION_TYPES),
        description: `${pick(ACTION_TYPES)} ${pickInt(10, 800)} USDC to ${vendor.name}`,
        input: JSON.stringify({ vendor: vendor.address, amount: pickInt(10, 800), asset: "USDC" }),
        decision: compliance === "compliant" ? "approved" : compliance === "warning" ? "held" : "denied",
      },
      policyChecks: [
        { policyId: policy.id, result: compliance !== "non-compliant", reason: pick(REASONING) },
      ],
      metadata: {
        modelVersion: "gemini-3-pro-preview",
        governancePolicy: policy.id,
        complianceStatus: compliance,
        riskScore,
        latencyMs: pickInt(120, 1400),
        chaingptAudited: vendor.trust > 70,
      },
    });
  }
  await db.collection("audit_logs").insertMany(audits);
  console.log(`  → ${audits.length} audit logs`);

  // --- cre_runs ---
  console.log("Seeding cre_runs...");
  const runs: any[] = [];
  for (let i = 0; i < 20; i++) {
    const agent = pick(AGENTS);
    const started = pickInt(0, 30);
    const duration = pickInt(2, 90);
    const outcome = pick(["success", "success", "success", "held", "denied"] as const);
    runs.push({
      _id: randomUUID(),
      agentId: agent.id,
      intent: pick([
        "Pay AWS bill for production cluster",
        "Renovate GitLab seats for the team",
        "Sweep trading profits to cold storage",
        "Pay monthly Privara payroll",
        "Renew Notion workspace subscription",
      ]),
      startedAt: isoDaysAgo(started),
      completedAt: isoDaysAgo(Math.max(0, started - duration / 1440)),
      status: outcome,
      actions: pickInt(2, 6),
      tools: ["cognivern_preview_spend", "cognivern_execute_spend", "mongodb_recall_memory"],
      auditIds: audits.slice(0, pickInt(1, 3)).map((a) => a.id),
      summary: outcome === "success"
        ? "Spend approved and executed; audit entry written."
        : outcome === "held"
          ? "Spend held for human review; agent surfaced the decision."
          : "Spend denied; policy violation.",
    });
  }
  await db.collection("cre_runs").insertMany(runs);
  console.log(`  → ${runs.length} runs`);

  // --- indexes ---
  console.log("Creating indexes...");
  await Promise.all([
    db.collection("agent_memory").createIndex({ agentId: 1, timestamp: -1 }),
    db.collection("agent_memory").createIndex({ type: 1 }),
    db.collection("audit_logs").createIndex({ agentId: 1, timestamp: -1 }),
    db.collection("audit_logs").createIndex({ "metadata.complianceStatus": 1 }),
    db.collection("audit_logs").createIndex({ "metadata.riskScore": 1 }),
    db.collection("vendor_reputation").createIndex({ vendor: 1 }, { unique: true }),
    db.collection("vendor_reputation").createIndex({ trustScore: -1 }),
    db.collection("cre_runs").createIndex({ agentId: 1, startedAt: -1 }),
  ]);

  console.log("\n✅ Seed complete. Collections ready:");
  console.log("  - agent_memory       ", memories.length);
  console.log("  - audit_logs         ", audits.length);
  console.log("  - vendor_reputation  ", vendors.length);
  console.log("  - cre_runs           ", runs.length);

  await client.close();
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
