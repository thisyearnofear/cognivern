/**
 * Attio connector — extracts people + companies from an Attio workspace and
 * ingests them into HydraDB as app-knowledge, keyed on the same `agent_id` /
 * `vendor` entities as the audit ledger, GitHub, and Linear.
 *
 * The shared entity is the **person's email → GitHub login**, which we map to
 * `agent_id` so HydraDB's graph can dedup: "the person in Attio who emails
 * about stable-email is the same operator who filed the Linear issue, committed
 * the GitHub change, and triggered the spend in the audit ledger." Companies
 * are mapped to `vendor` so an Attio company can dedup with the audit-ledger
 * vendor it corresponds to.
 *
 * Auth: `ATTIO_API_KEY` (personal access token). Personal access tokens also
 * need the `Attio-Workspace` header, set via `ATTIO_WORKSPACE` (your workspace
 * name). If your token already encodes the workspace (OAuth bearer), the
 * header is optional.
 *
 * Run:
 *   ATTIO_API_KEY=fc4... ATTIO_WORKSPACE=myworkspace \
 *   pnpm tsx tooling/scripts/hydradb/connectors/attio.ts
 *
 * If no key is set, the connector exits cleanly with guidance (does not fail
 * the build) — Attio is optional until you provide a key.
 */

import { hydraDbIngestion, type AppKnowledgeRecord } from "@backend/services/hydradb/index.js";
import { config } from "@/config.js";

const ATTIO_API = "https://api.attio.com";

interface AttioValue {
  value?: unknown;
  attribute_type?: string;
  [key: string]: unknown;
}

interface AttioRecord {
  id?: { workspace_id?: string; object_id?: string; record_id?: string };
  values?: Record<string, AttioValue[]>;
  created_at?: string;
  updated_at?: string;
}

interface ListResponse {
  data?: AttioRecord[];
  next_cursor?: string | null;
}

/** Build the headers for an Attio API call. */
function attioHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${process.env.ATTIO_API_KEY ?? ""}`,
    "Content-Type": "application/json",
  };
  // Personal access tokens are tied to a workspace and must declare it.
  const workspace = process.env.ATTIO_WORKSPACE;
  if (workspace) headers["Attio-Workspace"] = workspace;
  return headers;
}

/** POST the `/v2/objects/{object}/records/query` endpoint (lists records). */
async function listRecords(object: string, body: Record<string, unknown> = {}): Promise<ListResponse> {
  const res = await fetch(`${ATTIO_API}/v2/objects/${object}/records/query`, {
    method: "POST",
    headers: attioHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    // 401/403 usually means a missing/incorrect workspace header for a PAT.
    const hint =
      res.status === 401 || res.status === 403
        ? " (personal access tokens need ATTIO_WORKSPACE — set it to your workspace name)"
        : "";
    throw new Error(`Attio ${object} ${res.status}${hint}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as ListResponse;
  if (!Array.isArray(json.data)) {
    throw new Error(`Attio ${object} returned an unexpected shape (no data[]).`);
  }
  return json;
}

/** Fetch all records for an object (follows next_cursor), capped for the demo. */
async function fetchRecords(object: string, max = 250): Promise<AttioRecord[]> {
  const all: AttioRecord[] = [];
  let nextCursor: string | null | undefined = undefined;
  do {
    const body: Record<string, unknown> = {};
    if (nextCursor) body.next_cursor = nextCursor;
    const page = await listRecords(object, body);
    all.push(...(page.data ?? []));
    nextCursor = page.next_cursor ?? null;
  } while (nextCursor && all.length < max);
  return all.slice(0, max);
}

/**
 * Render a typed Attio attribute value → a searchable string.
 * Values look like { value: <typed>, attribute_type, active_from, ... }.
 */
function valueToString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(valueToString).filter(Boolean).join(", ");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    // Typed attributes carried in `value`.
    const inner = o.value;
    if (inner && typeof inner === "object") {
      const inn = inner as Record<string, unknown>;
      if (typeof inn.full_name === "string") return inn.full_name;
      if (typeof inn.email_address === "string") return inn.email_address;
      if (typeof inn.email_domain === "string" && typeof inn.local_part === "string")
        return `${inn.local_part}@${inn.email_domain}`;
      if (typeof inn.domain === "string") return inn.domain;
    }
    // A raw `value` string on the value object (e.g. text attributes carry it).
    if (typeof inner === "string") return inner;
    // Fall back to joining primitive sub-fields.
    const parts = Object.entries(o)
      .map(([k, val]) =>
        typeof val === "string" || typeof val === "number" ? `${k}: ${val}` : valueToString(val),
      )
      .filter(Boolean);
    return parts.join("; ");
  }
  return "";
}

