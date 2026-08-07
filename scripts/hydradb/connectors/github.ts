/**
 * GitHub connector — extracts issues + PRs from the cognivern repo and
 * ingests them into HydraDB as app-knowledge, keyed on the same
 * `agent_id` / `vendor` entities as the audit ledger.
 *
 * The shared entity is the **issue/PR author** (GitHub login), which we map
 * to `agent_id` so HydraDB's graph can dedup: "the person who filed this
 * GitHub issue also triggered this spend in the audit ledger."
 *
 * Auth: optional `GITHUB_TOKEN` (raises rate limit from 60/hr to 5000/hr).
 *      Without a token, public-repo reads still work (60/hr).
 *
 * Run: pnpm tsx scripts/hydradb/connectors/github.ts
 *      GITHUB_TOKEN=ghp_... pnpm tsx scripts/hydradb/connectors/github.ts
 */

import logger from "@backend/utils/logger.js";
import { hydraDbIngestion, type AppKnowledgeRecord } from "@backend/services/hydradb/index.js";
import { config } from "@/config.js";

const GITHUB_API = "https://api.github.com";
const REPO = process.env.GITHUB_REPO || "thisyearnofear/cognivern";

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  user: { login: string } | null;
  labels: Array<{ name: string }>;
  html_url: string;
  created_at: string;
  updated_at: string;
  pull_request?: unknown; // present on PRs
  assignee: { login: string } | null;
  comments: number;
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string };
  };
  author: { login: string } | null;
  html_url: string;
}

async function ghFetch(path: string): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${GITHUB_API}${path}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  // Check rate limit
  const remaining = res.headers.get("x-ratelimit-remaining");
  if (remaining === "0") {
    throw new Error("GitHub rate limit exhausted — set GITHUB_TOKEN");
  }
  return res.json();
}

/**
 * Fetch issues + PRs from the repo. The /issues endpoint returns both
 * (PRs have a `pull_request` field).
 */
async function fetchIssues(state: "open" | "closed" | "all" = "all"): Promise<GitHubIssue[]> {
  const all: GitHubIssue[] = [];
  let page = 1;
  // Cap at 5 pages (500 items) — enough for the challenge demo.
  while (page <= 5) {
    const data = (await ghFetch(
      `/repos/${REPO}/issues?state=${state}&per_page=100&page=${page}&sort=created&direction=desc`,
    )) as GitHubIssue[];
    if (data.length === 0) break;
    all.push(...data);
    if (data.length < 100) break; // last page
    page++;
  }
  return all;
}

/**
 * Fetch recent commits (which have human authors, unlike dependabot issues).
 * These give us real `agent_id` values that can dedup with the audit ledger
 * when the same operator commits code and triggers agent spends.
 */
