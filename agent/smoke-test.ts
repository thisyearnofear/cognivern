/**
 * Smoke test for the Cognivern Copilot agent.
 *
 * Runs the agent end-to-end in preview-only mode against:
 *   - a live or local Cognivern API
 *   - a live or local MongoDB
 *
 * Verifies the multi-step protocol is followed:
 *   - The model calls list_policies / get_policy
 *   - The model calls mongodb_recall_memory or vendor_reputation
 *   - The model calls cognivern_preview_spend
 *   - The model attempts cognivern_execute_spend (intercepted in previewOnly)
 *
 * Usage:
 *   pnpm tsx agent/smoke-test.ts
 *
 * Env:
 *   GEMINI_API_KEY              required
 *   COGNIVERN_API_KEY           required (any value if running against dev server)
 *   COGNIVERN_BASE_URL          default https://cognivern.thisyearnofear.com
 *   MONGODB_URI                 required
 *   MONGODB_DB_NAME             default cognivern
 *   GEMINI_MODEL                default gemini-3-pro-preview
 */

import { runAgent } from "./agent.js";

const goal =
  process.env.SMOKE_GOAL ||
  "Pay 100 USDC to vendor 0xVendorAddress for API credits, but only if their last contract audit was clean and we have a policy that allows up to $200 for this kind of vendor.";

const result = await runAgent({
  goal,
  cognivernApiKey: process.env.COGNIVERN_API_KEY || "development-api-key",
  cognivernBaseUrl:
    process.env.COGNIVERN_BASE_URL || "https://cognivern.thisyearnofear.com",
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017",
  mongodbDatabase: process.env.MONGODB_DB_NAME || "cognivern",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || "gemini-3-pro-preview",
  previewOnly: true,
});

console.log("\n=== SMOKE TEST RESULT ===");
console.log("Summary:", result.summary);
console.log("decisionId:    ", result.decisionId);
console.log("attestation:   ", result.attestationHash);
console.log("auditLogId:    ", result.auditLogId);

const toolNames = result.transcript
  .filter((t) => t.role === "model" && t.name)
  .map((t) => t.name!);

const expectedTools = [
  "cognivern_list_policies",
  "cognivern_get_policy",
  "mongodb_recall_memory",
  "mongodb_vendor_reputation",
  "cognivern_preview_spend",
];

const missing = expectedTools.filter((t) => !toolNames.includes(t));
if (missing.length) {
  console.error("\n❌ SMOKE TEST FAILED — agent did not call:", missing);
  console.error("Tools called:", toolNames);
  process.exit(1);
}

if (!toolNames.includes("cognivern_execute_spend")) {
  console.error(
    "\n❌ SMOKE TEST FAILED — agent did not attempt execute_spend (should be intercepted in preview mode).",
  );
  process.exit(1);
}

console.log("\n✅ SMOKE TEST PASSED — agent followed the multi-step protocol.");