/** Extract a person-ish name from a record's values map (best effort). */
function extractName(record: AttioRecord): string {
  const nameParts = record.values?.name;
  if (Array.isArray(nameParts)) {
    const name = valueToString(nameParts[0]?.value);
    if (name) return name;
  }
  for (const key of ["full_name", "name"]) {
    const arr = record.values?.[key];
    if (Array.isArray(arr) && arr[0]) {
      const s = valueToString(arr[0].value);
      if (s) return s;
    }
  }
  return "";
}

/** Collect email addresses from a record's values map. */
function extractEmails(record: AttioRecord): string[] {
  const out: string[] = [];
  const push = (slug: string) => {
    const arr = record.values?.[slug];
    if (Array.isArray(arr)) {
      for (const entry of arr) {
        const s = valueToString(entry.value);
        if (s && /@/.test(s)) out.push(s);
      }
    }
  };
  push("email_addresses");
  push("emails");
  return [...new Set(out)];
}

/** Human → canonical actor map, kept identical to Linear's so the same
 *  operator dedups across Attio + Linear + GitHub. */
const EMAIL_TO_GITHUB_LOGIN: Record<string, string> = {
  "papaandthejimjams@gmail.com": "thisyearnofear",
};

const KNOWN_VENDORS = ["stable-email"];
const KNOWN_AGENTS = ["http-verify-agent", "project-a-agent", "agent-1"];

/** Map an Attio person record to a HydraDB app-knowledge record. */
function personToRecord(rec: AttioRecord): AppKnowledgeRecord {
  const recordId = rec.id?.record_id ?? "";
  const name = extractName(rec) || "Unnamed person";
  const emails = extractEmails(rec);
  const primaryEmail = emails[0] ?? "";
  // Canonicalize the human to the GitHub login when known so the same operator
  // dedups across Attio + Linear + GitHub. Otherwise fall back to the email
  // local part (still dedups within Attio + matches Linear by email).
  const rawActorId =
    primaryEmail ||
    name.toLowerCase().replace(/\s+/g, "-") ||
    "unassigned";
  const actorId = EMAIL_TO_GITHUB_LOGIN[primaryEmail] ?? rawActorId;

  const haystack = `${name} ${emails.join(" ")}`.toLowerCase();
  const vendor = KNOWN_VENDORS.find((v) => haystack.includes(v)) ?? "unknown";
  const referencedAgent = KNOWN_AGENTS.find((a) => haystack.includes(a));

  // Render the full values map as retrieval content.
  const fields: string[] = ["email: " + emails.join(", ")];
  if (rec.values) {
    for (const [slug, arr] of Object.entries(rec.values)) {
      const lines = (arr ?? [])
        .map((e) => valueToString(e.value))
        .filter(Boolean);
      if (lines.length) fields.push(`${slug}: ${lines.join(", ")}`);
    }
  }
  const text = [`Attio person: ${name}`, ...fields].join("\n");

  const relationIds = [
    `cognivern_agent_${actorId}`,
    referencedAgent ? `cognivern_agent_${referencedAgent}` : undefined,
    vendor !== "unknown" ? `cognivern_vendor_${vendor}` : undefined,
  ].filter((x): x is string => Boolean(x));

  return {
    id: recordId ? `attio_person_${recordId}` : `attio_person_${actorId}`,
    database: config.HYDRADB_DATABASE,
    collection: config.HYDRADB_COLLECTION,
    title: `Attio person: ${name}`,
    type: "attio",
    timestamp: rec.updated_at ?? rec.created_at ?? new Date().toISOString(),
    content: { text, markdown: text },
    tenant_metadata: {},
    additional_metadata: {
      agent_id: actorId,
      vendor: vendor ?? "unknown",
      origin: "attio_person",
      // Attio-specific bookkeeping.
      attio_record_id: recordId,
      name,
      emails,
      email: primaryEmail,
      ts: (rec.updated_at ?? rec.created_at ?? "").slice(0, 10),
    },
    relations: {
      ids: relationIds,
      properties: { relation: "same_actor" },
    },
  };
}