async function fetchCommits(): Promise<GitHubCommit[]> {
  const all: GitHubCommit[] = [];
  let page = 1;
  while (page <= 3) {
    const data = (await ghFetch(
      `/repos/${REPO}/commits?per_page=100&page=${page}`,
    )) as GitHubCommit[];
    if (data.length === 0) break;
    all.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return all;
}

/**
 * Map a GitHub commit to a HydraDB app-knowledge record.
 * The author login/email becomes `agent_id` for cross-source dedup.
 */
function commitToRecord(commit: GitHubCommit): AppKnowledgeRecord {
  const author = commit.author?.login ?? commit.commit.author.name ?? "unknown";
  const email = commit.commit.author.email;
  const sha = commit.sha.slice(0, 7);
  const message = commit.commit.message.split("\n")[0]; // subject line

  const text = [
    `Commit ${sha}: ${message}`,
    `Author: ${author} <${email}>`,
    `Repo: ${REPO}`,
    "",
    commit.commit.message,
  ].join("\n");

  return {
    id: `github_${REPO.replace("/", "_")}_commit_${sha}`,
    database: config.HYDRADB_DATABASE,
    collection: config.HYDRADB_COLLECTION,
    title: `GitHub commit ${sha}: ${message}`,
    type: "github",
    url: commit.html_url,
    timestamp: commit.commit.author.date,
    content: { text, markdown: text },
    tenant_metadata: {},
    additional_metadata: {
      // Entity fields for cross-source dedup with the audit ledger.
      agent_id: author, // GitHub login = the operator/actor
      vendor: "unknown",
      origin: "github_commit",
      github_repo: REPO,
      commit_sha: sha,
      author,
      author_email: email,
      ts: commit.commit.author.date.slice(0, 10),
    },
    relations: {
      ids: [`cognivern_agent_${author}`].filter(Boolean),
      properties: { relation: "same_actor" },
    },
  };
}

/**
 * Map a GitHub issue/PR to a HydraDB app-knowledge record.
 * The author login becomes `agent_id` so it dedups with audit-ledger agents
 * (when the same operator triggers spends and files issues).
 */
function issueToRecord(issue: GitHubIssue): AppKnowledgeRecord {
  const author = issue.user?.login ?? "unknown";
  const isPR = Boolean(issue.pull_request);
  const labels = issue.labels.map((l) => l.name);
  // Heuristic: if a label mentions a vendor (e.g. "vendor:stable-email"),
  // extract it for cross-source dedup.
  const vendorLabel = labels.find((l) => l.toLowerCase().startsWith("vendor:"));
  const vendor = vendorLabel ? vendorLabel.split(":")[1] : undefined;

  const text = [
    `${isPR ? "Pull Request" : "Issue"} #${issue.number}: ${issue.title}`,
    `State: ${issue.state} | Author: ${author}${issue.assignee ? ` | Assignee: ${issue.assignee.login}` : ""}`,
    labels.length ? `Labels: ${labels.join(", ")}` : "",
    "",
    issue.body ?? "(no description)",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: `github_${REPO.replace("/", "_")}_issue_${issue.number}`,
    database: config.HYDRADB_DATABASE,
    collection: config.HYDRADB_COLLECTION,
    title: `GitHub ${isPR ? "PR" : "Issue"} #${issue.number}: ${issue.title}`,
    type: "github",
    url: issue.html_url,
    timestamp: issue.created_at,
    content: { text, markdown: text },
    tenant_metadata: {},
    additional_metadata: {
      // Entity fields for cross-source dedup with the audit ledger.
      agent_id: author, // GitHub login = the actor
      vendor: vendor ?? "unknown",
      origin: "github",
      // GitHub-specific bookkeeping.
      github_repo: REPO,
      issue_number: issue.number,
      is_pr: isPR,
      state: issue.state,
      author,
      assignee: issue.assignee?.login,
      labels,
      comments: issue.comments,
      ts: issue.created_at.slice(0, 10),
    },
    relations: {
      // Link to the cognivern agent entity (same actor across sources).
      ids: [`cognivern_agent_${author}`].filter(Boolean),
      properties: { relation: "same_actor" },
    },
  };
}

async function main() {
  console.log(`=== GitHub connector → HydraDB ===`);
  console.log(`repo: ${REPO}`);
  console.log(`hydradb enabled: ${hydraDbIngestion.isEnabled()}`);

  if (!hydraDbIngestion.isEnabled()) {
    console.error("HYDRADB_ENABLED is not true (or HYDRADB_API_KEY missing).");
    process.exit(1);
  }

  console.log(`\n[1/3] fetching issues + PRs from GitHub...`);
  const issues = await fetchIssues("all");
  console.log(`  fetched ${issues.length} issues/PRs`);

  console.log(`\n[1b/3] fetching recent commits (human authors)...`);
  const commits = await fetchCommits();
  console.log(`  fetched ${commits.length} commits`);

  // Filter out pure dependabot noise if there's signal-rich content.
  const meaningful = issues.filter(
    (i) => !i.user?.login.includes("[bot]") || issues.length < 20,
  );
  console.log(`  ${meaningful.length} issues after filtering bots (kept all if few)`);

  console.log(`\n[2/3] mapping to app-knowledge records...`);
  const issueRecords = issues.map(issueToRecord);
  const commitRecords = commits.map(commitToRecord);
  const records = [...issueRecords, ...commitRecords];
  console.log(`  ${records.length} records ready (${issueRecords.length} issues + ${commitRecords.length} commits)`);
  console.log(`  sample: ${records[0]?.title}`);
  const agentIds = [...new Set(records.map((r) => r.additional_metadata.agent_id))];
  console.log(`  agent_ids: ${agentIds.join(", ")}`);

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

  console.log(`\n=== Done. Ingested ${ingested} GitHub issues/PRs into HydraDB. ===`);
  console.log(`\nNext: query across audit + GitHub, e.g.:`);
  console.log(`  "What issues did the operator who triggered the stable-email spend file?"`);
  process.exit(0);
}

main().catch((err) => {
  console.error("GitHub connector failed:", err);
  process.exit(1);
});
