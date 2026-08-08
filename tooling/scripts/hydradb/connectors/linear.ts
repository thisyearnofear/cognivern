/**
 * Linear connector — extracts issues from Linear and ingests them into HydraDB
 * as app-knowledge, keyed on the same `agent_id` / `vendor` entities as the
 * audit ledger.
 *
 * The shared entity is the **issue assignee / creator** (Linear user email or
 * name), which we map to `agent_id` so HydraDB's graph can dedup: "the person
 * who filed BUG-123 in Linear also triggered this spend in cognivern's audit
 * ledger, and what did they say about the fix."
 *
 * This is the connector that makes the challenge's example question work:
 *   "Who filed BUG-123, which project are they working on, and what did
 *    they say about the fix in Slack?"
 * Linear answers the first two clauses; the audit ledger + Slack answer the rest.
 *
 * Auth: `LINEAR_API_KEY` (personal API key from linear.app/settings/api).
 *      GraphQL API at https://api.linear.app/graphql.
 *
 * Run: LINEAR_API_KEY=lin_api_... pnpm tsx tooling/scripts/hydradb/connectors/linear.ts
 *
 * If no key is set, the connector exits cleanly with guidance (does not fail
 * the build) — Linear is optional until you provide a key.
 */

import logger from "@backend/utils/logger.js";
import { hydraDbIngestion, type AppKnowledgeRecord } from "@backend/services/hydradb/index.js";
import { config } from "@/config.js";

const LINEAR_API = "https://api.linear.app/graphql";

interface LinearIssue {
  id: string;
  identifier: string; // e.g. "COG-123"
  title: string;
  description: string | null;
  state: { name: string } | null;
  assignee: { name: string; email: string } | null;
  creator: { name: string; email: string } | null;
  team: { key: string; name: string } | null;
  project: { id: string; name: string } | null;
  labels: { nodes: Array<{ name: string }> } | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}