/** Map an Attio company record to a HydraDB app-knowledge record. */
function companyToRecord(rec: AttioRecord): AppKnowledgeRecord {
  const recordId = rec.id?.record_id ?? "";
  const name = extractName(rec) || "Unnamed company";
  // Companies are vendors in the app's domain; normalize the name so it can
  // dedup with the audit-ledger `vendor` field (e.g. "stable-email").
  const vendor =
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "unknown";
  const domains = extractEmails(rec); // domain refs captured generically

  const fields: string[] = [];
  if (rec.values) {
    for (const [slug, arr] of Object.entries(rec.values)) {
      const values = (arr ?? []).map((e) => valueToString(e.value)).filter(Boolean);
      if (values.length) fields.push(`${slug}: ${values.join(", ")}`);
    }
  }
  const text = [`Attio company: ${name}`, `Domains: ${domains.join(", ")}`, ...fields].join("\n");

  return {
    id: recordId ? `attio_company_${recordId}` : `attio_company_${vendor}`,
    database: config.HYDRADB_DATABASE,
    collection: config.HYDRADB_COLLECTION,
    title: `Attio company: ${name}`,
    type: "attio",
    timestamp: rec.updated_at ?? rec.created_at ?? new Date().toISOString(),
    content: { text, markdown: text },
    tenant_metadata: {},
    additional_metadata: {
      agent_id: "unknown",
      vendor,
      origin: "attio_company",
      attio_record_id: recordId,
      name,
      ts: (rec.updated_at ?? rec.created_at ?? "").slice(0, 10),
    },
    relations: {
      ids: [`cognivern_vendor_${vendor}`],
      properties: { relation: "same_vendor" },
    },
  };
}


async function main() {
  console.log(`=== Attio connector → HydraDB ===`);
  console.log(`hydradb enabled: ${hydraDbIngestion.isEnabled()}`);

  if (!hydraDbIngestion.isEnabled()) {
    console.error("HYDRADB_ENABLED is not true (or HYDRADB_API_KEY missing).");
    process.exit(1);
  }

  if (!process.env.ATTIO_API_KEY) {
    console.error("\nATTIO_API_KEY is not set.");
    console.error("Get a personal access token from your Attio workspace (Settings → Developer).");
    console.error("Personal access tokens also need ATTIO_WORKSPACE=<your workspace name>.");
    console.error("Then run: ATTIO_API_KEY=fc4... ATTIO_WORKSPACE=myworkspace pnpm tsx tooling/scripts/hydradb/connectors/attio.ts");
    console.error("\n(This connector is optional — GitHub + Linear + audit ledger already give sources.)");
    process.exit(0); // exit 0 — Attio is optional.
  }

  if (!process.env.ATTIO_WORKSPACE) {
    console.warn("\n[!] ATTIO_WORKSPACE not set. If your token is a personal access token,");
    console.warn("    Attio will reject the call with 401/403 — set ATTIO_WORKSPACE=<workspace name>.\n");
  }

  const objects = (process.env.ATTIO_OBJECTS ?? "people,companies")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  console.log(`\n[1/3] fetching records for objects: ${objects.join(", ")}...`);
  const byObject: Record<string, AttioRecord[]> = {};
  for (const object of objects) {
    try {
      const records = await fetchRecords(object);
      byObject[object] = records;
      console.log(`  ${object}: fetched ${records.length} records`);
    } catch (err) {
      console.error(`  ${object}: FAILED — ${(err as Error).message}`);
    }
  }

  const people = byObject["people"] ?? [];
  const companies = byObject["companies"] ?? [];
  if (people.length === 0 && companies.length === 0) {
    console.error("\nNo records fetched from any object — is ATTIO_API_KEY / ATTIO_WORKSPACE correct?");
    process.exit(1);
  }

  console.log(`\n[2/3] mapping to app-knowledge records...`);
  const records: AppKnowledgeRecord[] = [
    ...people.map(personToRecord),
    ...companies.map(companyToRecord),
  ];
  console.log(`  ${records.length} records ready (${people.length} people + ${companies.length} companies)`);
  if (records.length > 0) {
    console.log(`  sample: ${records[0].title}`);
    const agents = [...new Set(records.map((r) => r.additional_metadata.agent_id).filter(Boolean))];
    const vendors = [
      ...new Set(
        records.map((r) => r.additional_metadata.vendor).filter((v) => v !== "unknown"),
      ),
    ];
    console.log(`  agent_ids: ${agents.join(", ") || "(none)"}`);
    console.log(`  vendors: ${vendors.join(", ") || "(none)"}`);
  }

  // --dry-run: validate fetch + mapping without writing anything to HydraDB.
  if (process.argv.includes("--dry-run")) {
    console.log(`\n[dry-run] fetched + mapped ${records.length} records (no ingest).`);
    console.log(`Remove --dry-run to actually ingest these into HydraDB.`);
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

  console.log(`\n=== Done. Ingested ${ingested} Attio records into HydraDB. ===`);
  console.log(`\nNow 3 listed connectors are in HydraDB: GitHub + Linear + Attio (plus the audit ledger).`);
  console.log(`Try a cross-source query:`);
  console.log(`  "Which Attio contact emailed about stable-email, and who filed the Linear issue about it?"`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Attio connector failed:", err);
  process.exit(1);
});

