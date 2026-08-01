#!/usr/bin/env tsx
/**
 * Validate the checked-in SigNoz dashboard manifest and optionally compare its
 * titles with a SigNoz dashboard API response.
 *
 * Usage:
 *   pnpm signoz:check
 *   SIGNOZ_CLOUD_URL=https://us.signoz.cloud SIGNOZ_API_KEY=... pnpm signoz:check
 *
 * The local manifest remains the portable import source. The remote check is
 * deliberately read-only so CI/ops can detect drift without mutating a shared
 * SigNoz workspace.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type Dashboard = {
  title?: string;
  layout?: Array<{ title?: string; query?: string }>;
};

const manifestPath = resolve(process.cwd(), "docs/signoz-dashboards.json");
const raw = JSON.parse(await readFile(manifestPath, "utf8")) as { dashboards?: Dashboard[] };
const dashboards = raw.dashboards ?? [];

if (dashboards.length === 0) throw new Error("Dashboard manifest contains no dashboards");

const titles = dashboards.map((dashboard) => dashboard.title ?? "");
const duplicates = titles.filter((title, index) => title && titles.indexOf(title) !== index);
if (duplicates.length > 0) throw new Error(`Duplicate dashboard titles: ${duplicates.join(", ")}`);

for (const dashboard of dashboards) {
  if (!dashboard.title) throw new Error("Every dashboard must have a title");
  if (!dashboard.layout?.length) throw new Error(`Dashboard has no panels: ${dashboard.title}`);
  const missingQueries = dashboard.layout.filter((panel) => !panel.title || !panel.query);
  if (missingQueries.length > 0) {
    throw new Error(`Dashboard has incomplete panels: ${dashboard.title}`);
  }
}

console.log(`Local manifest OK: ${dashboards.length} dashboards, ${dashboards.reduce((n, d) => n + (d.layout?.length ?? 0), 0)} panels`);

const cloudUrl = process.env.SIGNOZ_CLOUD_URL?.trim();
const apiKey = process.env.SIGNOZ_API_KEY?.trim();
if (!cloudUrl || !apiKey) {
  console.log("Remote comparison skipped (set SIGNOZ_CLOUD_URL and SIGNOZ_API_KEY to check workspace drift).");
  process.exit(0);
}

const endpoint = `${cloudUrl.replace(/\/$/, "")}/api/v1/dashboards`;
const response = await fetch(endpoint, {
  headers: { "SIGNOZ-API-KEY": apiKey, Accept: "application/json" },
});
if (!response.ok) {
  throw new Error(`SigNoz dashboard API returned ${response.status}; local manifest was valid`);
}

const payload = (await response.json()) as { data?: Array<{ name?: string; title?: string }> } | Array<{ name?: string; title?: string }>;
const remote = Array.isArray(payload) ? payload : payload.data ?? [];
const remoteTitles = new Set(remote.map((dashboard) => dashboard.title ?? dashboard.name).filter(Boolean));
const missing = titles.filter((title) => !remoteTitles.has(title));
if (missing.length > 0) {
  console.error(`SigNoz workspace is missing ${missing.length} manifest dashboard(s):`);
  for (const title of missing) console.error(`  - ${title}`);
  process.exit(2);
}
console.log("SigNoz workspace contains every manifest dashboard title.");
