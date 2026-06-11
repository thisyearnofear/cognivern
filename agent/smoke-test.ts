/**
 * Smoke test for the Cognivern Copilot agent.
 *
 * Runs the agent end-to-end in preview-only mode against:
 *   - a live or local Cognivern API
 *   - a live or local MongoDB
 *
 * Verifies the multi-step protocol is followed:
 *   - The model calls list_policies
 *   - The model calls mongodb_recall_memory or vendor_reputation
 *   - The model calls cognivern_preview_spend
 *   - The model either attempts cognivern_execute_spend (intercepted in
 *     previewOnly) or refuses to execute without explicit human confirmation
 *
 * Usage:
 *   pnpm tsx agent/smoke-test.ts
 *
 * Env:
 *   GOOGLE_CLOUD_PROJECT        preferred for Vertex AI auth via gcloud
 *   GEMINI_API_KEY              optional local-only fallback
 *   COGNIVERN_API_KEY           required (any value if running against dev server)
 *   COGNIVERN_BASE_URL          default https://cognivern.thisyearnofear.com
 *   MONGODB_URI                 required
 *   MONGODB_DB_NAME             default cognivern
 *   GEMINI_MODEL                default gemini-3.1-pro-preview
 */

import { runAgent } from "./agent.js";

const goal =
  process.env.SMOKE_GOAL ||
  "For agent-copilot, preview a 100 USDC spend to vendor 0xABCDEF1234567890abcdef1234567890abcdef12 for API credits under the active spend policy. First recall agent-copilot memory and vendor reputation, then run the spend preview. If the preview is approved, attempt execute so preview-only mode can intercept it.";

const result = await runAgent({
  goal,
  cognivernApiKey: process.env.COGNIVERN_API_KEY || "development-api-key",
  cognivernBaseUrl:
    process.env.COGNIVERN_BASE_URL || "https://cognivern.thisyearnofear.com",
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017",
  mongodbDatabase: process.env.MONGODB_DB_NAME || "cognivern",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.1-pro-preview",
  googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT,
  vertexLocation: process.env.VERTEX_LOCATION || "global",
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

if (toolNames.includes("cognivern_execute_spend")) {
  console.log("\n✅ execute_spend attempted and intercepted in preview-only mode.");
} else {
  console.log(
    "\n✅ execute_spend was not attempted because the model required explicit human confirmation.",
  );
}

console.log("\n✅ SMOKE TEST PASSED — agent followed the preview protocol.");