async function linearQuery(query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    throw new Error("LINEAR_API_KEY is not set. Get one at linear.app/settings/api");
  }

  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey, // Linear uses the raw key as the bearer token
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Linear API ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as { data?: unknown; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(`Linear GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  return json.data;
}

const ISSUES_QUERY = `
  query Issues($first: Int!, $after: String) {
    issues(first: $first, after: $after, orderBy: updatedAt) {
      nodes {
        id
        identifier
        title
        description
        state { name }
        assignee { name email }
        creator { name email }
        team { key name }
        project { id name }
        labels { nodes { name } }
        url
        createdAt
        updatedAt
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

/** Fetch all issues (paginated), capped at 200 for the demo. */
async function fetchIssues(): Promise<LinearIssue[]> {
  const all: LinearIssue[] = [];
  let after: string | null = null;
  const MAX = 200;

  while (all.length < MAX) {
    const data = (await linearQuery(ISSUES_QUERY, { first: 50, after })) as {
      issues: { nodes: LinearIssue[]; pageInfo: { hasNextPage: boolean; endCursor: string } };
    };
    all.push(...data.issues.nodes);
    if (!data.issues.pageInfo.hasNextPage) break;
    after = data.issues.pageInfo.endCursor;
  }
  return all.slice(0, MAX);
}

/**
 * Cross-source identity mapping.
 *
 * The same human operator appears under different ids across sources:
 *   - Linear: email (papaandthejimjams@gmail.com) or name (papa)
 *   - GitHub: login (thisyearnofear)
 *   - Audit ledger: machine agent ids (http-verify-agent, project-a-agent)
 *
 * To let HydraDB's graph dedup the *human* across Linear + GitHub, we map
 * the Linear email to the GitHub login as the canonical `agent_id`. This is
 * the operator who both files Linear issues AND commits to GitHub — the
 * cross-source entity the challenge's "same person across sources" test wants.
 *
 * Extend this map as more operators are onboarded. Unknown emails keep their
 * Linear email as agent_id (still dedups within Linear).
 */
const LINEAR_TO_GITHUB_LOGIN: Record<string, string> = {
  "papaandthejimjams@gmail.com": "thisyearnofear",
};

/**
 * Map a Linear issue to a HydraDB app-knowledge record.
 * The assignee/creator email becomes `agent_id` for cross-source dedup.
 */
function issueToRecord(issue: LinearIssue): AppKnowledgeRecord {
  // Prefer assignee (who's working on it) for the agent_id; fall back to creator.
  const actor = issue.assignee ?? issue.creator;
  const rawActorId = actor?.email ?? actor?.name ?? "unassigned";
  // Canonicalize to the GitHub login when known, so the same human dedups
  // across Linear + GitHub + (optionally) the audit ledger.
  const actorId = LINEAR_TO_GITHUB_LOGIN[rawActorId] ?? rawActorId;
  const labels = issue.labels?.nodes.map((l) => l.name) ?? [];
  // Heuristic: a label like "vendor:stable-email" links to an audit-ledger vendor.
  const vendorLabel = labels.find((l) => l.toLowerCase().startsWith("vendor:"));
  // Also scan title + description for known audit-ledger vendors/agents, so
  // issues that reference them in text (not labels) still dedup cross-source.
  const haystack = `${issue.title} ${issue.description ?? ""}`.toLowerCase();
  const KNOWN_VENDORS = ["stable-email"];
  const KNOWN_AGENTS = ["http-verify-agent", "project-a-agent", "agent-1"];
  const vendor =
    vendorLabel?.split(":")[1] ??
    KNOWN_VENDORS.find((v) => haystack.includes(v)) ??
    "unknown";
  const referencedAgent = KNOWN_AGENTS.find((a) => haystack.includes(a));

  const text = [
    `${issue.identifier}: ${issue.title}`,
    `Team: ${issue.team?.name ?? "?"} (${issue.team?.key ?? "?"}) | State: ${issue.state?.name ?? "?"}`,
    `Assignee: ${issue.assignee?.name ?? "unassigned"} | Creator: ${issue.creator?.name ?? "?"}`,
    issue.project ? `Project: ${issue.project.name}` : "",
    labels.length ? `Labels: ${labels.join(", ")}` : "",
    "",
    issue.description ?? "(no description)",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: `linear_${issue.id}`,
    database: config.HYDRADB_DATABASE,
    collection: config.HYDRADB_COLLECTION,
    title: `Linear ${issue.identifier}: ${issue.title}`,
    type: "linear",
    url: issue.url,
    timestamp: issue.createdAt,
    content: { text, markdown: text },
    tenant_metadata: {},
    additional_metadata: {
      // Entity fields for cross-source dedup with the audit ledger.
      agent_id: actorId, // Linear user = the actor
      vendor: vendor ?? "unknown",
      origin: "linear",
      // Linear-specific bookkeeping.
      linear_id: issue.id,
      identifier: issue.identifier,
      team: issue.team?.key,
      team_name: issue.team?.name,
      project_id: issue.project?.id,
      project_name: issue.project?.name,
      state: issue.state?.name,
      assignee: issue.assignee?.name,
      assignee_email: issue.assignee?.email,
      creator: issue.creator?.name,
      creator_email: issue.creator?.email,
      labels,
      ts: issue.createdAt.slice(0, 10),
    },
    relations: {
      // Link to the cognivern agent entity (same human across Linear + GitHub).
      // Also link to any audit-ledger agent referenced in the issue text, so
      // HydraDB's graph connects Linear issues to the audit-ledger agent entity.
      ids: [
        `cognivern_agent_${actorId}`,
        referencedAgent ? `cognivern_agent_${referencedAgent}` : undefined,
        vendor !== "unknown" ? `cognivern_vendor_${vendor}` : undefined,
      ].filter((x): x is string => Boolean(x)),
      properties: { relation: "same_actor" },
    },
  };
}

async function main() {
  console.log(`=== Linear connector → HydraDB ===`);
  console.log(`hydradb enabled: ${hydraDbIngestion.isEnabled()}`);

  if (!hydraDbIngestion.isEnabled()) {
    console.error("HYDRADB_ENABLED is not true (or HYDRADB_API_KEY missing).");
    process.exit(1);
  }

  if (!process.env.LINEAR_API_KEY) {
    console.error("\nLINEAR_API_KEY is not set.");
    console.error("Get a personal API key at: https://linear.app/settings/api");
    console.error("Then run: LINEAR_API_KEY=lin_api_... pnpm tsx tooling/scripts/hydradb/connectors/linear.ts");
    console.error("\n(This connector is optional — GitHub + audit ledger already give 2 sources.)");
    process.exit(0); // exit 0, not 1 — Linear is optional.
  }

  console.log(`\n[1/3] fetching issues from Linear...`);
  const issues = await fetchIssues();
  console.log(`  fetched ${issues.length} issues`);

  console.log(`\n[2/3] mapping to app-knowledge records...`);
  const records = issues.map(issueToRecord);
  console.log(`  ${records.length} records ready`);
  if (records.length > 0) {
    console.log(`  sample: ${records[0].title}`);
    const agents = [...new Set(records.map((r) => r.additional_metadata.agent_id))];
    console.log(`  agent_ids (assignees/creators): ${agents.join(", ")}`);
    const projects = [...new Set(records.map((r) => r.additional_metadata.project_name).filter(Boolean))];
    console.log(`  projects: ${projects.join(", ")}`);
  }

  if (records.length === 0) {
    console.log("\nNo issues to ingest. Exiting.");
    process.exit(0);
  }

  console.log(`\n[3/3] ingesting into HydraDB (batches of 25)...`);
  const BATCH = 25;
  let ingested = 0;
  const ingestIds: string[] = [];
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const id = await hydraDbIngestion.ingestAppRecords(batch);
    if (id) ingestIds.push(id);
    ingested += batch.length;
    process.stdout.write(`  ingested ${ingested}/${records.length}\r`);
  }
  console.log("");

  if (ingestIds.length > 0) {
    console.log(`\nwaiting for indexing...`);
    await hydraDbIngestion.waitForIndexing(ingestIds.slice(0, 5), 180_000);
  }

  console.log(`\n=== Done. Ingested ${ingested} Linear issues into HydraDB. ===`);
  console.log(`\nNow 3 sources are in HydraDB: audit ledger + GitHub + Linear.`);
  console.log(`Try a multi-hop query:`);
  console.log(`  "Who filed the issue about stable-email, and what did they spend on it?"`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Linear connector failed:", err);
  process.exit(1);
});
